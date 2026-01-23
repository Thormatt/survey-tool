"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipForward,
  Maximize2,
  Minimize2,
  Monitor,
  Tablet,
  Smartphone,
  Clock,
  MousePointer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionRecordingMeta, PlaybackState } from "@/types/behavior";

interface SessionPlayerProps {
  recording: SessionRecordingMeta;
  eventsUrl: string;
  onClose?: () => void;
}

const PLAYBACK_SPEEDS = [1, 2, 4, 8];

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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

export function SessionPlayer({
  recording,
  eventsUrl,
  onClose,
}: SessionPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    totalTime: recording.duration ?? 0,
    speed: 1,
    skipInactivity: true,
  });

  // Load events and initialize player
  useEffect(() => {
    let mounted = true;

    async function loadPlayer() {
      try {
        // Fetch events
        const response = await fetch(eventsUrl);
        if (!response.ok) throw new Error("Failed to fetch recording");

        const compressedData = await response.arrayBuffer();

        // Decompress
        const pako = await import("pako");
        const json = pako.ungzip(new Uint8Array(compressedData), {
          to: "string",
        });
        const events = JSON.parse(json);

        if (!mounted || events.length === 0) {
          setError("No events in recording");
          return;
        }

        // Dynamic import rrweb-player
        const rrwebPlayer = await import("rrweb-player");
        const RRWebPlayer = rrwebPlayer.default;

        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        // Create player
        const player = new RRWebPlayer({
          target: containerRef.current!,
          props: {
            events,
            width: containerRef.current!.clientWidth,
            height: containerRef.current!.clientHeight - 80, // Leave room for controls
            autoPlay: false,
            skipInactive: playbackState.skipInactivity,
            showController: false, // We'll use our own controls
            speed: playbackState.speed,
          },
        });

        playerRef.current = player;

        // Listen for player events
        player.addEventListener("ui-update-current-time", (payload: { payload: number }) => {
          if (mounted) {
            setPlaybackState((prev) => ({
              ...prev,
              currentTime: payload.payload,
            }));
          }
        });

        player.addEventListener("finish", () => {
          if (mounted) {
            setPlaybackState((prev) => ({
              ...prev,
              isPlaying: false,
            }));
          }
        });

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load player:", err);
        if (mounted) {
          setError("Failed to load recording");
          setIsLoading(false);
        }
      }
    }

    loadPlayer();

    return () => {
      mounted = false;
      if (playerRef.current) {
        try {
          // @ts-expect-error - rrweb-player types
          playerRef.current.$destroy?.();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [eventsUrl, playbackState.skipInactivity, playbackState.speed]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = playerRef.current as any;

    if (playbackState.isPlaying) {
      player.pause();
    } else {
      player.play();
    }

    setPlaybackState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  }, [playbackState.isPlaying]);

  // Handle speed change
  const cycleSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackState.speed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];

    if (playerRef.current) {
      // @ts-expect-error - rrweb-player types
      playerRef.current.setSpeed(newSpeed);
    }

    setPlaybackState((prev) => ({
      ...prev,
      speed: newSpeed,
    }));
  }, [playbackState.speed]);

  // Handle timeline seek
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!playerRef.current) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const time = percent * playbackState.totalTime;

      // @ts-expect-error - rrweb-player types
      playerRef.current.goto(time);

      setPlaybackState((prev) => ({
        ...prev,
        currentTime: time,
      }));
    },
    [playbackState.totalTime]
  );

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Toggle skip inactivity
  const toggleSkipInactivity = useCallback(() => {
    setPlaybackState((prev) => ({
      ...prev,
      skipInactivity: !prev.skipInactivity,
    }));
  }, []);

  const progress =
    playbackState.totalTime > 0
      ? (playbackState.currentTime / playbackState.totalTime) * 100
      : 0;

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {getDeviceIcon(recording.deviceType)}
          <span className="text-sm text-gray-300">
            {recording.browser || "Unknown Browser"}
          </span>
          <span className="text-sm text-gray-500">
            {recording.viewportWidth}x{recording.viewportHeight}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">
            {formatDuration(recording.duration ?? 0)}
          </span>
          <span className="text-sm text-gray-500 ml-2">
            {recording.eventCount} events
          </span>
        </div>
      </div>

      {/* Player container */}
      <div ref={containerRef} className="flex-1 relative bg-black">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
        {/* Timeline */}
        <div
          className="h-2 bg-gray-700 rounded-full cursor-pointer mb-3 overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={togglePlay}
              className="text-white hover:bg-gray-700"
              disabled={isLoading || !!error}
            >
              {playbackState.isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={cycleSpeed}
              className="text-white hover:bg-gray-700 min-w-[48px]"
              disabled={isLoading || !!error}
            >
              {playbackState.speed}x
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={toggleSkipInactivity}
              className={`text-white hover:bg-gray-700 ${
                playbackState.skipInactivity
                  ? "bg-blue-600 hover:bg-blue-700"
                  : ""
              }`}
              title="Skip inactivity"
              disabled={isLoading || !!error}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {formatDuration(playbackState.currentTime)} /{" "}
              {formatDuration(playbackState.totalTime)}
            </span>

            <Button
              size="sm"
              variant="ghost"
              onClick={toggleFullscreen}
              className="text-white hover:bg-gray-700"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Response link */}
      {recording.responseId && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center gap-2">
          <MousePointer className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">
            Linked to response:{" "}
            <a
              href={`/surveys/${recording.surveyId}/results?response=${recording.responseId}`}
              className="text-blue-400 hover:underline"
            >
              View response
            </a>
          </span>
        </div>
      )}
    </div>
  );
}
