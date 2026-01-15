import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { sendSurveyInvite } from "@/lib/email";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check survey ownership
    const survey = await db.survey.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const invitations = await db.invitation.findMany({
      where: { surveyId: id },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const { emails, subject, senderName, customMessage, emailTitle, ctaButtonText, timeEstimate } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "Please provide at least one email address" },
        { status: 400 }
      );
    }

    // Check survey ownership
    const survey = await db.survey.findUnique({
      where: { id },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!survey.published) {
      return NextResponse.json(
        { error: "Survey must be published before sending invitations" },
        { status: 400 }
      );
    }

    const results: { email: string; success: boolean; error?: string }[] = [];
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

    for (const email of emails) {
      try {
        // Check if already invited
        const existing = await db.invitation.findUnique({
          where: { surveyId_email: { surveyId: id, email } },
        });

        if (existing) {
          results.push({ email, success: false, error: "Already invited" });
          continue;
        }

        // Create invitation
        const invitation = await db.invitation.create({
          data: {
            surveyId: id,
            email,
          },
        });

        // Send email
        const surveyLink = `${baseUrl}/s/${id}?token=${invitation.token}`;
        await sendSurveyInvite({
          to: email,
          surveyTitle: emailTitle || survey.title,
          surveyDescription: survey.description || undefined,
          surveyLink,
          senderName: senderName || undefined,
          customMessage: customMessage || undefined,
          customSubject: subject || undefined,
          ctaButtonText: ctaButtonText || undefined,
          timeEstimate: timeEstimate || undefined,
        });

        results.push({ email, success: true });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Failed to invite ${email}:`, errorMessage, err);
        results.push({ email, success: false, error: errorMessage });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error sending invitations:", error);
    return NextResponse.json(
      { error: "Failed to send invitations" },
      { status: 500 }
    );
  }
}
