import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: 30 requests per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      windowSeconds: 60,
      prefix: "public-results",
    });
    if (rateLimitResult) return rateLimitResult;

    const { id } = await params;

    const survey = await db.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            answers: {
              include: {
                response: {
                  select: {
                    completedAt: true,
                    // Don't include respondent info for public view
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    // Publicly accessible results don't require auth
    // Just return the data

    return apiSuccess({
      id: survey.id,
      title: survey.title,
      description: survey.description,
      isAnonymous: survey.isAnonymous,
      createdAt: survey.createdAt.toISOString(),
      questions: survey.questions.map((q) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        options: q.options,
        answers: q.answers.map((a) => ({
          id: a.id,
          questionId: a.questionId,
          value: a.value,
          response: {
            completedAt: a.response.completedAt?.toISOString(),
          },
        })),
      })),
      _count: survey._count,
    });
  } catch (error) {
    logger.error("Error fetching public results", error);
    return apiError("Failed to fetch results", 500);
  }
}
