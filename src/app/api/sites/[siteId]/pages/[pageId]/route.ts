import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { pageTargetSchema, formatZodErrors } from "@/lib/validations";
import { UrlMatchType } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ siteId: string; pageId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, pageId } = await params;

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

    const pageTarget = await db.pageTarget.findFirst({
      where: {
        id: pageId,
        siteId,
      },
      include: {
        surveyTriggers: true,
      },
    });

    if (!pageTarget) {
      return apiError("Page target not found", 404);
    }

    return apiSuccess(pageTarget);
  } catch (error) {
    logger.error("Error fetching page target", error);
    return apiError("Failed to fetch page target", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, pageId } = await params;
    const body = await request.json();

    // Validate input (partial)
    const result = pageTargetSchema.partial().safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

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

    // Check if page target exists
    const existingTarget = await db.pageTarget.findFirst({
      where: {
        id: pageId,
        siteId,
      },
    });

    if (!existingTarget) {
      return apiError("Page target not found", 404);
    }

    // Update page target
    const pageTarget = await db.pageTarget.update({
      where: { id: pageId },
      data: {
        ...(result.data.name && { name: result.data.name }),
        ...(result.data.urlPattern && { urlPattern: result.data.urlPattern }),
        ...(result.data.matchType && { matchType: result.data.matchType as UrlMatchType }),
        ...(result.data.recordingEnabled !== undefined && { recordingEnabled: result.data.recordingEnabled }),
        ...(result.data.heatmapsEnabled !== undefined && { heatmapsEnabled: result.data.heatmapsEnabled }),
        ...(result.data.priority !== undefined && { priority: result.data.priority }),
        ...(result.data.enabled !== undefined && { enabled: result.data.enabled }),
      },
    });

    return apiSuccess(pageTarget);
  } catch (error) {
    logger.error("Error updating page target", error);
    return apiError("Failed to update page target", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, pageId } = await params;

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

    // Check if page target exists
    const existingTarget = await db.pageTarget.findFirst({
      where: {
        id: pageId,
        siteId,
      },
    });

    if (!existingTarget) {
      return apiError("Page target not found", 404);
    }

    // Delete page target (cascade will handle triggers)
    await db.pageTarget.delete({
      where: { id: pageId },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting page target", error);
    return apiError("Failed to delete page target", 500);
  }
}
