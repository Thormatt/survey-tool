/**
 * Heatmap data aggregation utilities
 *
 * Used for aggregating raw heatmap events into displayable data
 * and for batch processing during cleanup jobs.
 */

import type { HeatmapDataPayload, HeatmapPoint, RawHeatmapEvent, ViewportBreakpoint } from "@/types/behavior";

// Grid dimensions for aggregation
const GRID_WIDTH = 100;
const GRID_HEIGHT = 100;

/**
 * Aggregate raw heatmap events into a grid-based heatmap
 */
export function aggregateHeatmapEvents(
  events: RawHeatmapEvent[],
  type: "click" | "scroll" | "move"
): HeatmapDataPayload {
  const grid = new Map<string, number>();
  let maxCount = 0;

  for (const event of events) {
    if (event.type !== type) continue;

    // Normalize coordinates to grid
    const gridX = Math.floor((event.x / event.viewportWidth) * GRID_WIDTH);
    const gridY = Math.floor((event.y / event.viewportHeight) * GRID_HEIGHT);

    // Clamp to valid range
    const x = Math.max(0, Math.min(GRID_WIDTH - 1, gridX));
    const y = Math.max(0, Math.min(GRID_HEIGHT - 1, gridY));

    const key = `${x},${y}`;
    const count = (grid.get(key) ?? 0) + 1;
    grid.set(key, count);
    maxCount = Math.max(maxCount, count);
  }

  // Convert to array format
  const points: HeatmapPoint[] = Array.from(grid.entries()).map(([key, count]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, count };
  });

  return {
    points,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    maxCount,
  };
}

/**
 * Merge multiple heatmap data payloads into one
 */
export function mergeHeatmapData(
  payloads: HeatmapDataPayload[]
): HeatmapDataPayload {
  if (payloads.length === 0) {
    return {
      points: [],
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      maxCount: 0,
    };
  }

  if (payloads.length === 1) {
    return payloads[0];
  }

  const grid = new Map<string, number>();
  let maxCount = 0;

  for (const payload of payloads) {
    for (const point of payload.points) {
      const key = `${point.x},${point.y}`;
      const count = (grid.get(key) ?? 0) + point.count;
      grid.set(key, count);
      maxCount = Math.max(maxCount, count);
    }
  }

  const points: HeatmapPoint[] = Array.from(grid.entries()).map(([key, count]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, count };
  });

  return {
    points,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    maxCount,
  };
}

/**
 * Calculate scroll depth from scroll events
 * Returns percentage (0-100) of content viewed
 */
export function calculateScrollDepth(
  events: RawHeatmapEvent[],
  documentHeight: number
): number {
  let maxScrollY = 0;

  for (const event of events) {
    if (event.type === "scroll" && event.y > maxScrollY) {
      maxScrollY = event.y;
    }
  }

  if (documentHeight <= 0) return 0;

  // Add viewport height to max scroll position for accurate depth
  // (user sees content from scrollY to scrollY + viewportHeight)
  const viewportHeight = events[0]?.viewportHeight ?? 800;
  const visibleBottom = maxScrollY + viewportHeight;

  return Math.min(100, Math.round((visibleBottom / documentHeight) * 100));
}

/**
 * Group events by viewport breakpoint
 */
export function groupEventsByViewport(
  events: RawHeatmapEvent[]
): Record<ViewportBreakpoint, RawHeatmapEvent[]> {
  const groups: Record<ViewportBreakpoint, RawHeatmapEvent[]> = {
    desktop: [],
    tablet: [],
    mobile: [],
  };

  for (const event of events) {
    const width = event.viewportWidth;
    let breakpoint: ViewportBreakpoint;

    if (width < 768) {
      breakpoint = "mobile";
    } else if (width < 1024) {
      breakpoint = "tablet";
    } else {
      breakpoint = "desktop";
    }

    groups[breakpoint].push(event);
  }

  return groups;
}

/**
 * Group events by question ID
 */
export function groupEventsByQuestion(
  events: RawHeatmapEvent[]
): Record<string, RawHeatmapEvent[]> {
  const groups: Record<string, RawHeatmapEvent[]> = {};

  for (const event of events) {
    const key = event.questionId ?? "__global__";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(event);
  }

  return groups;
}

/**
 * Calculate attention map from mouse movement events
 * Points with more time spent get higher counts
 */
export function calculateAttentionMap(
  events: RawHeatmapEvent[],
  timeThresholdMs = 500
): HeatmapDataPayload {
  // Sort events by timestamp
  const sortedEvents = [...events].filter((e) => e.type === "move");
  sortedEvents.sort((a, b) => a.timestamp - b.timestamp);

  const grid = new Map<string, number>();
  let maxCount = 0;

  // Calculate time spent at each position
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const event = sortedEvents[i];
    const nextEvent = sortedEvents[i + 1];
    const timeSpent = nextEvent.timestamp - event.timestamp;

    // Only count if user stayed in position for threshold
    if (timeSpent < timeThresholdMs) continue;

    // Normalize to grid
    const gridX = Math.floor((event.x / event.viewportWidth) * GRID_WIDTH);
    const gridY = Math.floor((event.y / event.viewportHeight) * GRID_HEIGHT);
    const x = Math.max(0, Math.min(GRID_WIDTH - 1, gridX));
    const y = Math.max(0, Math.min(GRID_HEIGHT - 1, gridY));

    // Weight by time spent (in seconds)
    const weight = Math.round(timeSpent / 1000);
    const key = `${x},${y}`;
    const count = (grid.get(key) ?? 0) + weight;
    grid.set(key, count);
    maxCount = Math.max(maxCount, count);
  }

  const points: HeatmapPoint[] = Array.from(grid.entries()).map(([key, count]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, count };
  });

  return {
    points,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    maxCount,
  };
}

/**
 * Downsample heatmap data for performance
 * Reduces grid resolution while preserving patterns
 */
export function downsampleHeatmap(
  data: HeatmapDataPayload,
  factor = 2
): HeatmapDataPayload {
  const newWidth = Math.ceil(data.width / factor);
  const newHeight = Math.ceil(data.height / factor);
  const grid = new Map<string, number>();
  let maxCount = 0;

  for (const point of data.points) {
    const newX = Math.floor(point.x / factor);
    const newY = Math.floor(point.y / factor);
    const key = `${newX},${newY}`;
    const count = (grid.get(key) ?? 0) + point.count;
    grid.set(key, count);
    maxCount = Math.max(maxCount, count);
  }

  const points: HeatmapPoint[] = Array.from(grid.entries()).map(([key, count]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, count };
  });

  return {
    points,
    width: newWidth,
    height: newHeight,
    maxCount,
  };
}

/**
 * Filter heatmap points by minimum count threshold
 * Useful for removing noise
 */
export function filterHeatmapByThreshold(
  data: HeatmapDataPayload,
  minCount: number
): HeatmapDataPayload {
  const filteredPoints = data.points.filter((p) => p.count >= minCount);
  const maxCount = filteredPoints.reduce((max, p) => Math.max(max, p.count), 0);

  return {
    points: filteredPoints,
    width: data.width,
    height: data.height,
    maxCount,
  };
}
