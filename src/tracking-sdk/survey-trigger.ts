/**
 * Survey Trigger Manager - Handles displaying surveys based on trigger conditions
 */

interface SurveyTriggerConfig {
  siteId: string;
  triggers: SurveyTrigger[];
  pageTargets: PageTarget[];
  apiEndpoint: string;
  debug?: boolean;
}

interface SurveyTrigger {
  id: string;
  surveyId: string;
  triggerType: string;
  triggerValue: number | null;
  triggerSelector: string | null;
  displayMode: string;
  displayPosition: string | null;
  displayDelay: number;
  showOnce: boolean;
  cooldownDays: number | null;
  percentageShow: number;
  pageTargetId: string | null;
}

interface PageTarget {
  id: string;
  urlPattern: string;
  matchType: string;
}

const SHOWN_SURVEYS_KEY = "svtr_shown_surveys";
const SURVEY_COOLDOWNS_KEY = "svtr_survey_cooldowns";

export class SurveyTriggerManager {
  private config: SurveyTriggerConfig;
  private activeTriggers: SurveyTrigger[] = [];
  private scrollListener: (() => void) | null = null;
  private exitIntentListener: ((e: MouseEvent) => void) | null = null;
  private clickListeners: Map<string, (e: Event) => void> = new Map();
  private pageLoadTimeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(config: SurveyTriggerConfig) {
    this.config = config;
  }

  init(): void {
    this.log("Initializing survey trigger manager");

    // Filter triggers for current page
    this.activeTriggers = this.config.triggers.filter((trigger) => {
      // Check if trigger should show based on percentage
      if (!this.shouldShowByPercentage(trigger)) {
        this.log(`Trigger ${trigger.id} skipped (percentage check)`);
        return false;
      }

      // Check cooldown
      if (this.isInCooldown(trigger)) {
        this.log(`Trigger ${trigger.id} in cooldown`);
        return false;
      }

      // Check if already shown (for showOnce triggers)
      if (trigger.showOnce && this.hasBeenShown(trigger)) {
        this.log(`Trigger ${trigger.id} already shown`);
        return false;
      }

      // Check page target
      if (trigger.pageTargetId) {
        const target = this.config.pageTargets.find((t) => t.id === trigger.pageTargetId);
        if (target && !this.matchesPageTarget(target)) {
          this.log(`Trigger ${trigger.id} doesn't match page target`);
          return false;
        }
      }

      return true;
    });

    this.log(`${this.activeTriggers.length} triggers active for current page`);

    // Set up listeners for each trigger type
    this.setupTriggers();
  }

  private setupTriggers(): void {
    for (const trigger of this.activeTriggers) {
      switch (trigger.triggerType) {
        case "PAGE_LOAD":
          this.setupPageLoadTrigger(trigger);
          break;
        case "TIME_DELAY":
          this.setupTimeDelayTrigger(trigger);
          break;
        case "SCROLL_DEPTH":
          this.setupScrollDepthTrigger(trigger);
          break;
        case "EXIT_INTENT":
          this.setupExitIntentTrigger(trigger);
          break;
        case "ELEMENT_CLICK":
          this.setupElementClickTrigger(trigger);
          break;
        case "ELEMENT_VISIBLE":
          this.setupElementVisibleTrigger(trigger);
          break;
        default:
          this.log(`Unknown trigger type: ${trigger.triggerType}`);
      }
    }
  }

  private setupPageLoadTrigger(trigger: SurveyTrigger): void {
    const delay = trigger.displayDelay || 0;
    const timeout = setTimeout(() => {
      this.showSurvey(trigger);
    }, delay);
    this.pageLoadTimeouts.push(timeout);
  }

  private setupTimeDelayTrigger(trigger: SurveyTrigger): void {
    const delay = (trigger.triggerValue || 0) * 1000; // Convert to ms
    const timeout = setTimeout(() => {
      this.showSurvey(trigger);
    }, delay);
    this.pageLoadTimeouts.push(timeout);
  }

  private setupScrollDepthTrigger(trigger: SurveyTrigger): void {
    const targetDepth = trigger.triggerValue || 50;
    let triggered = false;

    const listener = () => {
      if (triggered) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
        window.innerHeight;

      if (docHeight <= 0) return;

      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      if (scrollPercent >= targetDepth) {
        triggered = true;
        this.showSurvey(trigger);
      }
    };

    this.scrollListener = listener;
    document.addEventListener("scroll", listener, { passive: true });
  }

  private setupExitIntentTrigger(trigger: SurveyTrigger): void {
    let triggered = false;

    const listener = (e: MouseEvent) => {
      if (triggered) return;

      // Check if mouse is leaving through the top of the viewport
      if (e.clientY <= 0) {
        triggered = true;
        this.showSurvey(trigger);
      }
    };

    this.exitIntentListener = listener;
    document.addEventListener("mouseout", listener);
  }

  private setupElementClickTrigger(trigger: SurveyTrigger): void {
    if (!trigger.triggerSelector) return;

    const listener = () => {
      this.showSurvey(trigger);
    };

    // Add listener to all matching elements
    try {
      const elements = document.querySelectorAll(trigger.triggerSelector);
      elements.forEach((el) => {
        el.addEventListener("click", listener);
      });
      this.clickListeners.set(trigger.id, listener);
    } catch (e) {
      this.log(`Invalid selector: ${trigger.triggerSelector}`);
    }
  }

  private setupElementVisibleTrigger(trigger: SurveyTrigger): void {
    if (!trigger.triggerSelector) return;

    try {
      const element = document.querySelector(trigger.triggerSelector);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.showSurvey(trigger);
              observer.disconnect();
              break;
            }
          }
        },
        { threshold: 0.5 }
      );

      observer.observe(element);
    } catch (e) {
      this.log(`Invalid selector: ${trigger.triggerSelector}`);
    }
  }

  private showSurvey(trigger: SurveyTrigger): void {
    this.log(`Showing survey for trigger ${trigger.id}`);

    // Record that survey was shown
    this.markAsShown(trigger);

    // Set cooldown if applicable
    if (trigger.cooldownDays) {
      this.setCooldown(trigger);
    }

    // Create and display the survey widget
    this.displaySurveyWidget(trigger);
  }

  private displaySurveyWidget(trigger: SurveyTrigger): void {
    const surveyUrl = `/embed/${trigger.surveyId}`;

    if (trigger.displayMode === "MODAL") {
      this.showModal(surveyUrl, trigger);
    } else if (trigger.displayMode === "SLIDE_IN") {
      this.showSlideIn(surveyUrl, trigger);
    } else if (trigger.displayMode === "BANNER") {
      this.showBanner(surveyUrl, trigger);
    } else if (trigger.displayMode === "INLINE") {
      // Inline requires a target element
      if (trigger.triggerSelector) {
        this.showInline(surveyUrl, trigger);
      }
    }
  }

  private showModal(surveyUrl: string, trigger: SurveyTrigger): void {
    const overlay = document.createElement("div");
    overlay.id = `svtr-modal-${trigger.id}`;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      animation: svtr-fade-in 0.2s ease;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow: hidden;
      position: relative;
      animation: svtr-slide-up 0.3s ease;
    `;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      z-index: 1;
    `;
    closeBtn.onclick = () => overlay.remove();

    const iframe = document.createElement("iframe");
    iframe.src = surveyUrl;
    iframe.style.cssText = `
      width: 100%;
      height: 500px;
      border: none;
    `;

    modal.appendChild(closeBtn);
    modal.appendChild(iframe);
    overlay.appendChild(modal);

    // Add styles
    this.injectStyles();

    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Close on escape key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);
  }

  private showSlideIn(surveyUrl: string, trigger: SurveyTrigger): void {
    const position = trigger.displayPosition || "bottom-right";
    const [vertical, horizontal] = position.split("-");

    const container = document.createElement("div");
    container.id = `svtr-slidein-${trigger.id}`;
    container.style.cssText = `
      position: fixed;
      ${vertical === "bottom" ? "bottom" : "top"}: 20px;
      ${horizontal === "right" ? "right" : "left"}: 20px;
      z-index: 999999;
      animation: svtr-slide-in-${position} 0.3s ease;
    `;

    const widget = document.createElement("div");
    widget.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      width: 350px;
      max-height: 500px;
      overflow: hidden;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      justify-content: flex-end;
      padding: 8px;
      background: #f8f8f8;
      border-bottom: 1px solid #eee;
    `;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      border: none;
      background: transparent;
      font-size: 20px;
      cursor: pointer;
      color: #666;
    `;
    closeBtn.onclick = () => container.remove();

    const iframe = document.createElement("iframe");
    iframe.src = surveyUrl;
    iframe.style.cssText = `
      width: 100%;
      height: 400px;
      border: none;
    `;

    header.appendChild(closeBtn);
    widget.appendChild(header);
    widget.appendChild(iframe);
    container.appendChild(widget);

    this.injectStyles();
    document.body.appendChild(container);
  }

  private showBanner(surveyUrl: string, trigger: SurveyTrigger): void {
    const position = trigger.displayPosition === "top" ? "top" : "bottom";

    const container = document.createElement("div");
    container.id = `svtr-banner-${trigger.id}`;
    container.style.cssText = `
      position: fixed;
      ${position}: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      animation: svtr-slide-in-${position} 0.3s ease;
    `;

    const banner = document.createElement("div");
    banner.style.cssText = `
      background: white;
      box-shadow: 0 ${position === "top" ? "4px" : "-4px"} 20px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
    `;

    const iframe = document.createElement("iframe");
    iframe.src = surveyUrl;
    iframe.style.cssText = `
      flex: 1;
      max-width: 800px;
      height: 80px;
      border: none;
    `;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      border: none;
      background: transparent;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 8px;
    `;
    closeBtn.onclick = () => container.remove();

    banner.appendChild(iframe);
    banner.appendChild(closeBtn);
    container.appendChild(banner);

    this.injectStyles();
    document.body.appendChild(container);
  }

  private showInline(surveyUrl: string, trigger: SurveyTrigger): void {
    if (!trigger.triggerSelector) return;

    try {
      const target = document.querySelector(trigger.triggerSelector);
      if (!target) return;

      const iframe = document.createElement("iframe");
      iframe.src = surveyUrl;
      iframe.style.cssText = `
        width: 100%;
        min-height: 400px;
        border: none;
        border-radius: 8px;
      `;

      target.appendChild(iframe);
    } catch (e) {
      this.log(`Invalid selector: ${trigger.triggerSelector}`);
    }
  }

  private injectStyles(): void {
    if (document.getElementById("svtr-styles")) return;

    const style = document.createElement("style");
    style.id = "svtr-styles";
    style.textContent = `
      @keyframes svtr-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes svtr-slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes svtr-slide-in-bottom-right {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      @keyframes svtr-slide-in-bottom-left {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      @keyframes svtr-slide-in-top-right {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      @keyframes svtr-slide-in-top-left {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      @keyframes svtr-slide-in-top {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      @keyframes svtr-slide-in-bottom {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  private matchesPageTarget(target: PageTarget): boolean {
    const currentPath = window.location.pathname;
    const pattern = target.urlPattern;

    switch (target.matchType) {
      case "EXACT":
        return currentPath === pattern;

      case "STARTS_WITH":
        return currentPath.startsWith(pattern);

      case "CONTAINS":
        return currentPath.includes(pattern);

      case "REGEX":
        try {
          const regex = new RegExp(pattern);
          return regex.test(currentPath);
        } catch {
          return false;
        }

      case "WILDCARD":
        // Convert wildcard pattern to regex
        const wildcardRegex = new RegExp(
          "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
        );
        return wildcardRegex.test(currentPath);

      default:
        return true;
    }
  }

  private shouldShowByPercentage(trigger: SurveyTrigger): boolean {
    const percentage = trigger.percentageShow || 100;
    return Math.random() * 100 < percentage;
  }

  private hasBeenShown(trigger: SurveyTrigger): boolean {
    const shown = this.getShownSurveys();
    return shown.includes(trigger.id);
  }

  private markAsShown(trigger: SurveyTrigger): void {
    const shown = this.getShownSurveys();
    if (!shown.includes(trigger.id)) {
      shown.push(trigger.id);
      localStorage.setItem(SHOWN_SURVEYS_KEY, JSON.stringify(shown));
    }
  }

  private getShownSurveys(): string[] {
    try {
      const stored = localStorage.getItem(SHOWN_SURVEYS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private isInCooldown(trigger: SurveyTrigger): boolean {
    if (!trigger.cooldownDays) return false;

    const cooldowns = this.getCooldowns();
    const cooldownEnd = cooldowns[trigger.id];

    if (!cooldownEnd) return false;

    return Date.now() < cooldownEnd;
  }

  private setCooldown(trigger: SurveyTrigger): void {
    if (!trigger.cooldownDays) return;

    const cooldowns = this.getCooldowns();
    cooldowns[trigger.id] = Date.now() + trigger.cooldownDays * 24 * 60 * 60 * 1000;
    localStorage.setItem(SURVEY_COOLDOWNS_KEY, JSON.stringify(cooldowns));
  }

  private getCooldowns(): Record<string, number> {
    try {
      const stored = localStorage.getItem(SURVEY_COOLDOWNS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  destroy(): void {
    // Clear timeouts
    for (const timeout of this.pageLoadTimeouts) {
      clearTimeout(timeout);
    }
    this.pageLoadTimeouts = [];

    // Remove scroll listener
    if (this.scrollListener) {
      document.removeEventListener("scroll", this.scrollListener);
      this.scrollListener = null;
    }

    // Remove exit intent listener
    if (this.exitIntentListener) {
      document.removeEventListener("mouseout", this.exitIntentListener);
      this.exitIntentListener = null;
    }

    // Remove click listeners
    for (const [triggerId, listener] of this.clickListeners) {
      const trigger = this.activeTriggers.find((t) => t.id === triggerId);
      if (trigger?.triggerSelector) {
        try {
          const elements = document.querySelectorAll(trigger.triggerSelector);
          elements.forEach((el) => {
            el.removeEventListener("click", listener);
          });
        } catch {
          // Ignore invalid selectors
        }
      }
    }
    this.clickListeners.clear();
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[SurveyTriggerManager]", ...args);
    }
  }
}
