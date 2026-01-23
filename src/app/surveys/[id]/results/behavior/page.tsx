"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Video,
  MousePointer,
  Activity,
  Monitor,
  Tablet,
  Smartphone,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/components/behavior/session-list";
import { SessionPlayer } from "@/components/behavior/session-player";
import { HeatmapCanvas } from "@/components/behavior/heatmap-canvas";
import { HeatmapControls } from "@/components/behavior/heatmap-controls";
import type {
  BehaviorSettings,
  SessionRecordingMeta,
  HeatmapRecord,
  BehaviorInsights,
  ViewportBreakpoint,
} from "@/types/behavior";

type ViewMode = "recordings" | "heatmaps";
type HeatmapType = "CLICK" | "SCROLL" | "MOVE" | "ATTENTION";

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export default function BehaviorInsightsPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const [settings, setSettings] = useState<BehaviorSettings | null>(null);
  const [insights, setInsights] = useState<BehaviorInsights | null>(null);
  const [heatmaps, setHeatmaps] = useState<HeatmapRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("recordings");
  const [selectedRecording, setSelectedRecording] = useState<SessionRecordingMeta | null>(null);
  const [selectedHeatmapType, setSelectedHeatmapType] = useState<HeatmapType>("CLICK");
  const [selectedViewport, setSelectedViewport] = useState<ViewportBreakpoint>("desktop");

  // Fetch behavior settings and insights
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [settingsRes, heatmapsRes] = await Promise.all([
        fetch(`/api/surveys/${surveyId}/behavior`),
        fetch(`/api/surveys/${surveyId}/behavior/heatmaps`),
      ]);

      if (!settingsRes.ok) {
        throw new Error("Failed to fetch behavior settings");
      }

      const settingsData = await settingsRes.json();
      setSettings(settingsData);

      if (heatmapsRes.ok) {
        const heatmapsData = await heatmapsRes.json();
        setHeatmaps(heatmapsData.heatmaps);
        setInsights({
          totalRecordings: heatmapsData.stats.totalRecordings,
          totalDuration: heatmapsData.stats.totalDuration,
          averageDuration: heatmapsData.stats.averageDuration,
          deviceBreakdown: heatmapsData.stats.deviceBreakdown,
          completionRate: 0, // Calculate from recordings
        });
      }
    } catch (err) {
      console.error("Error fetching behavior data:", err);
      setError("Failed to load behavior insights");
    } finally {
      setIsLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get filtered heatmap for display
  const selectedHeatmap = heatmaps.find(
    (h) =>
      h.type === selectedHeatmapType &&
      h.viewportBreakpoint === selectedViewport &&
      h.questionId === null // Survey-level heatmap
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-gray-600">{error || "Behavior tracking not configured"}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/surveys/${surveyId}/edit`)}
        >
          Configure Behavior Tracking
        </Button>
      </div>
    );
  }

  // Show player if recording is selected
  if (selectedRecording && selectedRecording.eventsUrl) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex items-center gap-4 px-6 py-4 border-b bg-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRecording(null)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to list
          </Button>
          <span className="text-sm text-gray-500">
            Recording from{" "}
            {new Date(selectedRecording.startedAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex-1 p-6">
          <SessionPlayer
            recording={selectedRecording}
            eventsUrl={selectedRecording.eventsUrl}
            onClose={() => setSelectedRecording(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/surveys/${surveyId}/results`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Results
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Behavior Insights
                </h1>
                <p className="text-sm text-gray-500">
                  Session recordings and heatmaps
                </p>
              </div>
            </div>
            <Link href={`/surveys/${surveyId}/edit`}>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats overview */}
      {insights && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Video className="w-4 h-4" />
                <span className="text-sm">Total Recordings</span>
              </div>
              <p className="text-2xl font-semibold">{insights.totalRecordings}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Avg. Duration</span>
              </div>
              <p className="text-2xl font-semibold">
                {formatDuration(insights.averageDuration)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm">Device Split</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {insights.deviceBreakdown.desktop && (
                  <span className="flex items-center gap-1">
                    <Monitor className="w-3 h-3" />
                    {insights.deviceBreakdown.desktop}
                  </span>
                )}
                {insights.deviceBreakdown.tablet && (
                  <span className="flex items-center gap-1">
                    <Tablet className="w-3 h-3" />
                    {insights.deviceBreakdown.tablet}
                  </span>
                )}
                {insights.deviceBreakdown.mobile && (
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    {insights.deviceBreakdown.mobile}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Total Watch Time</span>
              </div>
              <p className="text-2xl font-semibold">
                {formatDuration(insights.totalDuration)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View mode tabs */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setViewMode("recordings")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === "recordings"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Video className="w-4 h-4 inline mr-2" />
            Recordings
          </button>
          <button
            onClick={() => setViewMode("heatmaps")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === "heatmaps"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <MousePointer className="w-4 h-4 inline mr-2" />
            Heatmaps
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {viewMode === "recordings" ? (
          <div className="bg-white rounded-lg border h-[600px]">
            <SessionList
              surveyId={surveyId}
              onSelectRecording={setSelectedRecording}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Heatmap controls */}
            <HeatmapControls
              selectedType={selectedHeatmapType}
              selectedViewport={selectedViewport}
              onTypeChange={setSelectedHeatmapType}
              onViewportChange={setSelectedViewport}
            />

            {/* Heatmap display */}
            <div className="bg-white rounded-lg border p-6">
              {selectedHeatmap ? (
                <HeatmapCanvas
                  data={selectedHeatmap.data}
                  width={800}
                  height={600}
                  type={selectedHeatmapType}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                  <MousePointer className="w-12 h-12 mb-4 opacity-50" />
                  <p>No heatmap data available for this configuration</p>
                  <p className="text-sm mt-2">
                    Data will appear after users interact with your survey
                  </p>
                </div>
              )}
            </div>

            {/* Session count */}
            {selectedHeatmap && (
              <p className="text-sm text-gray-500 text-center">
                Based on {selectedHeatmap.sessionCount} sessions
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
