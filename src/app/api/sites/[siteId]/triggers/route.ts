import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { surveyTriggerSchema, formatZodErrors } from "@/lib/validations";
import { SurveyTriggerType, SurveyDisplayMode } from "@/generated/prisma/client";

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
    const result = surveyTriggerSchema.safeParse(body);
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

    // If pageTargetId is provided, verify it belongs to this site
    if (result.data.pageTargetId) {
      const pageTarget = await db.pageTarget.findFirst({
        where: {
          id: result.data.pageTargetId,
          siteId,
        },
      });

      if (!pageTarget) {
        return apiError("Page target not found", 404);
      }
    }

    // Verify the survey exists and belongs to the user
    const survey = await db.survey.findFirst({
      where: {
        id: result.data.surveyId,
        userId,
      },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    // Create survey trigger
    const trigger = await db.siteSurveyTrigger.create({
      data: {
        siteId,
        pageTargetId: result.data.pageTargetId,
        surveyId: result.data.surveyId,
        triggerType: result.data.triggerType as SurveyTriggerType,
        triggerValue: result.data.triggerValue,
        triggerSelector: result.data.triggerSelector,
        displayMode: result.data.displayMode as SurveyDisplayMode,
        displayPosition: result.data.displayPosition,
        displayDelay: result.data.displayDelay,
        showOnce: result.data.showOnce,
        cooldownDays: result.data.cooldownDays,
        percentageShow: result.data.percentageShow,
        enabled: result.data.enabled,
      },
      include: {
        pageTarget: {
          select: {
            id: true,
            name: true,
            urlPattern: true,
          },
        },
      },
    });

    // Add survey info to response
    const triggerWithSurvey = {
      ...trigger,
      survey: {
        id: survey.id,
        title: survey.title,
      },
    };

    return apiSuccess(triggerWithSurvey, 201);
  } catch (error) {
    logger.error("Error creating survey trigger", error);
    return apiError("Failed to create survey trigger", 500);
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId } = await params;
    const url = new URL(request.url);
    const includeDisabled = url.searchParams.get("includeDisabled") === "true";
    const surveyId = url.searchParams.get("surveyId");

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
    const whereClause = {
      siteId,
      ...(includeDisabled ? {} : { enabled: true }),
      ...(surveyId ? { surveyId } : {}),
    };

    const triggers = await db.siteSurveyTrigger.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        pageTarget: {
          select: {
            id: true,
            name: true,
            urlPattern: true,
            matchType: true,
          },
        },
      },
    });

    // Get unique survey IDs
    const surveyIds = [...new Set(triggers.map((t) => t.surveyId))];

    // Fetch surveys
    const surveys = await db.survey.findMany({
      where: { id: { in: surveyIds } },
      select: { id: true, title: true, published: true },
    });

    const surveyMap = new Map(surveys.map((s) => [s.id, s]));

    // Combine triggers with survey data
    const triggersWithSurveys = triggers.map((trigger) => ({
      ...trigger,
      survey: surveyMap.get(trigger.surveyId) || { id: trigger.surveyId, title: "Unknown", published: false },
    }));

    return apiSuccess(triggersWithSurveys);
  } catch (error) {
    logger.error("Error fetching survey triggers", error);
    return apiError("Failed to fetch survey triggers", 500);
  }
}
