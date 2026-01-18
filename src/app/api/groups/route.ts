import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, validationError } from "@/lib/api-response";
import { groupSchema, formatZodErrors } from "@/lib/validations";
import { getPaginationParams, paginatedResponse, prismaPagination } from "@/lib/pagination";

// GET - List all groups for the user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const pagination = getPaginationParams(request);

    // Get total count for pagination
    const total = await db.emailGroup.count({
      where: { userId },
    });

    const groups = await db.emailGroup.findMany({
      where: { userId },
      ...prismaPagination(pagination),
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess(paginatedResponse(groups, total, pagination));
  } catch (error) {
    logger.error("Error fetching groups", error);
    return apiError("Failed to fetch groups", 500);
  }
}

// POST - Create a new group
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();

    // Validate input
    const result = groupSchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { name, color, members } = result.data;

    // Create group with optional members
    const group = await db.emailGroup.create({
      data: {
        name,
        userId,
        color: color || null,
        members: members.length > 0 ? {
          create: members.map((m) => ({
            email: m.email.toLowerCase().trim(),
            name: m.name?.trim() || null,
          })),
        } : undefined,
      },
      include: {
        _count: {
          select: { members: true },
        },
        members: true,
      },
    });

    return apiSuccess(group, 201);
  } catch (error: unknown) {
    logger.error("Error creating group", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return apiError("A group with this name already exists", 409);
    }
    return apiError("Failed to create group", 500);
  }
}
