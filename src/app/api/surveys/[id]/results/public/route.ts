import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Publicly accessible results don't require auth
    // Just return the data

    return NextResponse.json({
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
    console.error("Error fetching public results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
