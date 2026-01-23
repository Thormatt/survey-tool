/**
 * Event serialization and compression utilities
 *
 * Handles compression of rrweb events for efficient storage and transmission.
 * Uses pako for gzip compression.
 */

import pako from "pako";
import type { eventWithTime } from "@rrweb/types";
import type { CompressedEventBatch, EventBatch } from "@/types/behavior";

// Maximum batch size before forcing upload (in bytes, uncompressed)
const MAX_BATCH_SIZE = 500 * 1024; // 500KB

// Maximum events per batch
const MAX_EVENTS_PER_BATCH = 100;

// Minimum time between batches (ms)
const MIN_BATCH_INTERVAL = 5000;

/**
 * Compress an array of events using gzip
 */
export function compressEvents(events: eventWithTime[]): Uint8Array {
  const json = JSON.stringify(events);
  return pako.gzip(json);
}

/**
 * Decompress events from gzip
 */
export function decompressEvents(data: Uint8Array): eventWithTime[] {
  const json = pako.ungzip(data, { to: "string" });
  return JSON.parse(json);
}

/**
 * Convert compressed data to base64 for transmission
 */
export function toBase64(data: Uint8Array): string {
  // Convert Uint8Array to binary string
  const binary = Array.from(data)
    .map((byte) => String.fromCharCode(byte))
    .join("");
  return btoa(binary);
}

/**
 * Convert base64 back to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create a compressed event batch for upload
 */
export function createCompressedBatch(
  sessionToken: string,
  events: eventWithTime[],
  isCheckpoint: boolean
): CompressedEventBatch {
  const compressed = compressEvents(events);
  return {
    sessionToken,
    compressed: toBase64(compressed),
    eventCount: events.length,
    timestamp: Date.now(),
    isCheckpoint,
  };
}

/**
 * Parse a compressed event batch
 */
export function parseCompressedBatch(batch: CompressedEventBatch): EventBatch {
  const data = fromBase64(batch.compressed);
  const events = decompressEvents(data);
  return {
    sessionToken: batch.sessionToken,
    events,
    timestamp: batch.timestamp,
    isCheckpoint: batch.isCheckpoint,
  };
}

/**
 * Calculate approximate size of events in bytes
 */
export function estimateEventSize(events: eventWithTime[]): number {
  // Rough estimate: JSON stringify length is close to byte size for ASCII
  return JSON.stringify(events).length;
}

/**
 * Event buffer for batching before upload
 */
export class EventBuffer {
  private events: eventWithTime[] = [];
  private lastBatchTime = 0;
  private sessionToken: string;
  private onBatchReady: (batch: CompressedEventBatch) => void;

  constructor(
    sessionToken: string,
    onBatchReady: (batch: CompressedEventBatch) => void
  ) {
    this.sessionToken = sessionToken;
    this.onBatchReady = onBatchReady;
  }

  /**
   * Add an event to the buffer
   */
  add(event: eventWithTime): void {
    this.events.push(event);
    this.checkFlush(false);
  }

  /**
   * Add multiple events to the buffer
   */
  addBatch(events: eventWithTime[]): void {
    this.events.push(...events);
    this.checkFlush(false);
  }

  /**
   * Check if buffer should be flushed
   */
  private checkFlush(force: boolean): void {
    const now = Date.now();
    const timeSinceLastBatch = now - this.lastBatchTime;
    const eventCount = this.events.length;
    const estimatedSize = estimateEventSize(this.events);

    const shouldFlush =
      force ||
      eventCount >= MAX_EVENTS_PER_BATCH ||
      estimatedSize >= MAX_BATCH_SIZE ||
      (eventCount > 0 && timeSinceLastBatch >= MIN_BATCH_INTERVAL);

    if (shouldFlush && eventCount > 0) {
      this.flush(force);
    }
  }

  /**
   * Flush the buffer and send batch
   */
  flush(isCheckpoint: boolean): void {
    if (this.events.length === 0) return;

    const batch = createCompressedBatch(
      this.sessionToken,
      this.events,
      isCheckpoint
    );

    this.events = [];
    this.lastBatchTime = Date.now();

    this.onBatchReady(batch);
  }

  /**
   * Get current event count
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Clear the buffer without sending
   */
  clear(): void {
    this.events = [];
  }
}

/**
 * Merge multiple event files into one
 * Used during processing to combine checkpoint files
 */
export function mergeEventFiles(files: eventWithTime[][]): eventWithTime[] {
  const merged = files.flat();
  // Sort by timestamp to ensure correct playback order
  merged.sort((a, b) => a.timestamp - b.timestamp);
  return merged;
}

/**
 * Calculate recording duration from events
 */
export function calculateDuration(events: eventWithTime[]): number {
  if (events.length < 2) return 0;
  const first = events[0].timestamp;
  const last = events[events.length - 1].timestamp;
  return last - first;
}

/**
 * Extract metadata from events for indexing
 */
export function extractEventMetadata(events: eventWithTime[]): {
  duration: number;
  eventCount: number;
  hasUserInteraction: boolean;
  scrollDepth: number;
} {
  const duration = calculateDuration(events);
  const eventCount = events.length;

  let hasUserInteraction = false;
  let maxScrollY = 0;
  let viewportHeight = 0;

  for (const event of events) {
    // Check for user interaction events (type 3 = incremental snapshot)
    if (event.type === 3) {
      const data = event.data as { source?: number; y?: number };
      // Source 1 = mouse movement, 2 = mouse interaction, 5 = input
      if (data.source === 1 || data.source === 2 || data.source === 5) {
        hasUserInteraction = true;
      }
      // Source 3 = scroll
      if (data.source === 3 && typeof data.y === "number") {
        maxScrollY = Math.max(maxScrollY, data.y);
      }
    }

    // Get viewport height from meta events (type 4)
    if (event.type === 4) {
      const data = event.data as { height?: number };
      if (data.height) {
        viewportHeight = data.height;
      }
    }
  }

  // Calculate scroll depth as percentage
  const scrollDepth =
    viewportHeight > 0 ? Math.min(100, (maxScrollY / viewportHeight) * 100) : 0;

  return {
    duration,
    eventCount,
    hasUserInteraction,
    scrollDepth: Math.round(scrollDepth),
  };
}
