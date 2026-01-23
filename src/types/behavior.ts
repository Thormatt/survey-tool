import type { eventWithTime } from "@rrweb/types";

// Viewport breakpoints for heatmap data
export type ViewportBreakpoint = "desktop" | "tablet" | "mobile";

// Device info captured during recording
export interface DeviceInfo {
  type: ViewportBreakpoint;
  browser: string;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
}

// Recording session state
export type RecordingState = "idle" | "waiting_consent" | "recording" | "paused" | "stopped";

// Behavior settings from the API
export interface BehaviorSettings {
  id: string;
  surveyId: string;
  recordingEnabled: boolean;
  heatmapsEnabled: boolean;
  consentRequired: boolean;
  consentText: string | null;
  samplingRate: number;
  retentionDays: number;
  maskInputs: boolean;
}

// Session recording metadata
export interface SessionRecordingMeta {
  id: string;
  surveyId: string;
  responseId: string | null;
  sessionToken: string;
  duration: number | null;
  eventCount: number;
  eventsUrl: string | null;
  deviceType: string | null;
  browser: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  status: "RECORDING" | "PROCESSING" | "READY" | "FAILED" | "EXPIRED";
  consentGiven: boolean;
  startedAt: string;
  endedAt: string | null;
}

// Heatmap data point
export interface HeatmapPoint {
  x: number;
  y: number;
  count: number;
}

// Aggregated heatmap data
export interface HeatmapDataPayload {
  points: HeatmapPoint[];
  width: number;
  height: number;
  maxCount: number;
}

// Heatmap record from database
export interface HeatmapRecord {
  id: string;
  surveyId: string;
  questionId: string | null;
  type: "CLICK" | "SCROLL" | "MOVE" | "ATTENTION";
  data: HeatmapDataPayload;
  viewportBreakpoint: ViewportBreakpoint;
  sessionCount: number;
  periodStart: string;
  periodEnd: string;
}

// Event batch for upload
export interface EventBatch {
  sessionToken: string;
  events: eventWithTime[];
  timestamp: number;
  isCheckpoint: boolean;
}

// Compressed event batch for upload
export interface CompressedEventBatch {
  sessionToken: string;
  compressed: string; // Base64 encoded compressed data
  eventCount: number;
  timestamp: number;
  isCheckpoint: boolean;
}

// Recording start response from API
export interface StartRecordingResponse {
  sessionToken: string;
  settings: BehaviorSettings;
  shouldRecord: boolean; // false if sampling excludes this session
}

// Heatmap capture event types
export type HeatmapEventType = "click" | "scroll" | "move";

// Raw heatmap event (before aggregation)
export interface RawHeatmapEvent {
  type: HeatmapEventType;
  x: number;
  y: number;
  timestamp: number;
  questionId?: string;
  viewportWidth: number;
  viewportHeight: number;
}

// Scroll depth data
export interface ScrollDepthData {
  questionId: string;
  maxDepth: number; // 0-100 percentage
  timeSpent: number; // milliseconds
}

// Session timeline event for player UI
export interface TimelineEvent {
  timestamp: number;
  type: "click" | "input" | "scroll" | "navigation" | "error";
  label: string;
  questionId?: string;
}

// Session playback state
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  totalTime: number;
  speed: number;
  skipInactivity: boolean;
}

// Filter options for session list
export interface RecordingFilters {
  status?: SessionRecordingMeta["status"];
  deviceType?: ViewportBreakpoint;
  dateFrom?: string;
  dateTo?: string;
  hasResponse?: boolean;
}

// Behavior insights summary
export interface BehaviorInsights {
  totalRecordings: number;
  totalDuration: number;
  averageDuration: number;
  deviceBreakdown: Record<ViewportBreakpoint, number>;
  completionRate: number; // Percentage with associated response
}
