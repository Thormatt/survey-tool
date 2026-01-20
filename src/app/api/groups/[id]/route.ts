import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { groupUpdateSchema, formatZodErrors } from "@/lib/validations";

// GET - Get a single group with members
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

    const group = await db.emailGroup.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { email: "asc" },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!group) {
      return apiError("Group not found", 404);
    }

    if (group.userId !== userId) {
      return apiError("Unauthorized", 403);
    }

    return apiSuccess(group);
  } catch (error) {
    logger.error("Error fetching group", error);
    return apiError("Failed to fetch group", 500);
  }
}

// PATCH - Update group (name, color, or members)
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

    // Validate input
    const result = groupUpdateSchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { name, color, addMembers, removeMembers } = result.data;

    // Check ownership
    const group = await db.emailGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return apiError("Group not found", 404);
    }

    if (group.userId !== userId) {
      return apiError("Unauthorized", 403);
    }

    // Update group
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;

    // Handle member additions (individual creates to avoid transaction issues with Neon HTTP mode)
    if (addMembers && addMembers.length > 0) {
      for (const m of addMembers) {
        try {
          await db.emailGroupMember.create({
            data: {
              groupId: id,
              email: m.email.toLowerCase().trim(),
              name: m.name?.trim() || null,
            },
          });
        } catch (err) {
          // Skip duplicates silently (equivalent to skipDuplicates: true)
          if (err instanceof Error && err.message.includes("Unique constraint")) {
            continue;
          }
          throw err;
        }
      }
    }

    // Handle member removals
    if (removeMembers && removeMembers.length > 0) {
      await db.emailGroupMember.deleteMany({
        where: {
          groupId: id,
          email: { in: removeMembers.map((e) => e.toLowerCase()) },
        },
      });
    }

    const updatedGroup = await db.emailGroup.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          orderBy: { email: "asc" },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return apiSuccess(updatedGroup);
  } catch (error) {
    logger.error("Error updating group", error);
    return apiError("Failed to update group", 500);
  }
}

// DELETE - Delete a group
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

    // Check ownership
    const group = await db.emailGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return apiError("Group not found", 404);
    }

    if (group.userId !== userId) {
      return apiError("Unauthorized", 403);
    }

    await db.emailGroup.delete({
      where: { id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Error deleting group", error);
    return apiError("Failed to delete group", 500);
  }
}
