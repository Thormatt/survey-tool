import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ siteId: string; recordingId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, recordingId } = await params;

    // Check if site exists and belongs to user
    const site = await db.site.findFirst({
      where: {
        id: siteId,
        userId,
      },
    });

    if (!site) {
      return apiError("Site not found", 404);
    }

    const recording = await db.siteRecording.findFirst({
      where: {
        id: recordingId,
        siteId,
      },
    });

    if (!recording) {
      return apiError("Recording not found", 404);
    }

    return apiSuccess(recording);
  } catch (error) {
    logger.error("Error fetching recording", error);
    return apiError("Failed to fetch recording", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, recordingId } = await params;

    // Check if site exists and belongs to user
    const site = await db.site.findFirst({
      where: {
        id: siteId,
        userId,
      },
    });

    if (!site) {
      return apiError("Site not found", 404);
    }

    // Check if recording exists
    const existingRecording = await db.siteRecording.findFirst({
      where: {
        id: recordingId,
        siteId,
      },
    });

    if (!existingRecording) {
      return apiError("Recording not found", 404);
    }

    await db.siteRecording.delete({
      where: { id: recordingId },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting recording", error);
    return apiError("Failed to delete recording", 500);
  }
}
