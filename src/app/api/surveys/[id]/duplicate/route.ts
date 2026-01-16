import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the original survey with questions
    const original = await db.survey.findFirst({
      where: {
        id,
        userId, // Only allow duplicating own surveys
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Create the duplicate survey (as draft)
    const duplicateSurvey = await db.survey.create({
      data: {
        title: `${original.title} (Copy)`,
        description: original.description,
        published: false, // Always create as draft
        userId,
        accessType: original.accessType,
        isAnonymous: original.isAnonymous,
        closesAt: null, // Don't copy closing date
      },
    });

    // Duplicate all questions
    for (const question of original.questions) {
      await db.question.create({
        data: {
          surveyId: duplicateSurvey.id,
          type: question.type,
          title: question.title,
          description: question.description,
          required: question.required,
          order: question.order,
          options: question.options,
          settings: question.settings,
        },
      });
    }

    // Fetch the complete duplicated survey
    const completeSurvey = await db.survey.findUnique({
      where: { id: duplicateSurvey.id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    return NextResponse.json(completeSurvey, { status: 201 });
  } catch (error) {
    console.error("Error duplicating survey:", error);
    return NextResponse.json(
      { error: "Failed to duplicate survey" },
      { status: 500 }
    );
  }
}
