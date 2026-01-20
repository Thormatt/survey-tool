import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission, PermissionError } from "@/lib/permissions";

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

    // Check view permission (owner or collaborator)
    const access = await requirePermission(id, userId, "view");

    const survey = await db.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { responses: true },
        },
        collaborators: {
          select: {
            id: true,
            userId: true,
            email: true,
            role: true,
            acceptedAt: true,
          },
        },
      },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    // Include user's access info in response
    return apiSuccess({
      ...survey,
      userAccess: {
        role: access.role,
        isOwner: access.isOwner,
        permissions: access.permissions,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error fetching survey", error);
    return apiError("Failed to fetch survey", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();

    // Check edit permission
    const access = await requirePermission(id, userId, "edit");

    // Check if publishing (requires publish permission)
    if (body.published === true && !access.permissions.publish) {
      return apiError("You don't have permission to publish this survey", 403);
    }

    // Only allow updating specific fields
    const allowedFields = ["title", "description", "published", "isAnonymous", "accessType", "closesAt"];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updatedSurvey = await db.survey.update({
      where: { id },
      data: updateData,
    });

    return apiSuccess(updatedSurvey);
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error updating survey", error);
    return apiError("Failed to update survey", 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();

    // Check edit permission
    await requirePermission(id, userId, "edit");

    // Check if survey exists
    const survey = await db.survey.findUnique({
      where: { id },
      include: { questions: true },
    });

    if (!survey) {
      return apiError("Survey not found", 404);
    }

    // Don't allow editing published surveys
    if (survey.published) {
      return apiError("Cannot edit published survey", 400);
    }

    // Update survey metadata
    await db.survey.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        published: body.published,
        accessType: body.accessType,
        isAnonymous: body.isAnonymous,
      },
    });

    // Get existing question IDs
    const existingQuestionIds = survey.questions.map((q) => q.id);
    const newQuestionIds = body.questions
      .filter((q: { id?: string }) => q.id)
      .map((q: { id: string }) => q.id);

    // Delete questions that are no longer in the list
    const questionsToDelete = existingQuestionIds.filter(
      (id) => !newQuestionIds.includes(id)
    );
    if (questionsToDelete.length > 0) {
      await db.question.deleteMany({
        where: { id: { in: questionsToDelete } },
      });
    }

    // Update or create questions
    for (let i = 0; i < body.questions.length; i++) {
      const q = body.questions[i];
      const questionData = {
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        order: i,
        options: q.options as Prisma.InputJsonValue | undefined,
        settings: q.settings as Prisma.InputJsonValue | undefined,
      };

      if (q.id && existingQuestionIds.includes(q.id)) {
        // Update existing question
        await db.question.update({
          where: { id: q.id },
          data: questionData,
        });
      } else {
        // Create new question
        await db.question.create({
          data: {
            ...questionData,
            surveyId: id,
          },
        });
      }
    }

    // Fetch and return updated survey
    const updatedSurvey = await db.survey.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } },
        _count: { select: { responses: true } },
      },
    });

    return apiSuccess(updatedSurvey);
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error updating survey", error);
    return apiError("Failed to update survey", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Check delete permission (only owner can delete)
    await requirePermission(id, userId, "delete");

    // Delete related records first (no cascade in HTTP mode)
    await db.answer.deleteMany({
      where: { response: { surveyId: id } },
    });
    await db.response.deleteMany({
      where: { surveyId: id },
    });
    await db.invitation.deleteMany({
      where: { surveyId: id },
    });
    await db.question.deleteMany({
      where: { surveyId: id },
    });
    await db.surveyCollaborator.deleteMany({
      where: { surveyId: id },
    });
    await db.collaboratorInvitation.deleteMany({
      where: { surveyId: id },
    });

    // Delete the survey
    await db.survey.delete({
      where: { id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error deleting survey", error);
    return apiError("Failed to delete survey", 500);
  }
}
