import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, published, questions, accessType, isAnonymous, closesAt } = body;

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

    // Create questions separately
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.question.create({
          data: {
            surveyId: survey.id,
            type: q.type,
            title: q.title,
            description: q.description,
            required: q.required ?? false,
            order: i,
            options: q.options ?? null,
            settings: q.settings ?? null,
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

    return NextResponse.json(completeSurvey, { status: 201 });
  } catch (error) {
    console.error("Error creating survey:", error);
    return NextResponse.json(
      { error: "Failed to create survey" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const surveys = await db.survey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { responses: true, questions: true },
        },
      },
    });

    return NextResponse.json(surveys);
  } catch (error) {
    console.error("Error fetching surveys:", error);
    return NextResponse.json(
      { error: "Failed to fetch surveys" },
      { status: 500 }
    );
  }
}
