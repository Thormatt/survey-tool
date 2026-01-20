import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { responseSchema, formatZodErrors } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { Prisma } from "@/generated/prisma/client";
import { emitResponseSubmitted } from "@/lib/events";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 requests per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      windowSeconds: 60,
      prefix: "responses",
    });
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();

    // Validate input
    const result = responseSchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { surveyId, answers, respondentEmail, respondentName } = result.data;

    // Validate survey exists and is published
    const survey = await db.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    if (!survey.published) {
      return apiError("Survey is not available", 403);
    }

    // Check if survey is closed
    if (survey.closesAt && new Date(survey.closesAt) < new Date()) {
      return apiError("Survey has closed", 403);
    }

    // For INVITE_ONLY surveys, verify email and check if already completed
    if (survey.accessType === "INVITE_ONLY") {
      if (!respondentEmail) {
        return apiError("Email required for invite-only survey", 400);
      }

      const invitation = await db.invitation.findUnique({
        where: {
          surveyId_email: {
            surveyId,
            email: respondentEmail.toLowerCase(),
          },
        },
      });

      if (!invitation) {
        return apiError("Not invited to this survey", 403);
      }

      if (invitation.completedAt) {
        return apiError("You have already completed this survey", 403);
      }
    }

    // Create response
    const response = await db.response.create({
      data: {
        surveyId,
        respondentEmail: survey.isAnonymous ? null : respondentEmail,
        respondentName: survey.isAnonymous ? null : respondentName,
        metadata: {
          userAgent: request.headers.get("user-agent"),
          submittedAt: new Date().toISOString(),
        },
      },
    });

    // Create answers individually (createMany uses transactions not supported in Neon HTTP mode)
    if (answers && answers.length > 0) {
      for (const answer of answers) {
        await db.answer.create({
          data: {
            responseId: response.id,
            questionId: answer.questionId,
            value: answer.value as Prisma.InputJsonValue,
          },
        });
      }
    }

    // Mark invitation as completed for INVITE_ONLY surveys
    if (survey.accessType === "INVITE_ONLY" && respondentEmail) {
      await db.invitation.update({
        where: {
          surveyId_email: {
            surveyId,
            email: respondentEmail.toLowerCase(),
          },
        },
        data: {
          completedAt: new Date(),
          responseId: response.id,
        },
      });
    }

    // Fire response submitted event (async, don't block response)
    emitResponseSubmitted(surveyId, response.id).catch((err) => {
      logger.error("Error emitting response event", err);
    });

    return apiSuccess({ success: true, responseId: response.id }, 201);
  } catch (error) {
    logger.error("Error creating response", error);
    return apiError("Failed to submit response", 500);
  }
}
