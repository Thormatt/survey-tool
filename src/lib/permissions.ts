/**
 * Survey Permission System
 *
 * Provides role-based access control for survey collaboration.
 * Supports OWNER, EDITOR, and VIEWER roles with different permission levels.
 */

import { db } from "@/lib/db";
import { CollaboratorRole } from "@/generated/prisma/client";

export type Permission =
  | "view"
  | "edit"
  | "delete"
  | "manageTeam"
  | "viewResponses"
  | "publish"
  | "viewRecordings"
  | "manageBehaviorSettings";

export interface SurveyAccess {
  hasAccess: boolean;
  role: CollaboratorRole | null;
  isOwner: boolean;
  permissions: Record<Permission, boolean>;
}

/**
 * Permission matrix for each role.
 * OWNER: Full access including delete and team management
 * EDITOR: Can edit survey and view responses
 * VIEWER: Read-only access to survey and responses
 */
const ROLE_PERMISSIONS: Record<CollaboratorRole, Record<Permission, boolean>> = {
  OWNER: {
    view: true,
    edit: true,
    delete: true,
    manageTeam: true,
    viewResponses: true,
    publish: true,
    viewRecordings: true,
    manageBehaviorSettings: true,
  },
  EDITOR: {
    view: true,
    edit: true,
    delete: false,
    manageTeam: false,
    viewResponses: true,
    publish: true,
    viewRecordings: true,
    manageBehaviorSettings: true,
  },
  VIEWER: {
    view: true,
    edit: false,
    delete: false,
    manageTeam: false,
    viewResponses: true,
    publish: false,
    viewRecordings: true,
    manageBehaviorSettings: false,
  },
};

/**
 * Gets user's access level and permissions for a survey.
 *
 * Checks both ownership (via survey.userId) and collaboration (via SurveyCollaborator).
 *
 * @param surveyId - The survey ID to check access for
 * @param userId - The Clerk user ID
 * @returns SurveyAccess object with role and permissions
 */
export async function getSurveyAccess(
  surveyId: string,
  userId: string
): Promise<SurveyAccess> {
  // First check if user is the survey owner
  const survey = await db.survey.findUnique({
    where: { id: surveyId },
    select: { userId: true },
  });

  if (!survey) {
    return {
      hasAccess: false,
      role: null,
      isOwner: false,
      permissions: {
        view: false,
        edit: false,
        delete: false,
        manageTeam: false,
        viewResponses: false,
        publish: false,
        viewRecordings: false,
        manageBehaviorSettings: false,
      },
    };
  }

  // If user is the survey owner, they have OWNER role
  if (survey.userId === userId) {
    return {
      hasAccess: true,
      role: "OWNER",
      isOwner: true,
      permissions: ROLE_PERMISSIONS.OWNER,
    };
  }

  // Check if user is a collaborator
  const collaborator = await db.surveyCollaborator.findUnique({
    where: {
      surveyId_userId: {
        surveyId,
        userId,
      },
    },
  });

  if (collaborator) {
    return {
      hasAccess: true,
      role: collaborator.role,
      isOwner: false,
      permissions: ROLE_PERMISSIONS[collaborator.role],
    };
  }

  // No access
  return {
    hasAccess: false,
    role: null,
    isOwner: false,
    permissions: {
      view: false,
      edit: false,
      delete: false,
      manageTeam: false,
      viewResponses: false,
      publish: false,
      viewRecordings: false,
      manageBehaviorSettings: false,
    },
  };
}

/**
 * Checks if user has a specific permission for a survey.
 *
 * @param surveyId - The survey ID
 * @param userId - The Clerk user ID
 * @param permission - The permission to check
 * @returns true if user has the permission
 */
export async function hasPermission(
  surveyId: string,
  userId: string,
  permission: Permission
): Promise<boolean> {
  const access = await getSurveyAccess(surveyId, userId);
  return access.permissions[permission];
}

/**
 * Throws an error if user doesn't have the required permission.
 *
 * @param surveyId - The survey ID
 * @param userId - The Clerk user ID
 * @param permission - The required permission
 * @throws Error if permission is denied
 */
export async function requirePermission(
  surveyId: string,
  userId: string,
  permission: Permission
): Promise<SurveyAccess> {
  const access = await getSurveyAccess(surveyId, userId);

  if (!access.hasAccess) {
    throw new PermissionError("Survey not found or access denied", 404);
  }

  if (!access.permissions[permission]) {
    throw new PermissionError(
      `You don't have permission to ${permission} this survey`,
      403
    );
  }

  return access;
}

/**
 * Custom error class for permission errors.
 */
export class PermissionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = "PermissionError";
    this.statusCode = statusCode;
  }
}

/**
 * Gets all surveys a user has access to (owned or collaborated).
 *
 * @param userId - The Clerk user ID
 * @returns Array of survey IDs with roles
 */
export async function getUserSurveys(userId: string): Promise<
  Array<{
    surveyId: string;
    role: CollaboratorRole;
    isOwner: boolean;
  }>
> {
  // Get owned surveys
  const ownedSurveys = await db.survey.findMany({
    where: { userId },
    select: { id: true },
  });

  // Get collaborated surveys
  const collaborations = await db.surveyCollaborator.findMany({
    where: { userId },
    select: { surveyId: true, role: true },
  });

  // Combine results
  const result: Array<{
    surveyId: string;
    role: CollaboratorRole;
    isOwner: boolean;
  }> = [];

  // Add owned surveys
  for (const survey of ownedSurveys) {
    result.push({
      surveyId: survey.id,
      role: "OWNER",
      isOwner: true,
    });
  }

  // Add collaborated surveys (exclude duplicates with owned)
  const ownedIds = new Set(ownedSurveys.map((s) => s.id));
  for (const collab of collaborations) {
    if (!ownedIds.has(collab.surveyId)) {
      result.push({
        surveyId: collab.surveyId,
        role: collab.role,
        isOwner: false,
      });
    }
  }

  return result;
}

/**
 * Transfer survey ownership to another user.
 * Only the current owner can do this.
 *
 * @param surveyId - The survey ID
 * @param currentOwnerId - Current owner's Clerk user ID
 * @param newOwnerId - New owner's Clerk user ID
 * @param newOwnerEmail - New owner's email
 */
export async function transferOwnership(
  surveyId: string,
  currentOwnerId: string,
  newOwnerId: string,
  newOwnerEmail: string
): Promise<void> {
  const access = await getSurveyAccess(surveyId, currentOwnerId);

  if (!access.isOwner) {
    throw new PermissionError("Only the owner can transfer ownership", 403);
  }

  // Use transaction to ensure atomicity
  await db.$transaction(async (tx) => {
    // Update survey owner
    await tx.survey.update({
      where: { id: surveyId },
      data: { userId: newOwnerId },
    });

    // Remove new owner from collaborators if they were one
    await tx.surveyCollaborator.deleteMany({
      where: {
        surveyId,
        userId: newOwnerId,
      },
    });

    // Add old owner as EDITOR collaborator
    await tx.surveyCollaborator.create({
      data: {
        surveyId,
        userId: currentOwnerId,
        email: "", // Will be filled by the caller
        role: "EDITOR",
        invitedBy: newOwnerId,
        acceptedAt: new Date(),
      },
    });
  });
}
