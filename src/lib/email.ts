import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Survey <onboarding@resend.dev>";

interface SendSurveyInviteParams {
  to: string;
  surveyTitle: string;
  surveyDescription?: string;
  surveyLink: string;
  senderName?: string;
  customMessage?: string;
  customSubject?: string;
  ctaButtonText?: string;
  timeEstimate?: string;
}

export async function sendSurveyInvite({
  to,
  surveyTitle,
  surveyDescription,
  surveyLink,
  senderName = "Survey Team",
  customMessage,
  customSubject,
  ctaButtonText = "Take Survey →",
  timeEstimate = "2-3 minutes",
}: SendSurveyInviteParams) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: customSubject || `You're invited: ${surveyTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=Archivo:wght@400;500;600&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 48px 20px;">
            <tr>
              <td align="center">
                <!-- Logo -->
                <table width="600" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom: 32px;">
                      <img src="https://cdn.prod.website-files.com/686e52cd9c00136ae69ac4d6/68751c8e13a5456b2330eb95_andus-sun-1.svg" alt="Andus Labs" width="48" height="48" style="display: block;" />
                    </td>
                  </tr>
                </table>

                <!-- Main Card -->
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                  <!-- Orange Accent Bar -->
                  <tr>
                    <td style="background: linear-gradient(90deg, #FF4F01 0%, #ff7033 100%); height: 6px;"></td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 48px 48px 40px;">
                      <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #FF4F01; text-transform: uppercase; letter-spacing: 1.5px;">
                        Survey Invitation
                      </p>
                      <h1 style="margin: 0 0 24px; font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 700; color: #1a1a2e; line-height: 1.2;">
                        ${surveyTitle}
                      </h1>
                      ${surveyDescription ? `
                        <p style="margin: 0 0 24px; font-size: 17px; color: #4a4a5a; line-height: 1.7;">
                          ${surveyDescription}
                        </p>
                      ` : ''}
                      ${customMessage ? `
                        <p style="margin: 0 0 24px; font-size: 16px; color: #4a4a5a; line-height: 1.7;">
                          ${customMessage}
                        </p>
                      ` : `
                        <p style="margin: 0 0 36px; font-size: 16px; color: #6b6b7b; line-height: 1.6;">
                          ${senderName} has invited you to share your feedback. Your input is valuable and will help shape our direction.
                        </p>
                      `}

                      <!-- CTA Button -->
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td>
                            <a href="${surveyLink}" style="display: inline-block; background: linear-gradient(135deg, #FF4F01 0%, #e54600 100%); padding: 18px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(255, 79, 1, 0.4);">
                              ${ctaButtonText}
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Time estimate -->
                      <p style="margin: 24px 0 0; font-size: 14px; color: #9ca3af;">
                        ⏱ Takes about ${timeEstimate}
                      </p>
                    </td>
                  </tr>

                  <!-- Divider -->
                  <tr>
                    <td style="padding: 0 48px;">
                      <div style="border-top: 1px solid #e5e7eb;"></div>
                    </td>
                  </tr>

                  <!-- Alternative Link -->
                  <tr>
                    <td style="padding: 24px 48px 32px;">
                      <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                        Can't click the button? Copy this link:
                      </p>
                      <p style="margin: 8px 0 0; font-size: 13px; word-break: break-all;">
                        <a href="${surveyLink}" style="color: #FF4F01; text-decoration: none;">${surveyLink}</a>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer -->
                <table width="600" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding: 32px 20px;">
                      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
                        Powered by <span style="color: #9ca3af; font-weight: 500;">Andus Labs</span>
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #4b5563;">
                        If you believe this was sent in error, you can safely ignore this email.
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
    from: FROM_EMAIL,
    to,
    subject: `Reminder: ${surveyTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=Archivo:wght@400;500;600&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 48px 20px;">
            <tr>
              <td align="center">
                <!-- Logo -->
                <table width="600" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom: 32px;">
                      <img src="https://cdn.prod.website-files.com/686e52cd9c00136ae69ac4d6/68751c8e13a5456b2330eb95_andus-sun-1.svg" alt="Andus Labs" width="48" height="48" style="display: block;" />
                    </td>
                  </tr>
                </table>

                <!-- Main Card -->
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                  <!-- Amber Accent Bar for reminder -->
                  <tr>
                    <td style="background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%); height: 6px;"></td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 48px 48px 40px;">
                      <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 1.5px;">
                        ⏰ Friendly Reminder
                      </p>
                      <h1 style="margin: 0 0 24px; font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 700; color: #1a1a2e; line-height: 1.2;">
                        ${surveyTitle}
                      </h1>
                      <p style="margin: 0 0 24px; font-size: 17px; color: #4a4a5a; line-height: 1.7;">
                        We noticed you haven't completed this survey yet. Your feedback is valuable and will help us improve!
                      </p>
                      ${daysRemaining ? `
                        <div style="margin: 0 0 32px; padding: 16px 20px; background-color: #fef3c7; border-radius: 10px; border-left: 4px solid #f59e0b;">
                          <p style="margin: 0; font-size: 15px; color: #92400e; font-weight: 500;">
                            ⚡ This survey closes in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}
                          </p>
                        </div>
                      ` : ''}

                      <!-- CTA Button -->
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td>
                            <a href="${surveyLink}" style="display: inline-block; background: linear-gradient(135deg, #FF4F01 0%, #e54600 100%); padding: 18px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(255, 79, 1, 0.4);">
                              Complete Survey →
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 24px 0 0; font-size: 14px; color: #9ca3af;">
                        ⏱ Takes about 2-3 minutes
                      </p>
                    </td>
                  </tr>

                  <!-- Divider -->
                  <tr>
                    <td style="padding: 0 48px;">
                      <div style="border-top: 1px solid #e5e7eb;"></div>
                    </td>
                  </tr>

                  <!-- Alternative Link -->
                  <tr>
                    <td style="padding: 24px 48px 32px;">
                      <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                        Can't click the button? Copy this link:
                      </p>
                      <p style="margin: 8px 0 0; font-size: 13px; word-break: break-all;">
                        <a href="${surveyLink}" style="color: #FF4F01; text-decoration: none;">${surveyLink}</a>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer -->
                <table width="600" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding: 32px 20px;">
                      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
                        Powered by <span style="color: #9ca3af; font-weight: 500;">Andus Labs</span>
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #4b5563;">
                        If you've already completed the survey, please disregard this email.
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
