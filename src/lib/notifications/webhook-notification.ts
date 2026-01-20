import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { EventType } from "@/generated/prisma/client";

interface Webhook {
  id: string;
  url: string;
  secret: string | null;
  headers: unknown;
}

interface ResponsePayload {
  id: string;
  surveyId: string;
  completedAt: Date;
  respondentEmail: string | null;
  respondentName: string | null;
  answers: Array<{
    questionId: string;
    questionTitle: string;
    questionType: string;
    value: unknown;
  }>;
}

/**
 * Send webhook notification for an event
 */
export async function sendWebhookNotification(
  webhook: Webhook,
  eventType: EventType,
  payload: ResponsePayload
): Promise<void> {
  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let error: string | null = null;

  try {
    const body = JSON.stringify({
      event: eventType,
      webhookId: webhook.id,
      timestamp: new Date().toISOString(),
      data: {
        response: payload,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SurveyTool-Webhook/1.0",
    };

    // Add custom headers if configured
    if (webhook.headers && typeof webhook.headers === "object") {
      Object.assign(headers, webhook.headers);
    }

    // Add signature if secret is configured
    if (webhook.secret) {
      const crypto = await import("crypto");
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(body)
        .digest("hex");
      headers["X-Signature"] = `sha256=${signature}`;
      headers["X-Webhook-Signature"] = signature;
    }

    // Add timestamp for replay protection
    const timestamp = Math.floor(Date.now() / 1000);
    headers["X-Webhook-Timestamp"] = String(timestamp);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    statusCode = response.status;

    // Get response body (truncated)
    const text = await response.text();
    responseBody = text.slice(0, 1000);

    if (!response.ok) {
      throw new Error(
        `Webhook request failed with status ${statusCode}: ${responseBody}`
      );
    }

    logger.info("Webhook delivered successfully", {
      webhookId: webhook.id,
      eventType,
      statusCode,
    });
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Unknown error during webhook delivery";
    logger.error("Webhook delivery failed", {
      webhookId: webhook.id,
      eventType,
      error,
    });
  } finally {
    const duration = Date.now() - startTime;

    // Record delivery attempt
    await recordDelivery(webhook.id, eventType, payload, {
      statusCode,
      responseBody,
      error,
      duration,
    });
  }
}

/**
 * Record webhook delivery attempt in database
 */
async function recordDelivery(
  webhookId: string,
  eventType: EventType,
  payload: ResponsePayload,
  result: {
    statusCode: number | null;
    responseBody: string | null;
    error: string | null;
    duration: number;
  }
): Promise<void> {
  try {
    await db.webhookDelivery.create({
      data: {
        webhookId,
        eventType,
        payload: {
          responseId: payload.id,
          surveyId: payload.surveyId,
          completedAt: payload.completedAt.toISOString(),
          answersCount: payload.answers.length,
        },
        responseCode: result.statusCode,
        responseBody: result.responseBody,
        error: result.error,
        duration: result.duration,
      },
    });
  } catch (err) {
    logger.error("Failed to record webhook delivery", {
      webhookId,
      err,
    });
  }
}

/**
 * Test a webhook configuration by sending a test payload
 */
export async function testWebhook(
  webhook: Webhook
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const testPayload = {
      event: "TEST",
      webhookId: webhook.id,
      timestamp: new Date().toISOString(),
      message: "This is a test webhook delivery from Survey Tool",
      data: {
        test: true,
      },
    };

    const body = JSON.stringify(testPayload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SurveyTool-Webhook/1.0",
    };

    if (webhook.secret) {
      const crypto = await import("crypto");
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(body)
        .digest("hex");
      headers["X-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10000), // 10 second timeout for tests
    });

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `Request failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      statusCode: response.status,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Retry failed webhook deliveries (for background job)
 */
export async function retryFailedDeliveries(
  maxRetries: number = 3,
  maxAge: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<number> {
  // Find failed deliveries that should be retried
  const cutoff = new Date(Date.now() - maxAge);

  const failedDeliveries = await db.webhookDelivery.findMany({
    where: {
      error: { not: null },
      deliveredAt: { gte: cutoff },
    },
    include: {
      webhook: true,
    },
    orderBy: { deliveredAt: "asc" },
    take: 100,
  });

  // Group by webhook to count retries
  const retriesByWebhook = new Map<string, number>();

  let retriedCount = 0;

  for (const delivery of failedDeliveries) {
    const retryCount = retriesByWebhook.get(delivery.webhookId) || 0;

    if (retryCount >= maxRetries) continue;
    if (!delivery.webhook.enabled) continue;

    // Re-fetch the original response data would be needed here
    // For now, we just log that a retry would happen
    logger.info("Would retry webhook delivery", {
      deliveryId: delivery.id,
      webhookId: delivery.webhookId,
      retryCount: retryCount + 1,
    });

    retriesByWebhook.set(delivery.webhookId, retryCount + 1);
    retriedCount++;
  }

  return retriedCount;
}
