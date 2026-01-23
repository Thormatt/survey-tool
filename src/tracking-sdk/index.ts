/**
 * Svartigaldur Tracking SDK
 * Lightweight SDK for session recording, heatmaps, and survey triggers
 */

import { EventRecorder } from "./event-recorder";
import { HeatmapCollector } from "./heatmap-collector";
import { SurveyTriggerManager } from "./survey-trigger";
import { generateVisitorId, getSessionToken, setSessionToken } from "./utils";

export interface TrackingConfig {
  siteId: string;
  apiEndpoint?: string;
  enableRecording?: boolean;
  enableHeatmaps?: boolean;
  enableSurveys?: boolean;
  debug?: boolean;
  samplingRate?: number;
}

interface InitResponse {
  sessionToken: string;
  config: {
    recordingEnabled: boolean;
    heatmapsEnabled: boolean;
    surveysEnabled: boolean;
    samplingRate: number;
  };
  triggers: SurveyTrigger[];
  pageTargets: PageTarget[];
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

class SvartigaldurTracker {
  private config: Required<TrackingConfig>;
  private visitorId: string;
  private sessionToken: string | null = null;
  private eventRecorder: EventRecorder | null = null;
  private heatmapCollector: HeatmapCollector | null = null;
  private surveyManager: SurveyTriggerManager | null = null;
  private initialized = false;
  private pageTargets: PageTarget[] = [];

  constructor(config: TrackingConfig) {
    this.config = {
      apiEndpoint: "/api/track",
      enableRecording: true,
      enableHeatmaps: true,
      enableSurveys: true,
      debug: false,
      samplingRate: 100,
      ...config,
    };

    this.visitorId = generateVisitorId();
    this.sessionToken = getSessionToken();
  }

  async init(): Promise<void> {
    if (this.initialized) {
      this.log("Already initialized");
      return;
    }

    try {
      const response = await this.initSession();
      if (!response) {
        this.log("Failed to initialize session");
        return;
      }

      this.sessionToken = response.sessionToken;
      setSessionToken(response.sessionToken);
      this.pageTargets = response.pageTargets;

      // Check sampling
      if (!this.shouldSample(response.config.samplingRate)) {
        this.log("Session not sampled");
        return;
      }

      // Initialize recording
      if (this.config.enableRecording && response.config.recordingEnabled) {
        this.eventRecorder = new EventRecorder({
          sessionToken: response.sessionToken,
          apiEndpoint: this.config.apiEndpoint,
          debug: this.config.debug,
        });
        this.eventRecorder.start();
      }

      // Initialize heatmaps
      if (this.config.enableHeatmaps && response.config.heatmapsEnabled) {
        this.heatmapCollector = new HeatmapCollector({
          siteId: this.config.siteId,
          apiEndpoint: this.config.apiEndpoint,
          debug: this.config.debug,
        });
        this.heatmapCollector.start();
      }

      // Initialize survey triggers
      if (this.config.enableSurveys && response.config.surveysEnabled) {
        this.surveyManager = new SurveyTriggerManager({
          siteId: this.config.siteId,
          triggers: response.triggers,
          pageTargets: response.pageTargets,
          apiEndpoint: this.config.apiEndpoint,
          debug: this.config.debug,
        });
        this.surveyManager.init();
      }

      this.initialized = true;
      this.log("Tracker initialized");

      // Handle page unload
      this.setupUnloadHandler();

    } catch (error) {
      this.log("Initialization error:", error);
    }
  }

  private async initSession(): Promise<InitResponse | null> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: this.config.siteId,
          visitorId: this.visitorId,
          sessionToken: this.sessionToken,
          pageUrl: window.location.href,
          pagePath: window.location.pathname,
          pageTitle: document.title,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
        }),
      });

      if (!response.ok) {
        this.log("Init request failed:", response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.log("Init request error:", error);
      return null;
    }
  }

  private shouldSample(rate: number): boolean {
    const stored = localStorage.getItem("svtr_sampled");
    if (stored !== null) {
      return stored === "true";
    }
    const sampled = Math.random() * 100 < rate;
    localStorage.setItem("svtr_sampled", String(sampled));
    return sampled;
  }

  private setupUnloadHandler(): void {
    const handleUnload = () => {
      this.eventRecorder?.flush();
      this.heatmapCollector?.flush();
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        handleUnload();
      }
    });
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) {
      this.log("Not initialized, cannot track event");
      return;
    }

    this.eventRecorder?.trackCustomEvent(eventName, properties);
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.initialized) {
      this.log("Not initialized, cannot identify");
      return;
    }

    // Store user identification
    localStorage.setItem("svtr_user_id", userId);
    if (traits) {
      localStorage.setItem("svtr_user_traits", JSON.stringify(traits));
    }

    this.eventRecorder?.trackCustomEvent("identify", { userId, ...traits });
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[Svartigaldur]", ...args);
    }
  }

  destroy(): void {
    this.eventRecorder?.stop();
    this.heatmapCollector?.stop();
    this.surveyManager?.destroy();
    this.initialized = false;
  }
}

// Global instance
let instance: SvartigaldurTracker | null = null;

export function init(config: TrackingConfig): SvartigaldurTracker {
  if (instance) {
    return instance;
  }
  instance = new SvartigaldurTracker(config);
  instance.init();
  return instance;
}

export function track(eventName: string, properties?: Record<string, unknown>): void {
  instance?.track(eventName, properties);
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  instance?.identify(userId, traits);
}

export function destroy(): void {
  instance?.destroy();
  instance = null;
}

// Auto-init from script tag
if (typeof window !== "undefined") {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script) {
    const siteId = script.getAttribute("data-site-id");
    if (siteId) {
      init({ siteId });
    }
  }
}

export default { init, track, identify, destroy };
