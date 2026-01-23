import { NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { z } from "zod";

const eventBatchSchema = z.object({
  sessionToken: z.string(),
  compressed: z.string(),
  eventCount: z.number(),
  timestamp: z.number(),
  isCheckpoint: z.boolean(),
  isComplete: z.boolean().optional(),
});

const linkResponseSchema = z.object({
  responseId: z.string(),
});

interface RouteParams {
  params: Promise<{ id: string; token: string }>;
}

/**
 * POST /api/surveys/[id]/behavior/recordings/[token]/events
 * Upload a batch of recording events (public - for survey respondents)
 */
export async function POST(request: Request, context: RouteParams) {
  try {
    const { id: surveyId, token: sessionToken } = await context.params;

    // Verify the recording exists and is active
    const recording = await db.sessionRecording.findUnique({
      where: { sessionToken },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    if (recording.surveyId !== surveyId) {
      return NextResponse.json(
        { error: "Invalid survey ID" },
        { status: 400 }
      );
    }

    if (recording.status !== "RECORDING") {
      return NextResponse.json(
        { error: "Recording is not active" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const batch = eventBatchSchema.parse(body);

    // Handle completion signal
    if (batch.isComplete) {
      await finalizeRecording(recording.id);
      return NextResponse.json({ success: true, status: "completed" });
    }

    // Skip empty batches
    if (batch.eventCount === 0 || !batch.compressed) {
      return NextResponse.json({ success: true });
    }

    // Upload events to Vercel Blob
    const filename = `recordings/${surveyId}/${recording.id}/${Date.now()}.json.gz`;
    const compressedData = Buffer.from(batch.compressed, "base64");

    await put(filename, compressedData, {
      access: "public",
      contentType: "application/gzip",
    });

    // Update recording metadata
    await db.sessionRecording.update({
      where: { id: recording.id },
      data: {
        eventCount: { increment: batch.eventCount },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error uploading events:", error);
    return NextResponse.json(
      { error: "Failed to upload events" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/surveys/[id]/behavior/recordings/[token]/events
 * Link recording to a response
 */
export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { id: surveyId, token: sessionToken } = await context.params;

    const recording = await db.sessionRecording.findUnique({
      where: { sessionToken },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    if (recording.surveyId !== surveyId) {
      return NextResponse.json(
        { error: "Invalid survey ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { responseId } = linkResponseSchema.parse(body);

    // Verify the response exists and belongs to this survey
    const response = await db.response.findUnique({
      where: { id: responseId },
      select: { surveyId: true },
    });

    if (!response || response.surveyId !== surveyId) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    // Link the recording to the response
    await db.sessionRecording.update({
      where: { id: recording.id },
      data: { responseId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error linking response:", error);
    return NextResponse.json(
      { error: "Failed to link response" },
      { status: 500 }
    );
  }
}

/**
 * Finalize a recording - merge event files and update status
 */
async function finalizeRecording(recordingId: string) {
  try {
    const recording = await db.sessionRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, surveyId: true, startedAt: true },
    });

    if (!recording) return;

    // List all event files for this recording
    const prefix = `recordings/${recording.surveyId}/${recording.id}/`;
    const { blobs } = await list({ prefix });

    if (blobs.length === 0) {
      // No events recorded
      await db.sessionRecording.update({
        where: { id: recordingId },
        data: {
          status: "READY",
          endedAt: new Date(),
          duration: 0,
        },
      });
      return;
    }

    // Merge all event files into a single file
    const allEvents: unknown[] = [];
    for (const blob of blobs) {
      try {
        const response = await fetch(blob.url);
        const compressedData = await response.arrayBuffer();

        // Decompress and parse
        const pako = await import("pako");
        const json = pako.ungzip(new Uint8Array(compressedData), { to: "string" });
        const events = JSON.parse(json);
        allEvents.push(...events);
      } catch (e) {
        console.error("Failed to process event file:", blob.url, e);
      }
    }

    // Sort events by timestamp
    allEvents.sort((a, b) => {
      const aTime = (a as { timestamp?: number }).timestamp ?? 0;
      const bTime = (b as { timestamp?: number }).timestamp ?? 0;
      return aTime - bTime;
    });

    // Calculate duration
    let duration = 0;
    if (allEvents.length >= 2) {
      const first = (allEvents[0] as { timestamp?: number }).timestamp ?? 0;
      const last = (allEvents[allEvents.length - 1] as { timestamp?: number }).timestamp ?? 0;
      duration = last - first;
    }

    // Compress merged events
    const pako = await import("pako");
    const mergedJson = JSON.stringify(allEvents);
    const mergedCompressed = pako.gzip(mergedJson);

    // Upload merged file
    const mergedFilename = `recordings/${recording.surveyId}/${recording.id}/merged.json.gz`;
    const { url } = await put(mergedFilename, Buffer.from(mergedCompressed), {
      access: "public",
      contentType: "application/gzip",
    });

    // Delete individual event files
    for (const blob of blobs) {
      if (!blob.pathname.endsWith("merged.json.gz")) {
        await del(blob.url);
      }
    }

    // Update recording with merged file URL
    await db.sessionRecording.update({
      where: { id: recordingId },
      data: {
        status: "READY",
        endedAt: new Date(),
        duration,
        eventsUrl: url,
        eventCount: allEvents.length,
      },
    });
  } catch (error) {
    console.error("Error finalizing recording:", error);
    await db.sessionRecording.update({
      where: { id: recordingId },
      data: { status: "FAILED" },
    });
  }
}
