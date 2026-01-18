import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";
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

    // First check survey ownership without loading all answers
    const survey = await db.survey.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        isAnonymous: true,
        userId: true,
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    // Check ownership
    if (survey.userId !== userId) {
      return apiError("Unauthorized", 403);
    }

    const pagination = getPaginationParams(request);

    // Get questions with paginated answers
    const questions = await db.question.findMany({
      where: { surveyId: id },
      orderBy: { order: "asc" },
      include: {
        answers: {
          ...prismaPagination(pagination),
          include: {
            response: {
              select: {
                completedAt: true,
                respondentEmail: true,
                respondentName: true,
              },
            },
          },
        },
      },
    });

    // Get total answers count for pagination
    const totalAnswers = await db.answer.count({
      where: {
        question: { surveyId: id },
      },
    });

    return apiSuccess({
      ...survey,
      questions,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalAnswers,
        totalPages: Math.ceil(totalAnswers / pagination.limit),
      },
    });
  } catch (error) {
    logger.error("Error fetching survey results", error);
    return apiError("Failed to fetch results", 500);
  }
}
