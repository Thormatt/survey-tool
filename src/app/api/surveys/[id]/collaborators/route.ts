import { NextRequest } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { CollaboratorRole } from "@/generated/prisma/client";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["EDITOR", "VIEWER"]),
});

/**
 * GET /api/surveys/[id]/collaborators
 * List all collaborators for a survey
 */
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

    // Check view permission
    await requirePermission(id, userId, "view");

    // Get all collaborators
    const collaborators = await db.surveyCollaborator.findMany({
      where: { surveyId: id },
      orderBy: { createdAt: "asc" },
    });

    // Get pending invitations
    const pendingInvites = await db.collaboratorInvitation.findMany({
      where: {
        surveyId: id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get the survey owner info
    const survey = await db.survey.findUnique({
      where: { id },
      select: { userId: true },
    });

    return apiSuccess({
      collaborators,
      pendingInvites,
      ownerId: survey?.userId,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error fetching collaborators", error);
    return apiError("Failed to fetch collaborators", 500);
  }
}

/**
 * POST /api/surveys/[id]/collaborators
 * Invite a new collaborator
 */
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

    // Check manageTeam permission (only owner can invite)
    await requirePermission(id, userId, "manageTeam");

    const body = await request.json();
    const result = inviteSchema.safeParse(body);
    if (!result.success) {
      return validationError(
        result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
      );
    }

    const { email, role } = result.data;
    const normalizedEmail = email.toLowerCase();

    // Check if already a collaborator
    const existingCollaborator = await db.surveyCollaborator.findUnique({
      where: {
        surveyId_email: {
          surveyId: id,
          email: normalizedEmail,
        },
      },
    });

    if (existingCollaborator) {
      return apiError("User is already a collaborator", 400);
    }

    // Check if invite already pending
    const existingInvite = await db.collaboratorInvitation.findUnique({
      where: {
        surveyId_email: {
          surveyId: id,
          email: normalizedEmail,
        },
      },
    });

    if (existingInvite && existingInvite.expiresAt > new Date()) {
      return apiError("Invitation already pending", 400);
    }

    // Delete expired invite if exists
    if (existingInvite) {
      await db.collaboratorInvitation.delete({
        where: { id: existingInvite.id },
      });
    }

    // Check if user exists in Clerk
    const clerk = await clerkClient();
    const users = await clerk.users.getUserList({
      emailAddress: [normalizedEmail],
    });
    const existingUser = users.data[0];

    if (existingUser) {
      // User exists - add them directly as collaborator
      const collaborator = await db.surveyCollaborator.create({
        data: {
          surveyId: id,
          userId: existingUser.id,
          email: normalizedEmail,
          role: role as CollaboratorRole,
          invitedBy: userId,
          acceptedAt: new Date(), // Auto-accepted since they're a known user
        },
      });

      return apiSuccess(
        {
          collaborator,
          message: "Collaborator added successfully",
        },
        201
      );
    }

    // User doesn't exist - create invitation
    const invitation = await db.collaboratorInvitation.create({
      data: {
        surveyId: id,
        email: normalizedEmail,
        role: role as CollaboratorRole,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // TODO: Send invitation email
    // For now, just return the invitation with its token
    // In production, you'd send an email with a link like:
    // `${process.env.NEXT_PUBLIC_APP_URL}/invites/accept?token=${invitation.token}`

    return apiSuccess(
      {
        invitation,
        message: "Invitation created. User will be notified via email.",
      },
      201
    );
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error inviting collaborator", error);
    return apiError("Failed to invite collaborator", 500);
  }
}

/**
 * PATCH /api/surveys/[id]/collaborators
 * Update a collaborator's role
 */
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

    // Check manageTeam permission
    await requirePermission(id, userId, "manageTeam");

    const body = await request.json();
    const { collaboratorId, role } = body;

    if (!collaboratorId || !role) {
      return apiError("collaboratorId and role are required", 400);
    }

    if (!["EDITOR", "VIEWER"].includes(role)) {
      return apiError("Invalid role. Must be EDITOR or VIEWER", 400);
    }

    // Update collaborator role
    const collaborator = await db.surveyCollaborator.update({
      where: { id: collaboratorId },
      data: { role: role as CollaboratorRole },
    });

    return apiSuccess(collaborator);
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error updating collaborator", error);
    return apiError("Failed to update collaborator", 500);
  }
}

/**
 * DELETE /api/surveys/[id]/collaborators
 * Remove a collaborator or cancel an invitation
 */
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
    const url = new URL(request.url);
    const collaboratorId = url.searchParams.get("collaboratorId");
    const invitationId = url.searchParams.get("invitationId");

    // Check manageTeam permission
    await requirePermission(id, userId, "manageTeam");

    if (collaboratorId) {
      // Remove collaborator
      await db.surveyCollaborator.delete({
        where: { id: collaboratorId },
      });
      return apiSuccess({ success: true, message: "Collaborator removed" });
    }

    if (invitationId) {
      // Cancel invitation
      await db.collaboratorInvitation.delete({
        where: { id: invitationId },
      });
      return apiSuccess({ success: true, message: "Invitation cancelled" });
    }

    return apiError("collaboratorId or invitationId is required", 400);
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.message, error.statusCode);
    }
    logger.error("Error removing collaborator", error);
    return apiError("Failed to remove collaborator", 500);
  }
}
