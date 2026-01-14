import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { surveyId, answers, respondentEmail, respondentName } = body;

    // Validate survey exists and is published
    const survey = await db.survey.findUnique({
      where: { id: surveyId },
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

    // For INVITE_ONLY surveys, verify email and check if already completed
    if (survey.accessType === "INVITE_ONLY") {
      if (!respondentEmail) {
        return NextResponse.json({ error: "Email required for invite-only survey" }, { status: 400 });
      }

      const invitation = await db.invitation.findUnique({
        where: {
          surveyId_email: {
            surveyId,
            email: respondentEmail.toLowerCase(),
          },
        },
      });

      if (!invitation) {
        return NextResponse.json({ error: "Not invited to this survey" }, { status: 403 });
      }

      if (invitation.completedAt) {
        return NextResponse.json({ error: "You have already completed this survey" }, { status: 403 });
      }
    }

    // Create response
    const response = await db.response.create({
      data: {
        surveyId,
        respondentEmail: survey.isAnonymous ? null : respondentEmail,
        respondentName: survey.isAnonymous ? null : respondentName,
        metadata: {
          userAgent: request.headers.get("user-agent"),
          submittedAt: new Date().toISOString(),
        },
      },
    });

    // Create answers
    if (answers && answers.length > 0) {
      for (const answer of answers) {
        await db.answer.create({
          data: {
            responseId: response.id,
            questionId: answer.questionId,
            value: answer.value,
          },
        });
      }
    }

    // Mark invitation as completed for INVITE_ONLY surveys
    if (survey.accessType === "INVITE_ONLY" && respondentEmail) {
      await db.invitation.update({
        where: {
          surveyId_email: {
            surveyId,
            email: respondentEmail.toLowerCase(),
          },
        },
        data: {
          completedAt: new Date(),
          responseId: response.id,
        },
      });
    }

    return NextResponse.json({ success: true, responseId: response.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating response:", error);
    return NextResponse.json(
      { error: "Failed to submit response" },
      { status: 500 }
    );
  }
}
