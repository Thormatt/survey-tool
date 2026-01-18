import { useEffect, useRef, useCallback, useState } from "react";

interface Answer {
  id: string;
  questionId: string;
  value: unknown;
  response: {
    completedAt: string;
    respondentEmail?: string | null;
    respondentName?: string | null;
  };
}

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  required: boolean;
  options?: string[] | null;
  settings?: Record<string, unknown> | null;
  answers: Answer[];
}

export interface Survey {
  id: string;
  title: string;
  description?: string | null;
  isAnonymous: boolean;
  createdAt: string;
  questions: Question[];
  _count: {
    responses: number;
  };
}

interface RealtimeMessage {
  type: "connected" | "update" | "heartbeat";
  survey?: Survey;
  newResponses?: number;
}

interface UseRealtimeResultsOptions {
  surveyId: string;
  enabled?: boolean;
  onUpdate?: (survey: Survey, newResponses: number) => void;
}

export function useRealtimeResults({
  surveyId,
  enabled = true,
  onUpdate,
}: UseRealtimeResultsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!enabled || !surveyId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/surveys/${surveyId}/results/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data: RealtimeMessage = JSON.parse(event.data);

        if (data.type === "connected") {
          setIsConnected(true);
        } else if (data.type === "update" && data.survey) {
          setLastUpdate(new Date());
          onUpdate?.(data.survey, data.newResponses || 0);
        }
        // Heartbeat messages just confirm connection is alive
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // Exponential backoff for reconnection
      const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffTime);
    };
  }, [surveyId, enabled, onUpdate]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    lastUpdate,
    disconnect,
    reconnect: connect,
  };
}
