"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RawHeatmapEvent, ScrollDepthData, ViewportBreakpoint } from "@/types/behavior";

interface UseHeatmapCaptureOptions {
  surveyId: string;
  sessionToken: string | null;
  enabled?: boolean;
  currentQuestionId?: string;
}

interface UseHeatmapCaptureReturn {
  clickCount: number;
  scrollDepth: number;
  timeOnQuestion: number;
  getScrollDepthData: () => ScrollDepthData[];
}

// Throttle function to limit event frequency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let lastCall = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

function getViewportBreakpoint(): ViewportBreakpoint {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function useHeatmapCapture({
  surveyId,
  sessionToken,
  enabled = true,
  currentQuestionId,
}: UseHeatmapCaptureOptions): UseHeatmapCaptureReturn {
  const [clickCount, setClickCount] = useState(0);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [timeOnQuestion, setTimeOnQuestion] = useState(0);

  const eventsRef = useRef<RawHeatmapEvent[]>([]);
  const scrollDepthDataRef = useRef<Map<string, ScrollDepthData>>(new Map());
  const questionStartTimeRef = useRef<number>(Date.now());
  const maxScrollYRef = useRef<number>(0);

  // Reset tracking when question changes
  useEffect(() => {
    if (currentQuestionId) {
      // Save previous question's data
      if (scrollDepthDataRef.current.has(currentQuestionId)) {
        const existing = scrollDepthDataRef.current.get(currentQuestionId)!;
        existing.timeSpent += Date.now() - questionStartTimeRef.current;
      } else {
        scrollDepthDataRef.current.set(currentQuestionId, {
          questionId: currentQuestionId,
          maxDepth: 0,
          timeSpent: 0,
        });
      }

      // Reset for new question
      questionStartTimeRef.current = Date.now();
      maxScrollYRef.current = 0;
      setTimeOnQuestion(0);
    }
  }, [currentQuestionId]);

  // Track time on current question
  useEffect(() => {
    if (!enabled || !currentQuestionId) return;

    const interval = setInterval(() => {
      setTimeOnQuestion(Date.now() - questionStartTimeRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, currentQuestionId]);

  // Handle click events
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!enabled || !sessionToken) return;

      const target = event.target as HTMLElement;

      // Get relative position within the survey container
      const surveyContainer = document.querySelector("[data-survey-container]");
      const rect = surveyContainer?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
      };

      const heatmapEvent: RawHeatmapEvent = {
        type: "click",
        x: event.clientX - rect.left,
        y: event.clientY - rect.top + window.scrollY,
        timestamp: Date.now(),
        questionId: currentQuestionId,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      eventsRef.current.push(heatmapEvent);
      setClickCount((prev) => prev + 1);

      // Store click target info for debugging
      console.debug("Heatmap click:", {
        ...heatmapEvent,
        target: target.tagName,
        targetId: target.id,
      });
    },
    [enabled, sessionToken, currentQuestionId]
  );

  // Handle scroll events (throttled)
  const handleScroll = useCallback(
    throttle(() => {
      if (!enabled || !sessionToken) return;

      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const maxScroll = documentHeight - viewportHeight;
      const depth = maxScroll > 0 ? Math.round((scrollY / maxScroll) * 100) : 0;

      // Update max scroll for current question
      if (scrollY > maxScrollYRef.current) {
        maxScrollYRef.current = scrollY;

        if (currentQuestionId) {
          const data = scrollDepthDataRef.current.get(currentQuestionId);
          if (data) {
            data.maxDepth = Math.max(data.maxDepth, depth);
          }
        }
      }

      setScrollDepth(depth);

      const heatmapEvent: RawHeatmapEvent = {
        type: "scroll",
        x: 0,
        y: scrollY,
        timestamp: Date.now(),
        questionId: currentQuestionId,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      eventsRef.current.push(heatmapEvent);
    }, 150),
    [enabled, sessionToken, currentQuestionId]
  );

  // Handle mouse move events (heavily throttled)
  const handleMouseMove = useCallback(
    throttle((event: MouseEvent) => {
      if (!enabled || !sessionToken) return;

      const surveyContainer = document.querySelector("[data-survey-container]");
      const rect = surveyContainer?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
      };

      const heatmapEvent: RawHeatmapEvent = {
        type: "move",
        x: event.clientX - rect.left,
        y: event.clientY - rect.top + window.scrollY,
        timestamp: Date.now(),
        questionId: currentQuestionId,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      eventsRef.current.push(heatmapEvent);
    }, 100),
    [enabled, sessionToken, currentQuestionId]
  );

  // Attach event listeners
  useEffect(() => {
    if (!enabled || !sessionToken) return;

    document.addEventListener("click", handleClick);
    document.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [enabled, sessionToken, handleClick, handleScroll, handleMouseMove]);

  // Upload heatmap events periodically
  useEffect(() => {
    if (!enabled || !sessionToken) return;

    const uploadEvents = async () => {
      if (eventsRef.current.length === 0) return;

      const events = eventsRef.current;
      eventsRef.current = [];

      try {
        await fetch(`/api/surveys/${surveyId}/behavior/heatmaps/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionToken,
            events,
            viewport: getViewportBreakpoint(),
          }),
        });
      } catch (error) {
        console.error("Failed to upload heatmap events:", error);
        // Re-add events to buffer
        eventsRef.current = [...events, ...eventsRef.current];
      }
    };

    const interval = setInterval(uploadEvents, 10000);

    // Upload on page unload
    const handleUnload = () => {
      if (eventsRef.current.length > 0) {
        navigator.sendBeacon(
          `/api/surveys/${surveyId}/behavior/heatmaps/events`,
          JSON.stringify({
            sessionToken,
            events: eventsRef.current,
            viewport: getViewportBreakpoint(),
          })
        );
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [enabled, surveyId, sessionToken]);

  // Get scroll depth data for all questions
  const getScrollDepthData = useCallback((): ScrollDepthData[] => {
    // Update current question's time spent
    if (currentQuestionId) {
      const data = scrollDepthDataRef.current.get(currentQuestionId);
      if (data) {
        data.timeSpent += Date.now() - questionStartTimeRef.current;
        questionStartTimeRef.current = Date.now();
      }
    }

    return Array.from(scrollDepthDataRef.current.values());
  }, [currentQuestionId]);

  return {
    clickCount,
    scrollDepth,
    timeOnQuestion,
    getScrollDepthData,
  };
}
