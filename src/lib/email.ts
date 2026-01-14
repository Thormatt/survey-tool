import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

interface SendSurveyInviteParams {
  to: string;
  surveyTitle: string;
  surveyDescription?: string;
  surveyLink: string;
  senderName?: string;
}

export async function sendSurveyInvite({
  to,
  surveyTitle,
  surveyDescription,
  surveyLink,
  senderName = "Survey Team",
}: SendSurveyInviteParams) {
  const { data, error } = await resend.emails.send({
    from: "Survey <onboarding@resend.dev>",
    to,
    subject: `You're invited: ${surveyTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #fbf5ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fbf5ea; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 40px; border-bottom: 1px solid #dcd6f6;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <div style="width: 40px; height: 40px; background-color: #FF4F01; border-radius: 50%; display: inline-block; text-align: center; line-height: 40px;">
                              <span style="color: white; font-weight: bold; font-size: 18px;">S</span>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 600; color: #1a1a2e; line-height: 1.3;">
                        You're invited to take a survey
                      </h1>
                      <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1a1a2e;">
                        ${surveyTitle}
                      </h2>
                      ${surveyDescription ? `
                        <p style="margin: 0 0 24px; font-size: 16px; color: #6b6b7b; line-height: 1.6;">
                          ${surveyDescription}
                        </p>
                      ` : ''}
                      <p style="margin: 0 0 32px; font-size: 16px; color: #6b6b7b; line-height: 1.6;">
                        ${senderName} has invited you to share your feedback. Your response will help improve our processes.
                      </p>

                      <!-- Button -->
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background-color: #1a1a2e; border-radius: 8px;">
                            <a href="${surveyLink}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                              Take Survey
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 32px 0 0; font-size: 14px; color: #6b6b7b;">
                        Or copy this link: <a href="${surveyLink}" style="color: #FF4F01;">${surveyLink}</a>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background-color: #f9f9fb; border-top: 1px solid #dcd6f6;">
                      <p style="margin: 0; font-size: 12px; color: #6b6b7b; text-align: center;">
                        This survey was sent via Survey Tool. If you believe this was sent in error, please ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  if (error) {
    throw error;
  }

  return data;
}

interface SendSurveyReminderParams {
  to: string;
  surveyTitle: string;
  surveyLink: string;
  daysRemaining?: number;
}

export async function sendSurveyReminder({
  to,
  surveyTitle,
  surveyLink,
  daysRemaining,
}: SendSurveyReminderParams) {
  const { data, error } = await resend.emails.send({
    from: "Survey <onboarding@resend.dev>",
    to,
    subject: `Reminder: ${surveyTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #fbf5ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fbf5ea; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 40px; border-bottom: 1px solid #dcd6f6;">
                      <div style="width: 40px; height: 40px; background-color: #FF4F01; border-radius: 50%; display: inline-block; text-align: center; line-height: 40px;">
                        <span style="color: white; font-weight: bold; font-size: 18px;">S</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 600; color: #1a1a2e; line-height: 1.3;">
                        Friendly reminder
                      </h1>
                      <p style="margin: 0 0 24px; font-size: 16px; color: #6b6b7b; line-height: 1.6;">
                        We noticed you haven't completed the survey "<strong>${surveyTitle}</strong>" yet. Your feedback is valuable to us!
                      </p>
                      ${daysRemaining ? `
                        <p style="margin: 0 0 24px; font-size: 14px; color: #FF4F01; font-weight: 500;">
                          This survey closes in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.
                        </p>
                      ` : ''}

                      <!-- Button -->
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background-color: #1a1a2e; border-radius: 8px;">
                            <a href="${surveyLink}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                              Complete Survey
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background-color: #f9f9fb; border-top: 1px solid #dcd6f6;">
                      <p style="margin: 0; font-size: 12px; color: #6b6b7b; text-align: center;">
                        This is an automated reminder. If you've already completed the survey, please disregard this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  if (error) {
    throw error;
  }

  return data;
}
