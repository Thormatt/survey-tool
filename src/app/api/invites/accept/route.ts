import { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";

/**
 * POST /api/invites/accept
 * Accept a collaboration invitation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Please sign in to accept this invitation", 401);
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return apiError("Invitation token is required", 400);
    }

    // Find the invitation
    const invitation = await db.collaboratorInvitation.findUnique({
      where: { token },
      include: {
        survey: {
          select: { id: true, title: true },
        },
      },
    });

    if (!invitation) {
      return apiError("Invitation not found or already used", 404);
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      await db.collaboratorInvitation.delete({
        where: { id: invitation.id },
      });
      return apiError("This invitation has expired", 400);
    }

    // Get current user's email
    const user = await currentUser();
    const userEmail = user?.emailAddresses[0]?.emailAddress?.toLowerCase();

    // Verify email matches invitation (optional - can be relaxed)
    if (userEmail && userEmail !== invitation.email.toLowerCase()) {
      // Allow accepting with different email, but log it
      logger.warn("User accepting invite with different email", {
        inviteEmail: invitation.email,
        userEmail,
      });
    }

    // Check if user is already a collaborator
    const existingCollaborator = await db.surveyCollaborator.findUnique({
      where: {
        surveyId_userId: {
          surveyId: invitation.surveyId,
          userId,
        },
      },
    });

    if (existingCollaborator) {
      // Delete the invitation since they're already a collaborator
      await db.collaboratorInvitation.delete({
        where: { id: invitation.id },
      });
      return apiError("You are already a collaborator on this survey", 400);
    }

    // Create the collaborator and delete the invitation
    const collaborator = await db.surveyCollaborator.create({
      data: {
        surveyId: invitation.surveyId,
        userId,
        email: userEmail || invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        acceptedAt: new Date(),
      },
    });

    // Delete the invitation
    await db.collaboratorInvitation.delete({
      where: { id: invitation.id },
    });

    return apiSuccess({
      collaborator,
      survey: invitation.survey,
      message: `You are now a ${invitation.role.toLowerCase()} on "${invitation.survey.title}"`,
    });
  } catch (error) {
    logger.error("Error accepting invitation", error);
    return apiError("Failed to accept invitation", 500);
  }
}

/**
 * GET /api/invites/accept?token=xxx
 * Get invitation details (for preview before accepting)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return apiError("Invitation token is required", 400);
    }

    // Find the invitation
    const invitation = await db.collaboratorInvitation.findUnique({
      where: { token },
      include: {
        survey: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });

    if (!invitation) {
      return apiError("Invitation not found or already used", 404);
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      return apiError("This invitation has expired", 400);
    }

    return apiSuccess({
      survey: invitation.survey,
      role: invitation.role,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    logger.error("Error fetching invitation", error);
    return apiError("Failed to fetch invitation", 500);
  }
}
