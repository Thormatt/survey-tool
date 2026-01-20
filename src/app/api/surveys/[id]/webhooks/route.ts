import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { EventType } from "@/generated/prisma/client";
import { z } from "zod";
import crypto from "crypto";

const createWebhookSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z.string().url("Invalid URL"),
  events: z
    .array(z.enum(["RESPONSE_SUBMITTED", "SURVEY_COMPLETED", "TRIGGER_MATCHED"]))
    .min(1, "At least one event type is required"),
  secret: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/surveys/[id]/webhooks
 * List all webhooks for a survey
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

    // Only owner/editor can manage webhooks
    await requirePermission(id, userId, "edit");

    const webhooks = await db.webhook.findMany({
      where: { surveyId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    // Get recent deliveries for each webhook
    const webhooksWithDeliveries = await Promise.all(
      webhooks.map(async (webhook) => {
        const recentDeliveries = await db.webhookDelivery.findMany({
          where: { webhookId: webhook.id },
          orderBy: { deliveredAt: "desc" },
          take: 5,
          select: {
            id: true,
            eventType: true,
            responseCode: true,
            error: true,
            duration: true,
            deliveredAt: true,
          },
        });

        return {
          ...webhook,
          secret: webhook.secret ? "***" : null, // Don't expose secret
          recentDeliveries,
        };
      })
    );

    return apiSuccess({ webhooks: webhooksWithDeliveries });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error fetching webhooks", error);
    return apiError("Failed to fetch webhooks", 500);
  }
}

/**
 * POST /api/surveys/[id]/webhooks
 * Create a new webhook
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

    // Only owner/editor can create webhooks
    await requirePermission(id, userId, "edit");

    const body = await request.json();
    const result = createWebhookSchema.safeParse(body);

    if (!result.success) {
      return validationError(
        result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
      );
    }

    const { name, url, events, secret, headers } = result.data;

    // Generate secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString("hex");

    const webhook = await db.webhook.create({
      data: {
        surveyId: id,
        name,
        url,
        events: events as EventType[],
        secret: webhookSecret,
        headers: headers ? JSON.parse(JSON.stringify(headers)) : {},
      },
    });

    return apiSuccess(
      {
        webhook: {
          ...webhook,
          secret: webhookSecret, // Return secret only on creation
        },
        message: "Webhook created. Save the secret - it won't be shown again.",
      },
      201
    );
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error creating webhook", error);
    return apiError("Failed to create webhook", 500);
  }
}
