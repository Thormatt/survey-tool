import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { sendSurveyInvite } from "@/lib/email";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { invitationSchema, formatZodErrors } from "@/lib/validations";
import { rateLimitByUser } from "@/lib/rate-limit";
import { sanitizeEmailHeader, sanitizeEmailSubject } from "@/lib/html";
import { getPaginationParams, paginatedResponse, prismaPagination } from "@/lib/pagination";

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

    // Check survey ownership
    const survey = await db.survey.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    if (survey.userId !== userId) {
      return apiError("Unauthorized", 403);
    }

    const pagination = getPaginationParams(request);

    // Get total count for pagination
    const total = await db.invitation.count({
      where: { surveyId: id },
    });

    const invitations = await db.invitation.findMany({
      where: { surveyId: id },
      orderBy: { sentAt: "desc" },
      ...prismaPagination(pagination),
    });

    return apiSuccess(paginatedResponse(invitations, total, pagination));
  } catch (error) {
    logger.error("Error fetching invitations", error);
    return apiError("Failed to fetch invitations", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    // Rate limiting: 5 requests per minute per user
    const rateLimitResult = await rateLimitByUser(userId, {
      limit: 5,
      windowSeconds: 60,
      prefix: "invitations",
    });
    if (rateLimitResult) return rateLimitResult;

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const result = invitationSchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { emails, subject, senderName, customMessage, emailTitle, ctaButtonText, timeEstimate } = result.data;

    // Check survey ownership
    const survey = await db.survey.findUnique({
      where: { id },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    if (survey.userId !== userId) {
      return apiError("Unauthorized", 403);
    }

    if (!survey.published) {
      return apiError("Survey must be published before sending invitations", 400);
    }

    // Sanitize email headers to prevent header injection
    const sanitizedSubject = subject ? sanitizeEmailSubject(subject) : undefined;
    const sanitizedSenderName = senderName ? sanitizeEmailHeader(senderName) : undefined;

    // Batch check existing invitations
    const existingInvitations = await db.invitation.findMany({
      where: {
        surveyId: id,
        email: { in: emails.map((e) => e.toLowerCase()) },
      },
      select: { email: true },
    });

    const existingEmails = new Set(existingInvitations.map((inv) => inv.email.toLowerCase()));
    const newEmails = emails.filter((email) => !existingEmails.has(email.toLowerCase()));

    const results: { email: string; success: boolean; error?: string }[] = [];

    // Mark existing emails as already invited
    for (const email of emails) {
      if (existingEmails.has(email.toLowerCase())) {
        results.push({ email, success: false, error: "Already invited" });
      }
    }

    if (newEmails.length === 0) {
      return apiSuccess({ results });
    }

    // Create invitations individually (createMany uses transactions not supported in Neon HTTP mode)
    for (const email of newEmails) {
      await db.invitation.create({
        data: {
          surveyId: id,
          email: email.toLowerCase(),
        },
      });
    }

    // Fetch created invitations to get tokens
    const createdInvitations = await db.invitation.findMany({
      where: {
        surveyId: id,
        email: { in: newEmails.map((e) => e.toLowerCase()) },
      },
    });

    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

    // Send emails in batches of 10 to avoid overwhelming the email service
    const BATCH_SIZE = 10;
    for (let i = 0; i < createdInvitations.length; i += BATCH_SIZE) {
      const batch = createdInvitations.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (invitation) => {
          try {
            const surveyLink = `${baseUrl}/s/${id}?token=${invitation.token}`;
            await sendSurveyInvite({
              to: invitation.email,
              surveyTitle: emailTitle || survey.title,
              surveyDescription: survey.description || undefined,
              surveyLink,
              senderName: sanitizedSenderName,
              customMessage: customMessage || undefined,
              customSubject: sanitizedSubject,
              ctaButtonText: ctaButtonText || undefined,
              timeEstimate: timeEstimate || undefined,
            });
            results.push({ email: invitation.email, success: true });
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`Failed to send invitation to ${invitation.email}`, err);
            results.push({ email: invitation.email, success: false, error: errorMessage });
          }
        })
      );
    }

    return apiSuccess({ results });
  } catch (error) {
    logger.error("Error sending invitations", error);
    return apiError("Failed to send invitations", 500);
  }
}
