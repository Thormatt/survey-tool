import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { siteUpdateSchema, formatZodErrors } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId } = await params;

    const site = await db.site.findFirst({
      where: {
        id: siteId,
        userId,
      },
      include: {
        pageTargets: {
          orderBy: { priority: "desc" },
        },
        surveyTriggers: {
          include: {
            pageTarget: true,
          },
        },
        _count: {
          select: {
            recordings: true,
            heatmapData: true,
          },
        },
      },
    });

    if (!site) {
      return apiError("Site not found", 404);
    }

    // Get stats
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalRecordings,
      recordingsThisWeek,
      recordingsThisMonth,
      uniqueVisitors,
      avgDuration,
      topPages,
    ] = await Promise.all([
      db.siteRecording.count({
        where: { siteId: site.id },
      }),
      db.siteRecording.count({
        where: {
          siteId: site.id,
          startedAt: { gte: weekAgo },
        },
      }),
      db.siteRecording.count({
        where: {
          siteId: site.id,
          startedAt: { gte: monthAgo },
        },
      }),
      db.siteRecording.groupBy({
        by: ["visitorId"],
        where: { siteId: site.id },
        _count: true,
      }),
      db.siteRecording.aggregate({
        where: {
          siteId: site.id,
          duration: { not: null },
        },
        _avg: { duration: true },
      }),
      db.siteRecording.groupBy({
        by: ["pagePath"],
        where: { siteId: site.id },
        _count: { pagePath: true },
        orderBy: {
          _count: { pagePath: "desc" },
        },
        take: 10,
      }),
    ]);

    return apiSuccess({
      ...site,
      stats: {
        totalRecordings,
        recordingsThisWeek,
        recordingsThisMonth,
        uniqueVisitors: uniqueVisitors.length,
        avgDuration: avgDuration._avg.duration,
        topPages: topPages.map((p) => ({
          path: p.pagePath,
          views: p._count.pagePath,
        })),
      },
    });
  } catch (error) {
    logger.error("Error fetching site", error);
    return apiError("Failed to fetch site", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId } = await params;
    const body = await request.json();

    // Validate input
    const result = siteUpdateSchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Check if site exists and belongs to user
    const existingSite = await db.site.findFirst({
      where: {
        id: siteId,
        userId,
      },
    });

    if (!existingSite) {
      return apiError("Site not found", 404);
    }

    // If domain is being changed, check for conflicts
    if (result.data.domain && result.data.domain !== existingSite.domain) {
      const conflictingSite = await db.site.findFirst({
        where: {
          userId,
          domain: result.data.domain,
          id: { not: siteId },
        },
      });

      if (conflictingSite) {
        return apiError("You already have a site with this domain", 409);
      }
    }

    // Update site
    const site = await db.site.update({
      where: { id: siteId },
      data: result.data,
      include: {
        _count: {
          select: {
            recordings: true,
            pageTargets: true,
            surveyTriggers: true,
          },
        },
      },
    });

    return apiSuccess(site);
  } catch (error) {
    logger.error("Error updating site", error);
    return apiError("Failed to update site", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId } = await params;

    // Check if site exists and belongs to user
    const existingSite = await db.site.findFirst({
      where: {
        id: siteId,
        userId,
      },
    });

    if (!existingSite) {
      return apiError("Site not found", 404);
    }

    // Delete site (cascade will handle related records)
    await db.site.delete({
      where: { id: siteId },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting site", error);
    return apiError("Failed to delete site", 500);
  }
}
