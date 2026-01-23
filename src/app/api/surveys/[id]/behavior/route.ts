import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { z } from "zod";

const updateBehaviorSettingsSchema = z.object({
  recordingEnabled: z.boolean().optional(),
  heatmapsEnabled: z.boolean().optional(),
  consentRequired: z.boolean().optional(),
  consentText: z.string().nullable().optional(),
  samplingRate: z.number().min(1).max(100).optional(),
  retentionDays: z.number().min(1).max(365).optional(),
  maskInputs: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/surveys/[id]/behavior
 * Get behavior settings for a survey (requires viewRecordings permission)
 */
export async function GET(request: Request, context: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: surveyId } = await context.params;

    await requirePermission(surveyId, userId, "viewRecordings");

    // Get or create behavior settings
    let settings = await db.behaviorSettings.findUnique({
      where: { surveyId },
    });

    if (!settings) {
      // Create default settings
      settings = await db.behaviorSettings.create({
        data: { surveyId },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error fetching behavior settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch behavior settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/surveys/[id]/behavior
 * Update behavior settings for a survey (requires manageBehaviorSettings permission)
 */
export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: surveyId } = await context.params;

    await requirePermission(surveyId, userId, "manageBehaviorSettings");

    const body = await request.json();
    const validatedData = updateBehaviorSettingsSchema.parse(body);

    // Upsert behavior settings
    const settings = await db.behaviorSettings.upsert({
      where: { surveyId },
      create: {
        surveyId,
        ...validatedData,
      },
      update: validatedData,
    });

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error updating behavior settings:", error);
    return NextResponse.json(
      { error: "Failed to update behavior settings" },
      { status: 500 }
    );
  }
}
