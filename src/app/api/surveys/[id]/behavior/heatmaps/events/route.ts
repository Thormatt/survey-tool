import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import type { RawHeatmapEvent, ViewportBreakpoint } from "@/types/behavior";

const heatmapEventsSchema = z.object({
  sessionToken: z.string(),
  events: z.array(
    z.object({
      type: z.enum(["click", "scroll", "move"]),
      x: z.number(),
      y: z.number(),
      timestamp: z.number(),
      questionId: z.string().optional(),
      viewportWidth: z.number(),
      viewportHeight: z.number(),
    })
  ),
  viewport: z.enum(["desktop", "tablet", "mobile"]),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Grid size for aggregation (100x100 cells)
const GRID_SIZE = 100;

/**
 * POST /api/surveys/[id]/behavior/heatmaps/events
 * Upload raw heatmap events (public - for survey respondents)
 */
export async function POST(request: Request, context: RouteParams) {
  try {
    const { id: surveyId } = await context.params;

    // Check if heatmaps are enabled for this survey
    const settings = await db.behaviorSettings.findUnique({
      where: { surveyId },
    });

    if (!settings || !settings.heatmapsEnabled) {
      return NextResponse.json(
        { error: "Heatmaps not enabled for this survey" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { sessionToken, events, viewport } = heatmapEventsSchema.parse(body);

    // Verify the session exists
    const recording = await db.sessionRecording.findUnique({
      where: { sessionToken },
      select: { id: true, surveyId: true },
    });

    if (!recording || recording.surveyId !== surveyId) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    // Group events by type and question
    const groupedEvents = groupEventsByTypeAndQuestion(events);

    // Update heatmap data for each group
    for (const [key, groupEvents] of Object.entries(groupedEvents)) {
      const [type, questionId] = key.split("|");
      await updateHeatmapData(
        surveyId,
        questionId === "null" ? null : questionId,
        type as "click" | "scroll" | "move",
        viewport,
        groupEvents
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error uploading heatmap events:", error);
    return NextResponse.json(
      { error: "Failed to upload heatmap events" },
      { status: 500 }
    );
  }
}

/**
 * Group events by type and question ID
 */
function groupEventsByTypeAndQuestion(
  events: RawHeatmapEvent[]
): Record<string, RawHeatmapEvent[]> {
  const groups: Record<string, RawHeatmapEvent[]> = {};

  for (const event of events) {
    const key = `${event.type}|${event.questionId ?? "null"}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(event);
  }

  return groups;
}

/**
 * Update aggregated heatmap data with new events
 */
async function updateHeatmapData(
  surveyId: string,
  questionId: string | null,
  type: "click" | "scroll" | "move",
  viewport: ViewportBreakpoint,
  events: RawHeatmapEvent[]
) {
  const heatmapType = type.toUpperCase() as "CLICK" | "SCROLL" | "MOVE";

  // Get existing heatmap data
  const existing = await db.heatmapData.findUnique({
    where: {
      surveyId_questionId_type_viewportBreakpoint: {
        surveyId,
        questionId: questionId ?? "",
        type: heatmapType,
        viewportBreakpoint: viewport,
      },
    },
  });

  // Parse existing data or create new
  let data: {
    points: Map<string, number>;
    width: number;
    height: number;
    maxCount: number;
  };

  if (existing) {
    const existingData = existing.data as {
      points: Array<{ x: number; y: number; count: number }>;
      width: number;
      height: number;
      maxCount: number;
    };
    data = {
      points: new Map(
        existingData.points.map((p) => [`${p.x},${p.y}`, p.count])
      ),
      width: existingData.width,
      height: existingData.height,
      maxCount: existingData.maxCount,
    };
  } else {
    data = {
      points: new Map(),
      width: GRID_SIZE,
      height: GRID_SIZE,
      maxCount: 0,
    };
  }

  // Add new events to the grid
  for (const event of events) {
    // Normalize to grid coordinates
    const gridX = Math.floor((event.x / event.viewportWidth) * GRID_SIZE);
    const gridY = Math.floor((event.y / event.viewportHeight) * GRID_SIZE);

    // Clamp to valid range
    const x = Math.max(0, Math.min(GRID_SIZE - 1, gridX));
    const y = Math.max(0, Math.min(GRID_SIZE - 1, gridY));

    const key = `${x},${y}`;
    const count = (data.points.get(key) ?? 0) + 1;
    data.points.set(key, count);
    data.maxCount = Math.max(data.maxCount, count);
  }

  // Convert map back to array
  const pointsArray = Array.from(data.points.entries()).map(([key, count]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, count };
  });

  // Calculate period (current day)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 1);

  // Upsert heatmap data
  await db.heatmapData.upsert({
    where: {
      surveyId_questionId_type_viewportBreakpoint: {
        surveyId,
        questionId: questionId ?? "",
        type: heatmapType,
        viewportBreakpoint: viewport,
      },
    },
    create: {
      surveyId,
      questionId: questionId ?? null,
      type: heatmapType,
      viewportBreakpoint: viewport,
      data: {
        points: pointsArray,
        width: GRID_SIZE,
        height: GRID_SIZE,
        maxCount: data.maxCount,
      },
      sessionCount: 1,
      periodStart,
      periodEnd,
    },
    update: {
      data: {
        points: pointsArray,
        width: GRID_SIZE,
        height: GRID_SIZE,
        maxCount: data.maxCount,
      },
      sessionCount: { increment: 1 },
      periodEnd,
    },
  });
}
