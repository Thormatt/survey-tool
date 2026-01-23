"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Play,
  Monitor,
  Tablet,
  Smartphone,
  Clock,
  Filter,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionRecordingMeta, RecordingFilters, ViewportBreakpoint } from "@/types/behavior";

interface SessionListProps {
  surveyId: string;
  onSelectRecording: (recording: SessionRecordingMeta) => void;
}

interface RecordingWithResponse extends SessionRecordingMeta {
  response?: {
    id: string;
    completedAt: string;
    respondentEmail?: string;
    respondentName?: string;
  } | null;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "0:00";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffHours < 48) {
    return "Yesterday";
  }
  return date.toLocaleDateString();
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case "mobile":
      return <Smartphone className="w-4 h-4" />;
    case "tablet":
      return <Tablet className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
}

function getStatusBadge(status: SessionRecordingMeta["status"]) {
  switch (status) {
    case "READY":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
          <CheckCircle className="w-3 h-3" />
          Ready
        </span>
      );
    case "RECORDING":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording
        </span>
      );
    case "PROCESSING":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
          <AlertCircle className="w-3 h-3" />
          Failed
        </span>
      );
    case "EXPIRED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          Expired
        </span>
      );
    default:
      return null;
  }
}

export function SessionList({ surveyId, onSelectRecording }: SessionListProps) {
  const [recordings, setRecordings] = useState<RecordingWithResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RecordingFilters>({});
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Fetch recordings
  const fetchRecordings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      params.set("offset", offset.toString());

      if (filters.status) params.set("status", filters.status);
      if (filters.deviceType) params.set("deviceType", filters.deviceType);
      if (filters.hasResponse !== undefined) {
        params.set("hasResponse", filters.hasResponse.toString());
      }

      const response = await fetch(
        `/api/surveys/${surveyId}/behavior/recordings?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch recordings");
      }

      const data = await response.json();
      setRecordings(data.recordings);
      setTotal(data.total);
    } catch (err) {
      console.error("Error fetching recordings:", err);
      setError("Failed to load recordings");
    } finally {
      setIsLoading(false);
    }
  }, [surveyId, filters, offset]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // Handle filter changes
  const handleFilterChange = (key: keyof RecordingFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOffset(0);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({});
    setOffset(0);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="flex flex-col h-full">
      {/* Header with filters */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">
            Session Recordings
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({total})
            </span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecordings}
            className="ml-2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? "border-blue-500 text-blue-600" : ""}
        >
          <Filter className="w-4 h-4 mr-1" />
          Filters
          <ChevronDown
            className={`w-4 h-4 ml-1 transition-transform ${
              showFilters ? "rotate-180" : ""
            }`}
          />
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 border-b space-y-3">
          <div className="flex flex-wrap gap-4">
            {/* Status filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={filters.status || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "status",
                    e.target.value || undefined
                  )
                }
                className="text-sm border rounded-md px-2 py-1"
              >
                <option value="">All</option>
                <option value="READY">Ready</option>
                <option value="RECORDING">Recording</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Device filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Device
              </label>
              <select
                value={filters.deviceType || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "deviceType",
                    (e.target.value || undefined) as ViewportBreakpoint | undefined
                  )
                }
                className="text-sm border rounded-md px-2 py-1"
              >
                <option value="">All</option>
                <option value="desktop">Desktop</option>
                <option value="tablet">Tablet</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>

            {/* Has response filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Response
              </label>
              <select
                value={
                  filters.hasResponse === undefined
                    ? ""
                    : filters.hasResponse.toString()
                }
                onChange={(e) =>
                  handleFilterChange(
                    "hasResponse",
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true"
                  )
                }
                className="text-sm border rounded-md px-2 py-1"
              >
                <option value="">All</option>
                <option value="true">With response</option>
                <option value="false">Without response</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Recording list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && recordings.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-red-500">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <p>No recordings found</p>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="mt-2 text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {recordings.map((recording) => (
              <li
                key={recording.id}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() =>
                  recording.status === "READY" && recording.eventsUrl
                    ? onSelectRecording(recording)
                    : null
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Device icon */}
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getDeviceIcon(recording.deviceType)}
                    </div>

                    {/* Recording info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(recording.startedAt)}
                        </span>
                        {getStatusBadge(recording.status)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(recording.duration)}
                        </span>
                        <span>{recording.eventCount} events</span>
                        {recording.browser && <span>{recording.browser}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Play button */}
                  {recording.status === "READY" && recording.eventsUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRecording(recording);
                      }}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Play
                    </Button>
                  )}
                </div>

                {/* Response link */}
                {recording.response && (
                  <div className="mt-2 text-xs text-gray-500 pl-12">
                    Linked to response
                    {recording.response.respondentEmail && (
                      <span> from {recording.response.respondentEmail}</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            {offset + 1} - {Math.min(offset + limit, total)} of {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
