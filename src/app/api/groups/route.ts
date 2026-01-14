import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// GET - List all groups for the user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await db.emailGroup.findMany({
      where: { userId },
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

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}

// POST - Create a new group
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, members } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    // Create group with optional members
    const group = await db.emailGroup.create({
      data: {
        name: name.trim(),
        userId,
        color: color || null,
        members: members?.length > 0 ? {
          create: members.map((m: { email: string; name?: string }) => ({
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

    return NextResponse.json(group, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating group:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A group with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 }
    );
  }
}
