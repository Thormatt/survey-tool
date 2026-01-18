import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendSurveyReminder } from "@/lib/email";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";

// This endpoint should be called by a cron job (e.g., Vercel Cron, external scheduler)
// Example: Call every hour to process pending reminders

export async function POST(request: NextRequest) {
  try {
    // CRON_SECRET is mandatory for security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error("CRON_SECRET environment variable is not configured");
      return apiError("Server configuration error", 500, "CONFIG_ERROR");
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
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

      // Collect invitations that need reminders
      const invitationsToRemind = survey.invitations.filter((invitation) => {
        // Check if already at max reminders
        if (invitation.reminderCount >= maxReminders) return false;

        // Check if enough time has passed since last reminder or initial send
        const lastContact = invitation.lastReminderAt || invitation.sentAt;
        const timeSinceLastContact = now.getTime() - lastContact.getTime();

        return timeSinceLastContact >= intervalMs;
      });

      // Track successful sends for batch update
      const successfulInvitationIds: string[] = [];

      // Send reminders
      for (const invitation of invitationsToRemind) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const surveyLink = `${baseUrl}/s/${survey.id}?token=${invitation.token}`;

          await sendSurveyReminder({
            to: invitation.email,
            surveyTitle: survey.title,
            surveyLink,
            daysRemaining,
          });

          successfulInvitationIds.push(invitation.id);
          remindersSent++;
        } catch (emailError) {
          logger.error(`Failed to send reminder to ${invitation.email}`, emailError);
          errors.push(`Failed to send reminder to ${invitation.email}: ${emailError}`);
        }
      }

      // Batch update all invitations that were sent successfully
      if (successfulInvitationIds.length > 0) {
        await db.invitation.updateMany({
          where: { id: { in: successfulInvitationIds } },
          data: {
            reminderCount: { increment: 1 },
            lastReminderAt: now,
          },
        });
      }
    }

    return apiSuccess({
      success: true,
      remindersSent,
      errors: errors.length > 0 ? errors : undefined,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error("Error processing reminders", error);
    return apiError("Failed to process reminders", 500);
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

    return apiSuccess({
      pendingInvitations: pendingReminders,
      surveysWithRemindersEnabled: surveysWithReminders,
    });
  } catch (error) {
    logger.error("Error checking reminder status", error);
    return apiError("Failed to check status", 500);
  }
}
