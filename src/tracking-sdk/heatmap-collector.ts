/**
 * Heatmap Collector - Aggregates interaction data for heatmap visualization
 */

import { throttle, getViewportBreakpoint, getElementSelector, sendBeacon } from "./utils";

interface HeatmapConfig {
  siteId: string;
  apiEndpoint: string;
  debug?: boolean;
}

interface HeatmapPoint {
  x: number;
  y: number;
  count: number;
  selector?: string;
}

interface HeatmapData {
  clicks: Map<string, HeatmapPoint>;
  moves: Map<string, HeatmapPoint>;
  scrolls: Map<number, number>; // depth -> count
}

const FLUSH_INTERVAL = 30000; // 30 seconds
const MOUSE_THROTTLE = 50; // 50ms for movement sampling
const GRID_SIZE = 10; // Group points into 10px grid cells

export class HeatmapCollector {
  private config: HeatmapConfig;
  private data: HeatmapData;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private pagePath: string;
  private viewportBreakpoint: string;

  // Event handlers (bound)
  private handleMouseMove: (e: MouseEvent) => void;
  private handleClick: (e: MouseEvent) => void;
  private handleScroll: () => void;

  constructor(config: HeatmapConfig) {
    this.config = config;
    this.pagePath = window.location.pathname;
    this.viewportBreakpoint = getViewportBreakpoint();
    this.data = {
      clicks: new Map(),
      moves: new Map(),
      scrolls: new Map(),
    };

    // Bind handlers
    this.handleMouseMove = throttle(this.onMouseMove.bind(this), MOUSE_THROTTLE);
    this.handleClick = this.onClick.bind(this);
    this.handleScroll = throttle(this.onScroll.bind(this), 500);
  }

  start(): void {
    this.log("Starting heatmap collector");

    // Attach event listeners
    document.addEventListener("mousemove", this.handleMouseMove, { passive: true });
    document.addEventListener("click", this.handleClick, { passive: true });
    document.addEventListener("scroll", this.handleScroll, { passive: true });

    // Start flush interval
    this.flushInterval = setInterval(() => this.flush(), FLUSH_INTERVAL);
  }

  stop(): void {
    this.log("Stopping heatmap collector");

    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("click", this.handleClick);
    document.removeEventListener("scroll", this.handleScroll);

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flush();
  }

  private onMouseMove(e: MouseEvent): void {
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const relativeY = (e.pageY / docHeight) * 100;

    // Group into grid cells
    const gridX = Math.floor(e.pageX / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.floor(e.pageY / GRID_SIZE) * GRID_SIZE;
    const key = `${gridX},${gridY}`;

    const existing = this.data.moves.get(key);
    if (existing) {
      existing.count++;
    } else {
      this.data.moves.set(key, {
        x: gridX,
        y: gridY,
        count: 1,
      });
    }
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as Element;
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );

    // Get relative position (percentage)
    const relativeX = (e.pageX / document.documentElement.scrollWidth) * 100;
    const relativeY = (e.pageY / docHeight) * 100;

    // Group into grid cells for aggregation
    const gridX = Math.floor(e.pageX / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.floor(e.pageY / GRID_SIZE) * GRID_SIZE;
    const key = `${gridX},${gridY}`;

    const existing = this.data.clicks.get(key);
    if (existing) {
      existing.count++;
    } else {
      this.data.clicks.set(key, {
        x: gridX,
        y: gridY,
        count: 1,
        selector: getElementSelector(target),
      });
    }
  }

  private onScroll(): void {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
      window.innerHeight;

    if (docHeight <= 0) return;

    // Get scroll depth as percentage
    const scrollPercent = Math.round((scrollTop / docHeight) * 100);

    // Record all depths up to current (user saw all content above)
    for (let depth = 0; depth <= scrollPercent; depth += 10) {
      const existing = this.data.scrolls.get(depth) || 0;
      this.data.scrolls.set(depth, existing + 1);
    }
  }

  flush(): void {
    const hasData =
      this.data.clicks.size > 0 || this.data.moves.size > 0 || this.data.scrolls.size > 0;

    if (!hasData) return;

    const payload = {
      siteId: this.config.siteId,
      pagePath: this.pagePath,
      viewportBreakpoint: this.viewportBreakpoint,
      clicks: Array.from(this.data.clicks.values()),
      moves: Array.from(this.data.moves.values()),
      scrolls: Array.from(this.data.scrolls.entries()).map(([depth, count]) => ({
        depth,
        count,
      })),
    };

    // Clear data
    this.data = {
      clicks: new Map(),
      moves: new Map(),
      scrolls: new Map(),
    };

    // Use sendBeacon for reliability
    const sent = sendBeacon(`${this.config.apiEndpoint}/heatmap`, payload);

    if (!sent) {
      fetch(`${this.config.apiEndpoint}/heatmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((err) => this.log("Failed to send heatmap data:", err));
    }

    this.log("Flushed heatmap data");
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[HeatmapCollector]", ...args);
    }
  }
}
