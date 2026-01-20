import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { TriggerOperator } from "@/generated/prisma/client";
import { z } from "zod";

const triggerSchema = z.object({
  questionId: z.string(),
  operator: z.enum([
    "EQUALS",
    "NOT_EQUALS",
    "GREATER_THAN",
    "LESS_THAN",
    "CONTAINS",
    "IS_EMPTY",
  ]),
  value: z.unknown(),
});

const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  config: z.unknown().optional(),
  triggers: z.array(triggerSchema).min(1).optional(),
});

/**
 * GET /api/surveys/[id]/alerts/[alertId]
 * Get alert details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, alertId } = await params;

    await requirePermission(id, userId, "edit");

    const alert = await db.alert.findUnique({
      where: { id: alertId },
      include: {
        triggers: true,
      },
    });

    if (!alert || alert.surveyId !== id) {
      return apiError("Alert not found", 404);
    }

    // Get question details for triggers
    const questionIds = alert.triggers.map((t) => t.questionId);
    const questions = await db.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, title: true, type: true },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    return apiSuccess({
      alert: {
        ...alert,
        triggers: alert.triggers.map((t) => ({
          ...t,
          question: questionMap.get(t.questionId) || null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error fetching alert", error);
    return apiError("Failed to fetch alert", 500);
  }
}

/**
 * PATCH /api/surveys/[id]/alerts/[alertId]
 * Update an alert
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, alertId } = await params;

    await requirePermission(id, userId, "edit");

    // Verify alert belongs to this survey
    const existing = await db.alert.findUnique({
      where: { id: alertId },
    });

    if (!existing || existing.surveyId !== id) {
      return apiError("Alert not found", 404);
    }

    const body = await request.json();
    const result = updateAlertSchema.safeParse(body);

    if (!result.success) {
      return validationError(
        result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
      );
    }

    const { name, enabled, config, triggers } = result.data;

    // If triggers are being updated, validate question ownership
    if (triggers) {
      const questionIds = triggers.map((t) => t.questionId);
      const validQuestions = await db.question.count({
        where: {
          id: { in: questionIds },
          surveyId: id,
        },
      });

      if (validQuestions !== questionIds.length) {
        return apiError("One or more trigger questions do not belong to this survey", 400);
      }

      // Delete existing triggers and create new ones
      await db.alertTrigger.deleteMany({
        where: { alertId },
      });

      await db.alertTrigger.createMany({
        data: triggers.map((t) => ({
          alertId,
          questionId: t.questionId,
          operator: t.operator as TriggerOperator,
          value: t.value as object,
        })),
      });
    }

    const alert = await db.alert.update({
      where: { id: alertId },
      data: {
        ...(name !== undefined && { name }),
        ...(enabled !== undefined && { enabled }),
        ...(config !== undefined && { config: config as object }),
      },
      include: {
        triggers: true,
      },
    });

    return apiSuccess({ alert });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error updating alert", error);
    return apiError("Failed to update alert", 500);
  }
}

/**
 * DELETE /api/surveys/[id]/alerts/[alertId]
 * Delete an alert
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, alertId } = await params;

    await requirePermission(id, userId, "edit");

    // Verify alert belongs to this survey
    const existing = await db.alert.findUnique({
      where: { id: alertId },
    });

    if (!existing || existing.surveyId !== id) {
      return apiError("Alert not found", 404);
    }

    await db.alert.delete({
      where: { id: alertId },
    });

    return apiSuccess({ success: true, message: "Alert deleted" });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error deleting alert", error);
    return apiError("Failed to delete alert", 500);
  }
}

/**
 * POST /api/surveys/[id]/alerts/[alertId]
 * Test an alert by simulating a trigger
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, alertId } = await params;

    await requirePermission(id, userId, "edit");

    const alert = await db.alert.findUnique({
      where: { id: alertId },
      include: {
        triggers: true,
        survey: {
          select: { title: true },
        },
      },
    });

    if (!alert || alert.surveyId !== id) {
      return apiError("Alert not found", 404);
    }

    // Create mock payload for test
    const mockPayload = {
      id: "test-response-id",
      surveyId: id,
      completedAt: new Date(),
      respondentEmail: "test@example.com",
      respondentName: "Test User",
      answers: alert.triggers.map((t) => ({
        questionId: t.questionId,
        questionTitle: "Test Question",
        questionType: "SHORT_TEXT",
        value: t.value,
      })),
    };

    // Try to send test notification based on channel
    try {
      const { sendEmailNotification } = await import(
        "@/lib/notifications/email-notification"
      );
      const { sendSlackNotification } = await import(
        "@/lib/notifications/slack-notification"
      );

      switch (alert.channel) {
        case "EMAIL":
          await sendEmailNotification(
            { ...alert, survey: alert.survey },
            mockPayload
          );
          break;
        case "SLACK":
          await sendSlackNotification(
            { ...alert, survey: alert.survey },
            mockPayload
          );
          break;
        case "WEBHOOK":
          // For webhook channel in alerts, use the config URL
          const config = alert.config as { webhookUrl?: string };
          if (config.webhookUrl) {
            await fetch(config.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "TEST",
                alertId: alert.id,
                timestamp: new Date().toISOString(),
                message: "Test alert notification",
              }),
            });
          }
          break;
      }

      return apiSuccess({
        success: true,
        message: `Test ${alert.channel.toLowerCase()} notification sent`,
      });
    } catch (err) {
      logger.error("Error sending test alert", { alertId, err });
      return apiError(
        `Failed to send test notification: ${err instanceof Error ? err.message : "Unknown error"}`,
        400
      );
    }
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error testing alert", error);
    return apiError("Failed to test alert", 500);
  }
}
