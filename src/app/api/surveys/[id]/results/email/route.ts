import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get survey with results
    const survey = await db.survey.findUnique({
      where: { id, userId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            answers: true,
          },
        },
        invitations: {
          where: {
            completedAt: { not: null },
          },
          select: {
            email: true,
          },
        },
        responses: {
          where: {
            respondentEmail: { not: null },
          },
          select: {
            respondentEmail: true,
            respondentName: true,
          },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Collect unique emails to send to
    const emails = new Set<string>();

    // From invitations
    survey.invitations.forEach((inv) => {
      if (inv.email) emails.add(inv.email.toLowerCase());
    });

    // From responses (non-anonymous)
    if (!survey.isAnonymous) {
      survey.responses.forEach((resp) => {
        if (resp.respondentEmail) emails.add(resp.respondentEmail.toLowerCase());
      });
    }

    if (emails.size === 0) {
      return NextResponse.json(
        { error: "No participants to send results to" },
        { status: 400 }
      );
    }

    // Calculate statistics for email
    const totalResponses = survey._count.responses;
    const questionStats = survey.questions.map((q) => {
      const answerCount = q.answers.length;

      if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") {
        const counts: Record<string, number> = {};
        (q.options as string[] || []).forEach((opt) => (counts[opt] = 0));

        q.answers.forEach((a) => {
          if (Array.isArray(a.value)) {
            (a.value as string[]).forEach((v) => {
              if (counts[v] !== undefined) counts[v]++;
            });
          } else if (typeof a.value === "string" && counts[a.value] !== undefined) {
            counts[a.value]++;
          }
        });

        const topOption = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
        return {
          title: q.title,
          type: q.type,
          responseCount: answerCount,
          topResponse: topOption ? topOption[0] : null,
          topPercentage: topOption && answerCount > 0
            ? Math.round((topOption[1] / answerCount) * 100)
            : 0,
        };
      }

      if (q.type === "RATING" || q.type === "SCALE") {
        const values = q.answers.map((a) => Number(a.value)).filter((v) => !isNaN(v));
        const avg = values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
        return {
          title: q.title,
          type: q.type,
          responseCount: answerCount,
          average: avg.toFixed(1),
          maxValue: q.type === "RATING" ? 5 : 10,
        };
      }

      return {
        title: q.title,
        type: q.type,
        responseCount: answerCount,
      };
    });

    // Generate beautiful HTML email
    const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"}/results/${survey.id}`;

    const htmlEmail = generateResultsEmail({
      surveyTitle: survey.title,
      surveyDescription: survey.description || "",
      totalResponses,
      questionStats,
      resultsUrl,
    });

    // Send emails
    const emailList = Array.from(emails);
    const results = await Promise.allSettled(
      emailList.map((email) =>
        resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Survey Tool <onboarding@resend.dev>",
          to: email,
          subject: `Survey Results: ${survey.title}`,
          html: htmlEmail,
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: emailList.length,
    });
  } catch (error) {
    console.error("Error sending results email:", error);
    return NextResponse.json(
      { error: "Failed to send results email" },
      { status: 500 }
    );
  }
}

interface QuestionStat {
  title: string;
  type: string;
  responseCount: number;
  topResponse?: string | null;
  topPercentage?: number;
  average?: string;
  maxValue?: number;
}

function generateResultsEmail({
  surveyTitle,
  surveyDescription,
  totalResponses,
  questionStats,
  resultsUrl,
}: {
  surveyTitle: string;
  surveyDescription: string;
  totalResponses: number;
  questionStats: QuestionStat[];
  resultsUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Survey Results</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse;}
    .mso-hide {display: none !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #fbf5ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fbf5ea;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #FF4F01 0%, #FF7A33 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Survey Results</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${surveyTitle}</p>
            </td>
          </tr>

          ${surveyDescription ? `
          <!-- Description -->
          <tr>
            <td style="padding: 20px 40px 0;">
              <p style="margin: 0; color: #6b6b7b; font-size: 14px; line-height: 1.6; text-align: center;">${surveyDescription}</p>
            </td>
          </tr>
          ` : ''}

          <!-- Stats Card -->
          <tr>
            <td style="padding: 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%); border-radius: 12px; padding: 24px 40px;">
                      <tr>
                        <td align="center">
                          <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Responses</p>
                          <p style="margin: 8px 0 0; color: #ffffff; font-size: 48px; font-weight: 700;">${totalResponses}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Question Results -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 18px; font-weight: 600;">Results Summary</h2>
              ${questionStats.map((q, i) => `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; background-color: #fbf5ea; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #FF4F01 0%, #FF7A33 100%); border-radius: 50%; color: #ffffff; font-weight: 700; font-size: 14px; line-height: 32px; text-align: center;">${i + 1}</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0 0 4px; color: #1a1a2e; font-size: 15px; font-weight: 600;">${q.title}</p>
                          ${q.topResponse ? `
                          <p style="margin: 0; color: #6b6b7b; font-size: 13px;">
                            Top answer: <span style="color: #FF4F01; font-weight: 600;">${q.topResponse}</span> (${q.topPercentage}%)
                          </p>
                          ` : ''}
                          ${q.average ? `
                          <p style="margin: 0; color: #6b6b7b; font-size: 13px;">
                            Average: <span style="color: #FF4F01; font-weight: 600;">${q.average}</span> out of ${q.maxValue}
                          </p>
                          ` : ''}
                          ${!q.topResponse && !q.average ? `
                          <p style="margin: 0; color: #6b6b7b; font-size: 13px;">
                            ${q.responseCount} responses
                          </p>
                          ` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              `).join('')}
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px;" align="center">
              <a href="${resultsUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #FF4F01 0%, #FF7A33 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 14px rgba(255, 79, 1, 0.3);">View Full Results</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f5f3ff; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0; color: #6b6b7b; font-size: 13px;">
                This email was sent because you participated in this survey.
              </p>
              <p style="margin: 8px 0 0; color: #a99de0; font-size: 12px;">
                Powered by SurveyTool
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
