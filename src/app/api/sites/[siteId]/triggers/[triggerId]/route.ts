import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { surveyTriggerSchema, formatZodErrors } from "@/lib/validations";
import { SurveyTriggerType, SurveyDisplayMode } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ siteId: string; triggerId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, triggerId } = await params;

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

    const trigger = await db.siteSurveyTrigger.findFirst({
      where: {
        id: triggerId,
        siteId,
      },
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

    if (!trigger) {
      return apiError("Survey trigger not found", 404);
    }

    // Fetch survey
    const survey = await db.survey.findUnique({
      where: { id: trigger.surveyId },
      select: { id: true, title: true, published: true, questions: true },
    });

    const triggerWithSurvey = {
      ...trigger,
      survey: survey || { id: trigger.surveyId, title: "Unknown", published: false },
    };

    return apiSuccess(triggerWithSurvey);
  } catch (error) {
    logger.error("Error fetching survey trigger", error);
    return apiError("Failed to fetch survey trigger", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, triggerId } = await params;
    const body = await request.json();

    // Validate input (partial)
    const result = surveyTriggerSchema.partial().safeParse(body);
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

    // Check if trigger exists
    const existingTrigger = await db.siteSurveyTrigger.findFirst({
      where: {
        id: triggerId,
        siteId,
      },
    });

    if (!existingTrigger) {
      return apiError("Survey trigger not found", 404);
    }

    // If pageTargetId is being updated, verify it belongs to this site
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

    // If surveyId is being updated, verify it belongs to the user
    if (result.data.surveyId) {
      const survey = await db.survey.findFirst({
        where: {
          id: result.data.surveyId,
          userId,
        },
      });

      if (!survey) {
        return apiError("Survey not found", 404);
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (result.data.pageTargetId !== undefined) updateData.pageTargetId = result.data.pageTargetId;
    if (result.data.surveyId !== undefined) updateData.surveyId = result.data.surveyId;
    if (result.data.triggerType !== undefined) updateData.triggerType = result.data.triggerType as SurveyTriggerType;
    if (result.data.triggerValue !== undefined) updateData.triggerValue = result.data.triggerValue;
    if (result.data.triggerSelector !== undefined) updateData.triggerSelector = result.data.triggerSelector;
    if (result.data.displayMode !== undefined) updateData.displayMode = result.data.displayMode as SurveyDisplayMode;
    if (result.data.displayPosition !== undefined) updateData.displayPosition = result.data.displayPosition;
    if (result.data.displayDelay !== undefined) updateData.displayDelay = result.data.displayDelay;
    if (result.data.showOnce !== undefined) updateData.showOnce = result.data.showOnce;
    if (result.data.cooldownDays !== undefined) updateData.cooldownDays = result.data.cooldownDays;
    if (result.data.percentageShow !== undefined) updateData.percentageShow = result.data.percentageShow;
    if (result.data.enabled !== undefined) updateData.enabled = result.data.enabled;

    const trigger = await db.siteSurveyTrigger.update({
      where: { id: triggerId },
      data: updateData,
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

    // Fetch survey
    const survey = await db.survey.findUnique({
      where: { id: trigger.surveyId },
      select: { id: true, title: true },
    });

    const triggerWithSurvey = {
      ...trigger,
      survey: survey || { id: trigger.surveyId, title: "Unknown" },
    };

    return apiSuccess(triggerWithSurvey);
  } catch (error) {
    logger.error("Error updating survey trigger", error);
    return apiError("Failed to update survey trigger", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { siteId, triggerId } = await params;

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

    // Check if trigger exists
    const existingTrigger = await db.siteSurveyTrigger.findFirst({
      where: {
        id: triggerId,
        siteId,
      },
    });

    if (!existingTrigger) {
      return apiError("Survey trigger not found", 404);
    }

    await db.siteSurveyTrigger.delete({
      where: { id: triggerId },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting survey trigger", error);
    return apiError("Failed to delete survey trigger", 500);
  }
}
