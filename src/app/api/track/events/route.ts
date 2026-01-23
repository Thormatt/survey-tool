import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

interface EventsRequest {
  sessionToken: string;
  events: Array<{
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
  }>;
  metrics: {
    clickCount: number;
    maxScrollDepth: number;
    rageClicks: number;
    deadClicks: number;
    duration: number;
  };
}

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body: EventsRequest = await request.json();

    // Validate required fields
    if (!body.sessionToken || !body.events) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Find the recording session
    const recording = await db.siteRecording.findFirst({
      where: { sessionToken: body.sessionToken },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Update recording with metrics
    // Note: Events are stored in Vercel Blob (eventsUrl field) in production
    // For now, we just update the aggregate metrics
    const newEventCount = recording.eventCount + body.events.length;

    await db.siteRecording.update({
      where: { id: recording.id },
      data: {
        eventCount: newEventCount,
        clickCount: body.metrics.clickCount,
        scrollDepth: body.metrics.maxScrollDepth,
        rageClicks: body.metrics.rageClicks,
        deadClicks: body.metrics.deadClicks,
        duration: Math.floor(body.metrics.duration / 1000), // Convert to seconds
        endedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, eventsReceived: body.events.length },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error("Error processing tracking events", error);
    return NextResponse.json(
      { error: "Failed to process events" },
      { status: 500, headers: corsHeaders }
    );
  }
}
