"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { eventWithTime } from "@rrweb/types";
import type {
  BehaviorSettings,
  CompressedEventBatch,
  DeviceInfo,
  RecordingState,
  StartRecordingResponse,
  ViewportBreakpoint,
} from "@/types/behavior";
import { getPrivacyConfig, hasStoredConsent, isRecordingAllowed, storeConsent } from "@/lib/behavior/privacy";
import { EventBuffer } from "@/lib/behavior/serializer";

interface UseSessionRecorderOptions {
  surveyId: string;
  enabled?: boolean;
  onConsentRequired?: (settings: BehaviorSettings) => void;
  onError?: (error: Error) => void;
}

interface UseSessionRecorderReturn {
  state: RecordingState;
  sessionToken: string | null;
  eventCount: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  giveConsent: () => void;
  denyConsent: () => void;
  linkResponse: (responseId: string) => Promise<void>;
}

function getDeviceType(width: number): ViewportBreakpoint {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  let browser = "Unknown";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";

  return {
    type: getDeviceType(window.innerWidth),
    browser,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    userAgent: ua,
  };
}

export function useSessionRecorder({
  surveyId,
  enabled = true,
  onConsentRequired,
  onError,
}: UseSessionRecorderOptions): UseSessionRecorderReturn {
  const [state, setState] = useState<RecordingState>("idle");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [settings, setSettings] = useState<BehaviorSettings | null>(null);

  const stopFnRef = useRef<(() => void) | null>(null);
  const bufferRef = useRef<EventBuffer | null>(null);
  const pendingBatchesRef = useRef<CompressedEventBatch[]>([]);
  const isSendingRef = useRef(false);

  // Upload a batch of events
  const uploadBatch = useCallback(
    async (batch: CompressedEventBatch) => {
      try {
        const response = await fetch(
          `/api/surveys/${surveyId}/behavior/recordings/${batch.sessionToken}/events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }
      } catch (error) {
        console.error("Failed to upload event batch:", error);
        // Re-queue failed batch
        pendingBatchesRef.current.push(batch);
      }
    },
    [surveyId]
  );

  // Process pending batches
  const processPendingBatches = useCallback(async () => {
    if (isSendingRef.current || pendingBatchesRef.current.length === 0) return;

    isSendingRef.current = true;
    while (pendingBatchesRef.current.length > 0) {
      const batch = pendingBatchesRef.current.shift();
      if (batch) {
        await uploadBatch(batch);
      }
    }
    isSendingRef.current = false;
  }, [uploadBatch]);

  // Handle batch ready from buffer
  const handleBatchReady = useCallback(
    (batch: CompressedEventBatch) => {
      setEventCount((prev) => prev + batch.eventCount);
      pendingBatchesRef.current.push(batch);
      processPendingBatches();
    },
    [processPendingBatches]
  );

  // Start the recording session
  const initializeRecording = useCallback(async () => {
    if (!sessionToken || !settings) return;

    try {
      // Dynamic import rrweb to avoid SSR issues
      const { record } = await import("rrweb");

      // Create event buffer
      bufferRef.current = new EventBuffer(sessionToken, handleBatchReady);

      // Get privacy configuration
      const privacyConfig = getPrivacyConfig({ maskInputs: settings.maskInputs });

      // Start recording
      const recordConfig = {
        emit: (event: eventWithTime) => {
          bufferRef.current?.add(event);
        },
        ...privacyConfig,
        // Sample mouse movements to reduce data
        sampling: {
          mousemove: 50, // Record mouse position every 50ms
          mouseInteraction: true,
          scroll: 150, // Record scroll every 150ms
          input: "last" as const, // Record last input value
        },
        // Don't record canvas to reduce size
        recordCanvas: false,
        // Inline stylesheets for accurate replay
        inlineStylesheet: true,
        // Collect fonts for accurate replay
        collectFonts: true,
      };

      stopFnRef.current = record(recordConfig) ?? null;
      setState("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      onError?.(error instanceof Error ? error : new Error("Recording failed"));
      setState("idle");
    }
  }, [sessionToken, settings, handleBatchReady, onError]);

  // Start recording - called by the survey page
  const startRecording = useCallback(async () => {
    if (!enabled || state !== "idle") return;

    // Check if recording is allowed by browser signals
    if (!isRecordingAllowed()) {
      console.log("Recording blocked by privacy settings");
      return;
    }

    try {
      // Start a recording session
      const deviceInfo = getDeviceInfo();
      const response = await fetch(`/api/surveys/${surveyId}/behavior/recordings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deviceInfo),
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Behavior tracking not enabled for this survey
          return;
        }
        throw new Error(`Failed to start recording: ${response.status}`);
      }

      const data: StartRecordingResponse = await response.json();

      // Check if this session was sampled out
      if (!data.shouldRecord) {
        return;
      }

      setSessionToken(data.sessionToken);
      setSettings(data.settings);

      // Check if consent is required
      if (data.settings.consentRequired) {
        // Check for stored consent
        if (hasStoredConsent(surveyId)) {
          // Already have consent, start recording
          await initializeRecording();
        } else {
          // Need consent
          setState("waiting_consent");
          onConsentRequired?.(data.settings);
        }
      } else {
        // No consent required, start immediately
        await initializeRecording();
      }
    } catch (error) {
      console.error("Failed to start recording session:", error);
      onError?.(error instanceof Error ? error : new Error("Session start failed"));
    }
  }, [enabled, state, surveyId, initializeRecording, onConsentRequired, onError]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (state !== "recording" || !stopFnRef.current) return;

    // Stop rrweb recording
    stopFnRef.current();
    stopFnRef.current = null;

    // Flush remaining events
    bufferRef.current?.flush(true);
    setState("stopped");

    // Wait for pending batches to upload
    await processPendingBatches();

    // Notify server that recording is complete
    if (sessionToken) {
      try {
        await fetch(`/api/surveys/${surveyId}/behavior/recordings/${sessionToken}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionToken,
            compressed: "",
            eventCount: 0,
            timestamp: Date.now(),
            isCheckpoint: true,
            isComplete: true,
          }),
        });
      } catch (error) {
        console.error("Failed to mark recording complete:", error);
      }
    }
  }, [state, sessionToken, surveyId, processPendingBatches]);

  // Give consent and start recording
  const giveConsent = useCallback(() => {
    if (state !== "waiting_consent") return;

    storeConsent(surveyId, true, settings?.retentionDays ?? 30);

    // Notify server of consent
    if (sessionToken) {
      fetch(`/api/surveys/${surveyId}/behavior/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, consent: true }),
      }).catch(console.error);
    }

    initializeRecording();
  }, [state, surveyId, sessionToken, settings, initializeRecording]);

  // Deny consent
  const denyConsent = useCallback(() => {
    if (state !== "waiting_consent") return;

    storeConsent(surveyId, false, settings?.retentionDays ?? 30);
    setState("idle");
    setSessionToken(null);
    setSettings(null);
  }, [state, surveyId, settings]);

  // Link recording to a response
  const linkResponse = useCallback(
    async (responseId: string) => {
      if (!sessionToken) return;

      try {
        await fetch(
          `/api/surveys/${surveyId}/behavior/recordings/${sessionToken}/events`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ responseId }),
          }
        );
      } catch (error) {
        console.error("Failed to link response:", error);
      }
    },
    [surveyId, sessionToken]
  );

  // Handle page unload - send remaining events
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (bufferRef.current && state === "recording") {
        // Use sendBeacon for reliable delivery on page unload
        bufferRef.current.flush(true);

        const batches = pendingBatchesRef.current;
        for (const batch of batches) {
          navigator.sendBeacon(
            `/api/surveys/${surveyId}/behavior/recordings/${batch.sessionToken}/events`,
            JSON.stringify(batch)
          );
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [surveyId, state]);

  // Periodic batch processing
  useEffect(() => {
    const interval = setInterval(processPendingBatches, 5000);
    return () => clearInterval(interval);
  }, [processPendingBatches]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopFnRef.current) {
        stopFnRef.current();
      }
      bufferRef.current?.clear();
    };
  }, []);

  return {
    state,
    sessionToken,
    eventCount,
    startRecording,
    stopRecording,
    giveConsent,
    denyConsent,
    linkResponse,
  };
}
