import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const consentSchema = z.object({
  sessionToken: z.string(),
  consent: z.boolean(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/surveys/[id]/behavior/consent
 * Record consent decision for a recording session (public - for survey respondents)
 */
export async function POST(request: Request, context: RouteParams) {
  try {
    const { id: surveyId } = await context.params;

    const body = await request.json();
    const { sessionToken, consent } = consentSchema.parse(body);

    // Find the recording
    const recording = await db.sessionRecording.findUnique({
      where: { sessionToken },
      select: { id: true, surveyId: true, status: true },
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

    if (consent) {
      // User gave consent - update the recording
      await db.sessionRecording.update({
        where: { id: recording.id },
        data: { consentGiven: true },
      });

      return NextResponse.json({ success: true, message: "Consent recorded" });
    } else {
      // User denied consent - delete the recording
      await db.sessionRecording.delete({
        where: { id: recording.id },
      });

      return NextResponse.json({ success: true, message: "Recording deleted" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error recording consent:", error);
    return NextResponse.json(
      { error: "Failed to record consent" },
      { status: 500 }
    );
  }
}
