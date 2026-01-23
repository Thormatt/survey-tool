/**
 * Event Recorder - Captures user interactions for session replay
 */

import { throttle, getElementSelector, sendBeacon } from "./utils";

interface EventRecorderConfig {
  sessionToken: string;
  apiEndpoint: string;
  debug?: boolean;
}

interface RecordedEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const BATCH_SIZE = 50;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MOUSE_THROTTLE = 100; // 100ms
const SCROLL_THROTTLE = 200; // 200ms

export class EventRecorder {
  private config: EventRecorderConfig;
  private events: RecordedEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: number;
  private clickCount = 0;
  private maxScrollDepth = 0;
  private lastClickTime = 0;
  private lastClickX = 0;
  private lastClickY = 0;
  private clicksInSameSpot = 0;
  private rageClicks = 0;
  private deadClicks = 0;

  // Event handlers (bound)
  private handleMouseMove: (e: MouseEvent) => void;
  private handleClick: (e: MouseEvent) => void;
  private handleScroll: () => void;
  private handleResize: () => void;
  private handleInput: (e: Event) => void;

  constructor(config: EventRecorderConfig) {
    this.config = config;
    this.startTime = Date.now();

    // Bind handlers
    this.handleMouseMove = throttle(this.onMouseMove.bind(this), MOUSE_THROTTLE);
    this.handleClick = this.onClick.bind(this);
    this.handleScroll = throttle(this.onScroll.bind(this), SCROLL_THROTTLE);
    this.handleResize = throttle(this.onResize.bind(this), 500);
    this.handleInput = this.onInput.bind(this);
  }

  start(): void {
    this.log("Starting event recorder");

    // Record initial page state
    this.recordEvent("page_load", {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });

    // Attach event listeners
    document.addEventListener("mousemove", this.handleMouseMove, { passive: true });
    document.addEventListener("click", this.handleClick, { capture: true });
    document.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("resize", this.handleResize, { passive: true });
    document.addEventListener("input", this.handleInput, { capture: true });

    // Start flush interval
    this.flushInterval = setInterval(() => this.flush(), FLUSH_INTERVAL);
  }

  stop(): void {
    this.log("Stopping event recorder");

    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("click", this.handleClick, { capture: true });
    document.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("input", this.handleInput, { capture: true });

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flush();
  }

  private onMouseMove(e: MouseEvent): void {
    this.recordEvent("mouse_move", {
      x: e.clientX,
      y: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
    });
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as Element;
    const now = Date.now();

    this.clickCount++;

    // Detect rage clicks (multiple rapid clicks in same area)
    if (now - this.lastClickTime < 500) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - this.lastClickX, 2) + Math.pow(e.clientY - this.lastClickY, 2)
      );
      if (distance < 30) {
        this.clicksInSameSpot++;
        if (this.clicksInSameSpot >= 3) {
          this.rageClicks++;
          this.recordEvent("rage_click", {
            x: e.clientX,
            y: e.clientY,
            count: this.clicksInSameSpot,
          });
        }
      } else {
        this.clicksInSameSpot = 1;
      }
    } else {
      this.clicksInSameSpot = 1;
    }

    this.lastClickTime = now;
    this.lastClickX = e.clientX;
    this.lastClickY = e.clientY;

    // Detect dead clicks (clicks that don't cause any action)
    const isInteractive =
      target.tagName === "A" ||
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "SELECT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("a") !== null ||
      target.closest("button") !== null ||
      target.getAttribute("role") === "button" ||
      window.getComputedStyle(target).cursor === "pointer";

    if (!isInteractive) {
      this.deadClicks++;
    }

    this.recordEvent("click", {
      x: e.clientX,
      y: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
      selector: getElementSelector(target),
      tagName: target.tagName,
      text: (target.textContent || "").slice(0, 50),
      href: (target as HTMLAnchorElement).href || target.closest("a")?.href || null,
      isInteractive,
    });
  }

  private onScroll(): void {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
      window.innerHeight;
    const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

    if (scrollPercent > this.maxScrollDepth) {
      this.maxScrollDepth = scrollPercent;
    }

    this.recordEvent("scroll", {
      scrollTop,
      scrollPercent,
      maxScrollDepth: this.maxScrollDepth,
    });
  }

  private onResize(): void {
    this.recordEvent("resize", {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  private onInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!target.tagName) return;

    // Don't record sensitive input values
    const isSensitive =
      target.type === "password" ||
      target.type === "email" ||
      target.name?.toLowerCase().includes("password") ||
      target.name?.toLowerCase().includes("email") ||
      target.name?.toLowerCase().includes("card") ||
      target.name?.toLowerCase().includes("ssn") ||
      target.name?.toLowerCase().includes("credit");

    this.recordEvent("input", {
      selector: getElementSelector(target),
      tagName: target.tagName,
      type: (target as HTMLInputElement).type || "text",
      name: target.name || null,
      hasValue: !!target.value,
      valueLength: isSensitive ? null : target.value?.length,
    });
  }

  trackCustomEvent(eventName: string, properties?: Record<string, unknown>): void {
    this.recordEvent("custom", {
      name: eventName,
      ...properties,
    });
  }

  private recordEvent(type: string, data: Record<string, unknown>): void {
    this.events.push({
      type,
      timestamp: Date.now() - this.startTime,
      data,
    });

    if (this.events.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  flush(): void {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    const payload = {
      sessionToken: this.config.sessionToken,
      events: eventsToSend,
      metrics: {
        clickCount: this.clickCount,
        maxScrollDepth: this.maxScrollDepth,
        rageClicks: this.rageClicks,
        deadClicks: this.deadClicks,
        duration: Date.now() - this.startTime,
      },
    };

    // Use sendBeacon for reliability on page unload
    const sent = sendBeacon(`${this.config.apiEndpoint}/events`, payload);

    if (!sent) {
      // Fallback to fetch
      fetch(`${this.config.apiEndpoint}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((err) => this.log("Failed to send events:", err));
    }

    this.log(`Flushed ${eventsToSend.length} events`);
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[EventRecorder]", ...args);
    }
  }
}
