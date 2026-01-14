import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email"); // User's email from Clerk

    const survey = await db.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (!survey.published) {
      return NextResponse.json({ error: "Survey is not available" }, { status: 403 });
    }

    // Check if survey is closed
    if (survey.closesAt && new Date(survey.closesAt) < new Date()) {
      return NextResponse.json({ error: "Survey has closed" }, { status: 403 });
    }

    // For INVITE_ONLY surveys, verify the user's email is invited
    if (survey.accessType === "INVITE_ONLY") {
      // No email provided = user not signed in
      if (!email) {
        return NextResponse.json(
          {
            error: "Please sign in to access this survey",
            accessType: "INVITE_ONLY",
            requiresAuth: true,
          },
          { status: 403 }
        );
      }

      // Check if this email has been invited
      const invitation = await db.invitation.findUnique({
        where: {
          surveyId_email: {
            surveyId: id,
            email: email.toLowerCase(),
          },
        },
      });

      if (!invitation) {
        return NextResponse.json(
          {
            error: "Your email is not on the invite list for this survey",
            accessType: "INVITE_ONLY",
            notInvited: true,
          },
          { status: 403 }
        );
      }

      // Check if already completed
      if (invitation.completedAt) {
        return NextResponse.json(
          { error: "You have already completed this survey" },
          { status: 403 }
        );
      }

      // Mark invitation as opened
      if (!invitation.openedAt) {
        await db.invitation.update({
          where: { id: invitation.id },
          data: { openedAt: new Date() },
        });
      }
    }

    // Return survey data (PUBLIC and UNLISTED don't need special checks)
    return NextResponse.json({
      id: survey.id,
      title: survey.title,
      description: survey.description,
      published: survey.published,
      accessType: survey.accessType,
      isAnonymous: survey.isAnonymous,
      closesAt: survey.closesAt,
      questions: survey.questions.map((q) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        options: q.options,
        settings: q.settings,
      })),
    });
  } catch (error) {
    console.error("Error fetching public survey:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey" },
      { status: 500 }
    );
  }
}
