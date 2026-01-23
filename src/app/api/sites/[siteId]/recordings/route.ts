import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPaginationParams, paginatedResponse, prismaPagination } from "@/lib/pagination";

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
    const pagination = getPaginationParams(request);

    // Filter options
    const pagePath = url.searchParams.get("pagePath");
    const visitorId = url.searchParams.get("visitorId");
    const minDuration = url.searchParams.get("minDuration");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const deviceType = url.searchParams.get("device");
    const browser = url.searchParams.get("browser");
    const country = url.searchParams.get("country");

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
    const whereClause: Record<string, unknown> = { siteId };

    if (pagePath) {
      whereClause.pagePath = { contains: pagePath };
    }
    if (visitorId) {
      whereClause.visitorId = visitorId;
    }
    if (minDuration) {
      whereClause.duration = { gte: parseInt(minDuration, 10) };
    }
    if (startDate || endDate) {
      whereClause.startedAt = {};
      if (startDate) {
        (whereClause.startedAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (whereClause.startedAt as Record<string, Date>).lte = new Date(endDate);
      }
    }
    if (deviceType) {
      whereClause.deviceType = deviceType;
    }
    if (browser) {
      whereClause.browser = browser;
    }
    if (country) {
      whereClause.country = country;
    }

    // Get total count for pagination
    const total = await db.siteRecording.count({
      where: whereClause,
    });

    const recordings = await db.siteRecording.findMany({
      where: whereClause,
      orderBy: { startedAt: "desc" },
      ...prismaPagination(pagination),
      select: {
        id: true,
        visitorId: true,
        sessionToken: true,
        pagePath: true,
        pageTitle: true,
        startedAt: true,
        endedAt: true,
        duration: true,
        eventCount: true,
        clickCount: true,
        scrollDepth: true,
        rageClicks: true,
        deadClicks: true,
        deviceType: true,
        browser: true,
        os: true,
        screenWidth: true,
        screenHeight: true,
        country: true,
        referrer: true,
        status: true,
        createdAt: true,
      },
    });

    return apiSuccess(paginatedResponse(recordings, total, pagination));
  } catch (error) {
    logger.error("Error fetching recordings", error);
    return apiError("Failed to fetch recordings", 500);
  }
}
