import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { EventType } from "@/generated/prisma/client";
import { testWebhook } from "@/lib/notifications/webhook-notification";
import { z } from "zod";

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z
    .array(z.enum(["RESPONSE_SUBMITTED", "SURVEY_COMPLETED", "TRIGGER_MATCHED"]))
    .min(1)
    .optional(),
  enabled: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/surveys/[id]/webhooks/[webhookId]
 * Get webhook details with delivery history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, webhookId } = await params;

    await requirePermission(id, userId, "edit");

    const webhook = await db.webhook.findUnique({
      where: { id: webhookId },
      include: {
        deliveries: {
          orderBy: { deliveredAt: "desc" },
          take: 50,
        },
      },
    });

    if (!webhook || webhook.surveyId !== id) {
      return apiError("Webhook not found", 404);
    }

    return apiSuccess({
      webhook: {
        ...webhook,
        secret: webhook.secret ? "***" : null,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error fetching webhook", error);
    return apiError("Failed to fetch webhook", 500);
  }
}

/**
 * PATCH /api/surveys/[id]/webhooks/[webhookId]
 * Update a webhook
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, webhookId } = await params;

    await requirePermission(id, userId, "edit");

    // Verify webhook belongs to this survey
    const existing = await db.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!existing || existing.surveyId !== id) {
      return apiError("Webhook not found", 404);
    }

    const body = await request.json();
    const result = updateWebhookSchema.safeParse(body);

    if (!result.success) {
      return validationError(
        result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
      );
    }

    const { name, url, events, enabled, headers } = result.data;

    const webhook = await db.webhook.update({
      where: { id: webhookId },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(events !== undefined && { events: events as EventType[] }),
        ...(enabled !== undefined && { enabled }),
        ...(headers !== undefined && { headers: JSON.parse(JSON.stringify(headers)) }),
      },
    });

    return apiSuccess({
      webhook: {
        ...webhook,
        secret: webhook.secret ? "***" : null,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error updating webhook", error);
    return apiError("Failed to update webhook", 500);
  }
}

/**
 * DELETE /api/surveys/[id]/webhooks/[webhookId]
 * Delete a webhook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, webhookId } = await params;

    await requirePermission(id, userId, "edit");

    // Verify webhook belongs to this survey
    const existing = await db.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!existing || existing.surveyId !== id) {
      return apiError("Webhook not found", 404);
    }

    await db.webhook.delete({
      where: { id: webhookId },
    });

    return apiSuccess({ success: true, message: "Webhook deleted" });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error deleting webhook", error);
    return apiError("Failed to delete webhook", 500);
  }
}

/**
 * POST /api/surveys/[id]/webhooks/[webhookId]
 * Test a webhook by sending a test payload
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id, webhookId } = await params;

    await requirePermission(id, userId, "edit");

    const webhook = await db.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.surveyId !== id) {
      return apiError("Webhook not found", 404);
    }

    const result = await testWebhook(webhook);

    if (result.success) {
      return apiSuccess({
        success: true,
        statusCode: result.statusCode,
        message: "Test webhook delivered successfully",
      });
    }

    return apiError(result.error || "Test delivery failed", 400);
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error testing webhook", error);
    return apiError("Failed to test webhook", 500);
  }
}
