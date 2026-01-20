import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { surveySchema, formatZodErrors } from "@/lib/validations";
import { getPaginationParams, paginatedResponse, prismaPagination } from "@/lib/pagination";
import { Prisma, QuestionType } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();

    // Validate input
    const result = surveySchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { title, description, published, questions, accessType, isAnonymous, closesAt } = result.data;

    // Create survey first (without nested questions to avoid transaction)
    const survey = await db.survey.create({
      data: {
        title,
        description,
        published: published ?? false,
        userId,
        accessType: accessType ?? "UNLISTED",
        isAnonymous: isAnonymous ?? true,
        closesAt: closesAt ? new Date(closesAt) : null,
      },
    });

    // Create questions individually (createMany uses transactions which aren't supported in Neon HTTP mode)
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.question.create({
          data: {
            surveyId: survey.id,
            type: q.type as QuestionType,
            title: q.title,
            description: q.description,
            required: q.required ?? false,
            order: i,
            options: q.options as Prisma.InputJsonValue ?? null,
            settings: q.settings as Prisma.InputJsonValue ?? null,
          },
        });
      }
    }

    // Fetch the complete survey with questions
    const completeSurvey = await db.survey.findUnique({
      where: { id: survey.id },
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
    logger.error("Error creating survey", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Survey creation error details:", { errorMessage, errorStack, error });
    return apiError(`Failed to create survey: ${errorMessage}`, 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const pagination = getPaginationParams(request);
    const url = new URL(request.url);
    const includeShared = url.searchParams.get("includeShared") !== "false";

    // Build the where clause to include owned and shared surveys
    const whereClause: Prisma.SurveyWhereInput = includeShared
      ? {
          OR: [
            { userId }, // Owned surveys
            { collaborators: { some: { userId } } }, // Shared surveys
          ],
        }
      : { userId };

    // Get total count for pagination
    const total = await db.survey.count({
      where: whereClause,
    });

    const surveys = await db.survey.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      ...prismaPagination(pagination),
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { responses: true, questions: true },
        },
        collaborators: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    // Transform surveys to include role info
    const surveysWithRole = surveys.map((survey) => {
      const isOwner = survey.userId === userId;
      const collaboratorRole = survey.collaborators[0]?.role;
      return {
        ...survey,
        userRole: isOwner ? "OWNER" : collaboratorRole,
        isOwner,
        collaborators: undefined, // Remove from response
      };
    });

    return apiSuccess(paginatedResponse(surveysWithRole, total, pagination));
  } catch (error) {
    logger.error("Error fetching surveys", error);
    return apiError("Failed to fetch surveys", 500);
  }
}
