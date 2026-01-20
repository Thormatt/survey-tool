import { logger } from "@/lib/logger";

interface AlertConfig {
  emails?: string[];
  subject?: string;
  template?: string;
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
 * Send email notification for an alert
 */
export async function sendEmailNotification(
  alert: Alert,
  payload: ResponsePayload
): Promise<void> {
  const config = alert.config as AlertConfig;

  if (!config.emails || config.emails.length === 0) {
    logger.warn("Email alert has no recipients configured", {
      alertId: alert.id,
    });
    return;
  }

  const subject =
    config.subject || `Alert: New response on "${alert.survey.title}"`;

  // Build email body
  const body = buildEmailBody(alert, payload, config.template);

  // TODO: Integrate with actual email service (Resend, SendGrid, etc.)
  // For now, log the notification
  logger.info("Email notification would be sent", {
    alertId: alert.id,
    to: config.emails,
    subject,
    responseId: payload.id,
  });

  // Example integration with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: "Survey Tool <notifications@yourdomain.com>",
  //   to: config.emails,
  //   subject,
  //   html: body,
  // });
}

/**
 * Build the email body from alert config and response data
 */
function buildEmailBody(
  alert: Alert,
  payload: ResponsePayload,
  template?: string
): string {
  if (template) {
    // Replace placeholders in custom template
    return template
      .replace(/\{\{surveyTitle\}\}/g, alert.survey.title)
      .replace(/\{\{responseId\}\}/g, payload.id)
      .replace(
        /\{\{respondentEmail\}\}/g,
        payload.respondentEmail || "Anonymous"
      )
      .replace(/\{\{respondentName\}\}/g, payload.respondentName || "Anonymous")
      .replace(
        /\{\{completedAt\}\}/g,
        new Date(payload.completedAt).toLocaleString()
      )
      .replace(/\{\{answers\}\}/g, formatAnswers(payload.answers));
  }

  // Default email template
  return `
    <html>
      <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1a1a2e;">Alert: ${alert.name}</h2>
        <p>A new response was submitted that matched your alert conditions.</p>

        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0;">Survey: ${alert.survey.title}</h3>
          <p><strong>Response ID:</strong> ${payload.id}</p>
          ${payload.respondentEmail ? `<p><strong>Respondent:</strong> ${payload.respondentName || ""} &lt;${payload.respondentEmail}&gt;</p>` : "<p><strong>Respondent:</strong> Anonymous</p>"}
          <p><strong>Submitted:</strong> ${new Date(payload.completedAt).toLocaleString()}</p>
        </div>

        <h3>Answers:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #e5e5e5;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Question</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Answer</th>
            </tr>
          </thead>
          <tbody>
            ${payload.answers
              .map(
                (a) => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.questionTitle}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${formatAnswerValue(a.value)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <p style="margin-top: 24px; color: #666; font-size: 12px;">
          This is an automated notification from Survey Tool.
        </p>
      </body>
    </html>
  `;
}

/**
 * Format answers as a simple text list
 */
function formatAnswers(
  answers: Array<{ questionTitle: string; value: unknown }>
): string {
  return answers
    .map((a) => `${a.questionTitle}: ${formatAnswerValue(a.value)}`)
    .join("\n");
}

/**
 * Format a single answer value for display
 */
function formatAnswerValue(value: unknown): string {
  if (value == null) return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
