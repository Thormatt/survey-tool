import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";
import { HeatmapType } from "@/generated/prisma/client";

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
    const url = new URL(request.url);

    // Required: page path for heatmap data
    const pagePath = url.searchParams.get("pagePath");
    if (!pagePath) {
      return apiError("pagePath query parameter is required", 400);
    }

    // Optional filters
    const heatmapType = url.searchParams.get("type") as HeatmapType | null;
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const viewport = url.searchParams.get("viewport"); // desktop, tablet, mobile

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

    // Build where clause
    const whereClause: Record<string, unknown> = {
      siteId,
      pagePath,
    };

    if (heatmapType) {
      whereClause.type = heatmapType;
    }
    if (viewport) {
      whereClause.viewportBreakpoint = viewport;
    }
    if (startDate || endDate) {
      whereClause.periodEnd = {};
      if (startDate) {
        (whereClause.periodEnd as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (whereClause.periodEnd as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Get heatmap data
    const heatmapData = await db.siteHeatmapData.findMany({
      where: whereClause,
      orderBy: { periodEnd: "desc" },
    });

    // Aggregate data by type
    const aggregated: Record<
      string,
      {
        type: HeatmapType;
        totalClicks: number;
        totalMoves: number;
        totalScrolls: number;
        dataPoints: Array<{
          x: number;
          y: number;
          count: number;
          selector?: string;
          scrollDepth?: number;
        }>;
      }
    > = {};

    for (const data of heatmapData) {
      const type = data.type;
      if (!aggregated[type]) {
        aggregated[type] = {
          type,
          totalClicks: 0,
          totalMoves: 0,
          totalScrolls: 0,
          dataPoints: [],
        };
      }

      const rawData = data.data as Record<string, unknown>;
      const points = (rawData.points as Array<{ x: number; y: number; count: number }>) || [];

      if (type === "CLICK") {
        aggregated[type].totalClicks += data.sessionCount;
        for (const point of points) {
          aggregated[type].dataPoints.push({
            x: point.x,
            y: point.y,
            count: point.count,
          });
        }
      } else if (type === "MOVE") {
        aggregated[type].totalMoves += data.sessionCount;
        for (const point of points) {
          aggregated[type].dataPoints.push({
            x: point.x,
            y: point.y,
            count: point.count,
          });
        }
      } else if (type === "SCROLL") {
        aggregated[type].totalScrolls += data.sessionCount;
        for (const point of points) {
          aggregated[type].dataPoints.push({
            x: point.x,
            y: point.y,
            count: point.count,
            scrollDepth: point.y,
          });
        }
      }
    }

    // Get page metadata
    const pageStats = await db.siteRecording.aggregate({
      where: {
        siteId,
        pagePath,
        ...(startDate || endDate
          ? {
              startedAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      _count: { id: true },
      _avg: { duration: true, scrollDepth: true },
    });

    return apiSuccess({
      pagePath,
      heatmaps: Object.values(aggregated),
      stats: {
        totalSessions: pageStats._count.id,
        avgDuration: pageStats._avg.duration,
        avgScrollDepth: pageStats._avg.scrollDepth,
      },
    });
  } catch (error) {
    logger.error("Error fetching heatmap data", error);
    return apiError("Failed to fetch heatmap data", 500);
  }
}

// Get list of pages with heatmap data
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Get unique pages with heatmap data
    const pages = await db.siteHeatmapData.groupBy({
      by: ["pagePath"],
      where: { siteId },
      _count: { pagePath: true },
      orderBy: {
        _count: { pagePath: "desc" },
      },
      take: 100,
    });

    // Get additional stats for each page
    const pagesWithStats = await Promise.all(
      pages.map(async (page) => {
        const [clickCount, moveCount, scrollCount, sessions] = await Promise.all([
          db.siteHeatmapData.count({
            where: { siteId, pagePath: page.pagePath, type: "CLICK" },
          }),
          db.siteHeatmapData.count({
            where: { siteId, pagePath: page.pagePath, type: "MOVE" },
          }),
          db.siteHeatmapData.count({
            where: { siteId, pagePath: page.pagePath, type: "SCROLL" },
          }),
          db.siteRecording.count({
            where: { siteId, pagePath: page.pagePath },
          }),
        ]);

        return {
          pagePath: page.pagePath,
          totalDataPoints: page._count.pagePath,
          clicks: clickCount,
          moves: moveCount,
          scrolls: scrollCount,
          sessions,
        };
      })
    );

    return apiSuccess(pagesWithStats);
  } catch (error) {
    logger.error("Error fetching heatmap pages", error);
    return apiError("Failed to fetch heatmap pages", 500);
  }
}
