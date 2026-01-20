import { logger } from "@/lib/logger";

interface AlertConfig {
  slackWebhookUrl?: string;
  channel?: string;
  mentionUsers?: string[];
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

interface Alert {
  id: string;
  name: string;
  config: unknown;
  survey: { title: string };
}

/**
 * Send Slack notification for an alert
 */
export async function sendSlackNotification(
  alert: Alert,
  payload: ResponsePayload
): Promise<void> {
  const config = alert.config as AlertConfig;

  if (!config.slackWebhookUrl) {
    logger.warn("Slack alert has no webhook URL configured", {
      alertId: alert.id,
    });
    return;
  }

  const message = buildSlackMessage(alert, payload, config);

  try {
    const response = await fetch(config.slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack webhook failed: ${response.status} - ${text}`);
    }

    logger.info("Slack notification sent", {
      alertId: alert.id,
      responseId: payload.id,
    });
  } catch (error) {
    logger.error("Failed to send Slack notification", {
      alertId: alert.id,
      error,
    });
    throw error;
  }
}

/**
 * Build Slack Block Kit message
 */
function buildSlackMessage(
  alert: Alert,
  payload: ResponsePayload,
  config: AlertConfig
): Record<string, unknown> {
  const mentions = config.mentionUsers?.length
    ? config.mentionUsers.map((u) => `<@${u}>`).join(" ") + " "
    : "";

  const respondent = payload.respondentEmail
    ? `${payload.respondentName || ""} <${payload.respondentEmail}>`.trim()
    : "Anonymous";

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🔔 ${alert.name}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${mentions}A new response was submitted that matched your alert conditions.`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Survey:*\n${alert.survey.title}`,
        },
        {
          type: "mrkdwn",
          text: `*Respondent:*\n${respondent}`,
        },
        {
          type: "mrkdwn",
          text: `*Submitted:*\n${new Date(payload.completedAt).toLocaleString()}`,
        },
        {
          type: "mrkdwn",
          text: `*Response ID:*\n${payload.id}`,
        },
      ],
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Answers:*",
      },
    },
    // Add answer fields (limited to first 10 to avoid Slack limits)
    ...payload.answers.slice(0, 10).map((answer) => ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${truncateText(answer.questionTitle, 50)}*\n${formatAnswerValue(answer.value)}`,
      },
    })),
  ];

  // Add truncation notice if needed
  if (payload.answers.length > 10) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_...and ${payload.answers.length - 10} more answers_`,
        },
      ],
    });
  }

  // Add view response button
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Response",
            emoji: true,
          },
          url: `${appUrl}/surveys/${payload.surveyId}/results`,
          action_id: "view_response",
        },
      ],
    });
  }

  return {
    channel: config.channel,
    blocks,
  };
}

/**
 * Format answer value for Slack display
 */
function formatAnswerValue(value: unknown): string {
  if (value == null) return "_No answer_";
  if (Array.isArray(value)) {
    if (value.length === 0) return "_No selection_";
    return value.map((v) => `• ${v}`).join("\n");
  }
  if (typeof value === "object") {
    return `\`${JSON.stringify(value)}\``;
  }
  return truncateText(String(value), 500);
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
