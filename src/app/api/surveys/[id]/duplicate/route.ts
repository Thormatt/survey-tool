import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Fetch the original survey with questions
    const original = await db.survey.findFirst({
      where: {
        id,
        userId, // Only allow duplicating own surveys
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!original) {
      return apiError("Survey not found", 404);
    }

    // Create the duplicate survey (as draft)
    const duplicateSurvey = await db.survey.create({
      data: {
        title: `${original.title} (Copy)`,
        description: original.description,
        published: false, // Always create as draft
        userId,
        accessType: original.accessType,
        isAnonymous: original.isAnonymous,
        closesAt: null, // Don't copy closing date
      },
    });

    // Duplicate questions individually (createMany uses transactions not supported in Neon HTTP mode)
    if (original.questions.length > 0) {
      for (const question of original.questions) {
        await db.question.create({
          data: {
            surveyId: duplicateSurvey.id,
            type: question.type,
            title: question.title,
            description: question.description,
            required: question.required,
            order: question.order,
            options: question.options as Prisma.InputJsonValue | undefined,
            settings: question.settings as Prisma.InputJsonValue | undefined,
          },
        });
      }
    }

    // Fetch the complete duplicated survey
    const completeSurvey = await db.survey.findUnique({
      where: { id: duplicateSurvey.id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    return apiSuccess(completeSurvey, 201);
  } catch (error) {
    logger.error("Error duplicating survey", error);
    return apiError("Failed to duplicate survey", 500);
  }
}
