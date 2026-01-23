import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { z } from "zod";
import type { StartRecordingResponse } from "@/types/behavior";

const startRecordingSchema = z.object({
  type: z.enum(["desktop", "tablet", "mobile"]),
  browser: z.string(),
  viewportWidth: z.number(),
  viewportHeight: z.number(),
  userAgent: z.string(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/surveys/[id]/behavior/recordings
 * List recordings for a survey (requires viewRecordings permission)
 */
export async function GET(request: Request, context: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: surveyId } = await context.params;

    await requirePermission(surveyId, userId, "viewRecordings");

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const deviceType = url.searchParams.get("deviceType");
    const hasResponse = url.searchParams.get("hasResponse");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = { surveyId };
    if (status) {
      where.status = status;
    }
    if (deviceType) {
      where.deviceType = deviceType;
    }
    if (hasResponse === "true") {
      where.responseId = { not: null };
    } else if (hasResponse === "false") {
      where.responseId = null;
    }

    const [recordings, total] = await Promise.all([
      db.sessionRecording.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          response: {
            select: {
              id: true,
              completedAt: true,
              respondentEmail: true,
              respondentName: true,
            },
          },
        },
      }),
      db.sessionRecording.count({ where }),
    ]);

    return NextResponse.json({
      recordings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error fetching recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/surveys/[id]/behavior/recordings
 * Start a new recording session (public - for survey respondents)
 */
export async function POST(request: Request, context: RouteParams) {
  try {
    const { id: surveyId } = await context.params;

    // Fetch behavior settings
    const settings = await db.behaviorSettings.findUnique({
      where: { surveyId },
    });

    if (!settings || !settings.recordingEnabled) {
      return NextResponse.json(
        { error: "Recording not enabled for this survey" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const deviceInfo = startRecordingSchema.parse(body);

    // Check sampling rate
    const shouldRecord = Math.random() * 100 <= settings.samplingRate;

    if (!shouldRecord) {
      const response: StartRecordingResponse = {
        sessionToken: "",
        settings: {
          id: settings.id,
          surveyId: settings.surveyId,
          recordingEnabled: settings.recordingEnabled,
          heatmapsEnabled: settings.heatmapsEnabled,
          consentRequired: settings.consentRequired,
          consentText: settings.consentText,
          samplingRate: settings.samplingRate,
          retentionDays: settings.retentionDays,
          maskInputs: settings.maskInputs,
        },
        shouldRecord: false,
      };
      return NextResponse.json(response);
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + settings.retentionDays);

    // Create recording session
    const recording = await db.sessionRecording.create({
      data: {
        surveyId,
        deviceType: deviceInfo.type,
        browser: deviceInfo.browser,
        viewportWidth: deviceInfo.viewportWidth,
        viewportHeight: deviceInfo.viewportHeight,
        userAgent: deviceInfo.userAgent,
        expiresAt,
        consentGiven: !settings.consentRequired, // Auto-consent if not required
      },
    });

    const response: StartRecordingResponse = {
      sessionToken: recording.sessionToken,
      settings: {
        id: settings.id,
        surveyId: settings.surveyId,
        recordingEnabled: settings.recordingEnabled,
        heatmapsEnabled: settings.heatmapsEnabled,
        consentRequired: settings.consentRequired,
        consentText: settings.consentText,
        samplingRate: settings.samplingRate,
        retentionDays: settings.retentionDays,
        maskInputs: settings.maskInputs,
      },
      shouldRecord: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error starting recording:", error);
    return NextResponse.json(
      { error: "Failed to start recording" },
      { status: 500 }
    );
  }
}
