import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { pageTargetSchema, formatZodErrors } from "@/lib/validations";
import { UrlMatchType } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId } = await params;
    const body = await request.json();

    // Validate input
    const result = pageTargetSchema.safeParse(body);
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

    // Create page target
    const pageTarget = await db.pageTarget.create({
      data: {
        siteId,
        name: result.data.name,
        urlPattern: result.data.urlPattern,
        matchType: result.data.matchType as UrlMatchType,
        recordingEnabled: result.data.recordingEnabled,
        heatmapsEnabled: result.data.heatmapsEnabled,
        priority: result.data.priority,
        enabled: result.data.enabled,
      },
    });

    return apiSuccess(pageTarget, 201);
  } catch (error) {
    logger.error("Error creating page target", error);
    return apiError("Failed to create page target", 500);
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId } = await params;

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

    const pageTargets = await db.pageTarget.findMany({
      where: { siteId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { surveyTriggers: true },
        },
      },
    });

    return apiSuccess(pageTargets);
  } catch (error) {
    logger.error("Error fetching page targets", error);
    return apiError("Failed to fetch page targets", 500);
  }
}
