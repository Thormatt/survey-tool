import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { siteSchema, formatZodErrors } from "@/lib/validations";
import { getPaginationParams, paginatedResponse, prismaPagination } from "@/lib/pagination";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();

    // Validate input
    const result = siteSchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const {
      name,
      domain,
      recordingEnabled,
      heatmapsEnabled,
      consentRequired,
      consentText,
      samplingRate,
      retentionDays,
      maskInputs,
      maskSelectors,
    } = result.data;

    // Check if domain already exists for this user
    const existingSite = await db.site.findUnique({
      where: {
        userId_domain: {
          userId,
          domain,
        },
      },
    });

    if (existingSite) {
      return apiError("You already have a site with this domain", 409);
    }

    // Create site
    const site = await db.site.create({
      data: {
        userId,
        name,
        domain,
        recordingEnabled,
        heatmapsEnabled,
        consentRequired,
        consentText,
        samplingRate,
        retentionDays,
        maskInputs,
        maskSelectors,
      },
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

    return apiSuccess(site, 201);
  } catch (error) {
    logger.error("Error creating site", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to create site: ${errorMessage}`, 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const pagination = getPaginationParams(request);
    const url = new URL(request.url);
    const includeDisabled = url.searchParams.get("includeDisabled") === "true";

    // Build where clause
    const whereClause = {
      userId,
      ...(includeDisabled ? {} : { enabled: true }),
    };

    // Get total count for pagination
    const total = await db.site.count({
      where: whereClause,
    });

    const sites = await db.site.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      ...prismaPagination(pagination),
      include: {
        _count: {
          select: {
            recordings: true,
            pageTargets: true,
            surveyTriggers: true,
            heatmapData: true,
          },
        },
      },
    });

    // Get recent stats for each site
    const sitesWithStats = await Promise.all(
      sites.map(async (site) => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [recentRecordings, totalRecordings] = await Promise.all([
          db.siteRecording.count({
            where: {
              siteId: site.id,
              startedAt: { gte: weekAgo },
            },
          }),
          db.siteRecording.count({
            where: { siteId: site.id },
          }),
        ]);

        return {
          ...site,
          stats: {
            totalRecordings,
            recordingsThisWeek: recentRecordings,
          },
        };
      })
    );

    return apiSuccess(paginatedResponse(sitesWithStats, total, pagination));
  } catch (error) {
    logger.error("Error fetching sites", error);
    return apiError("Failed to fetch sites", 500);
  }
}
