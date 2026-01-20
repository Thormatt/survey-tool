import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { EventType } from "@/generated/prisma/client";
import { sendEmailNotification } from "@/lib/notifications/email-notification";
import { sendSlackNotification } from "@/lib/notifications/slack-notification";
import { sendWebhookNotification } from "@/lib/notifications/webhook-notification";

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
 * Emit a response submitted event
 * Triggers webhooks and evaluates alert conditions
 */
export async function emitResponseSubmitted(
  surveyId: string,
  responseId: string
): Promise<void> {
  try {
    // Fetch the response with answers
    const response = await db.response.findUnique({
      where: { id: responseId },
      include: {
        answers: {
          include: {
            question: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        },
        survey: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!response) {
      logger.warn("Response not found for event emission", { responseId });
      return;
    }

    const payload: ResponsePayload = {
      id: response.id,
      surveyId: response.surveyId,
      completedAt: response.completedAt,
      respondentEmail: response.respondentEmail,
      respondentName: response.respondentName,
      answers: response.answers.map((a) => ({
        questionId: a.question.id,
        questionTitle: a.question.title,
        questionType: a.question.type,
        value: a.value,
      })),
    };

    // Process webhooks and alerts in parallel
    await Promise.all([
      processWebhooks(surveyId, EventType.RESPONSE_SUBMITTED, payload),
      processAlerts(surveyId, payload),
    ]);

    logger.info("Response submitted event processed", {
      surveyId,
      responseId,
    });
  } catch (error) {
    logger.error("Error emitting response submitted event", error);
    // Don't throw - event processing should not break the main flow
  }
}

/**
 * Process webhooks for a given event
 */
async function processWebhooks(
  surveyId: string,
  eventType: EventType,
  payload: ResponsePayload
): Promise<void> {
  // Find enabled webhooks for this survey and event type
  const webhooks = await db.webhook.findMany({
    where: {
      surveyId,
      enabled: true,
      events: {
        has: eventType,
      },
    },
  });

  if (webhooks.length === 0) return;

  // Send to each webhook
  await Promise.allSettled(
    webhooks.map((webhook) =>
      sendWebhookNotification(webhook, eventType, payload)
    )
  );
}

/**
 * Process alerts for a response
 * Evaluates trigger conditions and sends notifications
 */
async function processAlerts(
  surveyId: string,
  payload: ResponsePayload
): Promise<void> {
  // Find enabled alerts with their triggers
  const alerts = await db.alert.findMany({
    where: {
      surveyId,
      enabled: true,
    },
    include: {
      triggers: true,
      survey: {
        select: {
          title: true,
        },
      },
    },
  });

  if (alerts.length === 0) return;

  // Create answer lookup map
  const answerMap = new Map<string, unknown>();
  for (const answer of payload.answers) {
    answerMap.set(answer.questionId, answer.value);
  }

  // Evaluate each alert
  for (const alert of alerts) {
    // If no triggers, skip (must have at least one trigger)
    if (alert.triggers.length === 0) continue;

    // Check if all trigger conditions are met
    const allTriggersMatched = alert.triggers.every((trigger) =>
      evaluateTrigger(trigger, answerMap)
    );

    if (allTriggersMatched) {
      // Send notification based on channel
      try {
        switch (alert.channel) {
          case "EMAIL":
            await sendEmailNotification(alert, payload);
            break;
          case "SLACK":
            await sendSlackNotification(alert, payload);
            break;
          case "WEBHOOK":
            // Webhook channel uses alert config for URL
            await sendAlertWebhook(alert, payload);
            break;
        }

        logger.info("Alert triggered and notification sent", {
          alertId: alert.id,
          channel: alert.channel,
        });
      } catch (error) {
        logger.error("Error sending alert notification", {
          alertId: alert.id,
          error,
        });
      }
    }
  }
}

/**
 * Evaluate a single trigger condition against the answers
 */
function evaluateTrigger(
  trigger: { questionId: string; operator: string; value: unknown },
  answerMap: Map<string, unknown>
): boolean {
  const answer = answerMap.get(trigger.questionId);
  const targetValue = trigger.value;

  switch (trigger.operator) {
    case "EQUALS":
      return compareValues(answer, targetValue) === 0;

    case "NOT_EQUALS":
      return compareValues(answer, targetValue) !== 0;

    case "GREATER_THAN":
      return compareValues(answer, targetValue) > 0;

    case "LESS_THAN":
      return compareValues(answer, targetValue) < 0;

    case "CONTAINS":
      return containsValue(answer, targetValue);

    case "IS_EMPTY":
      return isEmpty(answer);

    default:
      return false;
  }
}

/**
 * Compare two values, handling different types
 */
function compareValues(a: unknown, b: unknown): number {
  // Handle null/undefined
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  // Try numeric comparison
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }

  // String comparison
  return String(a).localeCompare(String(b));
}

/**
 * Check if a value contains another value
 */
function containsValue(answer: unknown, target: unknown): boolean {
  if (answer == null) return false;

  // Array check
  if (Array.isArray(answer)) {
    return answer.some(
      (item) => String(item).toLowerCase() === String(target).toLowerCase()
    );
  }

  // String check
  return String(answer)
    .toLowerCase()
    .includes(String(target).toLowerCase());
}

/**
 * Check if a value is empty
 */
function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Send alert via webhook channel
 */
async function sendAlertWebhook(
  alert: { id: string; config: unknown; survey: { title: string } },
  payload: ResponsePayload
): Promise<void> {
  const config = alert.config as { webhookUrl?: string; secret?: string };
  if (!config.webhookUrl) {
    logger.warn("Alert webhook missing URL", { alertId: alert.id });
    return;
  }

  const body = JSON.stringify({
    event: "TRIGGER_MATCHED",
    alertId: alert.id,
    survey: {
      id: payload.surveyId,
      title: alert.survey.title,
    },
    response: payload,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add signature if secret is configured
  if (config.secret) {
    const crypto = await import("crypto");
    const signature = crypto
      .createHmac("sha256", config.secret)
      .update(body)
      .digest("hex");
    headers["X-Signature"] = `sha256=${signature}`;
  }

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`);
  }
}
