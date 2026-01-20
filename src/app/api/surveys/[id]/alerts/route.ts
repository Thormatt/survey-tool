import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { NotificationChannel, TriggerOperator } from "@/generated/prisma/client";
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

const emailConfigSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  subject: z.string().optional(),
});

const slackConfigSchema = z.object({
  slackWebhookUrl: z.string().url(),
  channel: z.string().optional(),
  mentionUsers: z.array(z.string()).optional(),
});

const webhookConfigSchema = z.object({
  webhookUrl: z.string().url(),
  secret: z.string().optional(),
});

const createAlertSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  channel: z.enum(["EMAIL", "SLACK", "WEBHOOK"]),
  config: z.unknown(),
  triggers: z.array(triggerSchema).min(1, "At least one trigger is required"),
});

/**
 * GET /api/surveys/[id]/alerts
 * List all alerts for a survey
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    await requirePermission(id, userId, "edit");

    const alerts = await db.alert.findMany({
      where: { surveyId: id },
      orderBy: { createdAt: "desc" },
      include: {
        triggers: {
          include: {
            // We need question info for display
          },
        },
      },
    });

    // Get question titles for triggers
    const questionIds = [
      ...new Set(alerts.flatMap((a) => a.triggers.map((t) => t.questionId))),
    ];
    const questions = await db.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, title: true, type: true },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const alertsWithQuestions = alerts.map((alert) => ({
      ...alert,
      triggers: alert.triggers.map((trigger) => ({
        ...trigger,
        question: questionMap.get(trigger.questionId) || null,
      })),
    }));

    return apiSuccess({ alerts: alertsWithQuestions });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error fetching alerts", error);
    return apiError("Failed to fetch alerts", 500);
  }
}

/**
 * POST /api/surveys/[id]/alerts
 * Create a new alert
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    await requirePermission(id, userId, "edit");

    const body = await request.json();
    const result = createAlertSchema.safeParse(body);

    if (!result.success) {
      return validationError(
        result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
      );
    }

    const { name, channel, config, triggers } = result.data;

    // Validate channel-specific config
    const configValidation = validateConfig(channel, config);
    if (!configValidation.valid) {
      return validationError([configValidation.error!]);
    }

    // Verify all trigger questions belong to this survey
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

    // Create alert with triggers
    const alert = await db.alert.create({
      data: {
        surveyId: id,
        name,
        channel: channel as NotificationChannel,
        config: config as object,
        triggers: {
          create: triggers.map((t) => ({
            questionId: t.questionId,
            operator: t.operator as TriggerOperator,
            value: t.value as object,
          })),
        },
      },
      include: {
        triggers: true,
      },
    });

    return apiSuccess({ alert }, 201);
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error creating alert", error);
    return apiError("Failed to create alert", 500);
  }
}

/**
 * Validate channel-specific configuration
 */
function validateConfig(
  channel: string,
  config: unknown
): { valid: boolean; error?: string } {
  switch (channel) {
    case "EMAIL": {
      const result = emailConfigSchema.safeParse(config);
      if (!result.success) {
        return {
          valid: false,
          error: `Email config: ${result.error.issues[0].message}`,
        };
      }
      return { valid: true };
    }

    case "SLACK": {
      const result = slackConfigSchema.safeParse(config);
      if (!result.success) {
        return {
          valid: false,
          error: `Slack config: ${result.error.issues[0].message}`,
        };
      }
      return { valid: true };
    }

    case "WEBHOOK": {
      const result = webhookConfigSchema.safeParse(config);
      if (!result.success) {
        return {
          valid: false,
          error: `Webhook config: ${result.error.issues[0].message}`,
        };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: "Invalid notification channel" };
  }
}
