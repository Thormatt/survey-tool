import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendSurveyReminder } from "@/lib/email";

// This endpoint should be called by a cron job (e.g., Vercel Cron, external scheduler)
// Example: Call every hour to process pending reminders

export async function POST(request: NextRequest) {
  try {
    // Optional: Add a secret token for security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let remindersSent = 0;
    const errors: string[] = [];

    // Find all surveys with reminders enabled
    const surveys = await db.survey.findMany({
      where: {
        reminderEnabled: true,
        published: true,
        accessType: "INVITE_ONLY",
        // Don't process closed surveys
        OR: [
          { closesAt: null },
          { closesAt: { gt: now } },
        ],
      },
      include: {
        invitations: {
          where: {
            completedAt: null, // Only non-completed invitations
          },
        },
      },
    });

    for (const survey of surveys) {
      const intervalMs = (survey.reminderIntervalDays || 3) * 24 * 60 * 60 * 1000;
      const maxReminders = survey.reminderMaxCount || 2;

      // Calculate days remaining if survey has a deadline
      let daysRemaining: number | undefined;
      if (survey.closesAt) {
        daysRemaining = Math.ceil(
          (survey.closesAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (daysRemaining <= 0) continue; // Survey has closed
      }

      for (const invitation of survey.invitations) {
        // Check if already at max reminders
        if (invitation.reminderCount >= maxReminders) continue;

        // Check if enough time has passed since last reminder or initial send
        const lastContact = invitation.lastReminderAt || invitation.sentAt;
        const timeSinceLastContact = now.getTime() - lastContact.getTime();

        if (timeSinceLastContact < intervalMs) continue;

        // Send reminder
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const surveyLink = `${baseUrl}/s/${survey.id}?token=${invitation.token}`;

          await sendSurveyReminder({
            to: invitation.email,
            surveyTitle: survey.title,
            surveyLink,
            daysRemaining,
          });

          // Update invitation
          await db.invitation.update({
            where: { id: invitation.id },
            data: {
              reminderCount: invitation.reminderCount + 1,
              lastReminderAt: now,
            },
          });

          remindersSent++;
        } catch (emailError) {
          errors.push(`Failed to send reminder to ${invitation.email}: ${emailError}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      errors: errors.length > 0 ? errors : undefined,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error processing reminders:", error);
    return NextResponse.json(
      { error: "Failed to process reminders" },
      { status: 500 }
    );
  }
}

// GET endpoint for checking status (can be used for manual testing)
export async function GET() {
  try {
    const pendingReminders = await db.invitation.count({
      where: {
        completedAt: null,
        survey: {
          reminderEnabled: true,
          published: true,
        },
      },
    });

    const surveysWithReminders = await db.survey.count({
      where: {
        reminderEnabled: true,
        published: true,
      },
    });

    return NextResponse.json({
      pendingInvitations: pendingReminders,
      surveysWithRemindersEnabled: surveysWithReminders,
    });
  } catch (error) {
    console.error("Error checking reminder status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
