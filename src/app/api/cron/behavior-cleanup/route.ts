import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { del } from "@vercel/blob";

/**
 * Behavior Cleanup Cron Job
 *
 * Runs daily to:
 * 1. Delete recordings past their retention period
 * 2. Remove associated Blob files
 * 3. Mark expired recordings
 * 4. Clean up orphaned data
 *
 * Triggered via Vercel Cron at 4 AM UTC daily
 */

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow Vercel's internal cron authentication
    const vercelCronSecret = request.headers.get("x-vercel-cron-signature");
    if (!vercelCronSecret) {
      return false;
    }
  }
  return true;
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    expiredRecordings: 0,
    deletedBlobFiles: 0,
    failedDeletions: 0,
    cleanedSurveys: 0,
    errors: [] as string[],
  };

  try {
    // Get all surveys with behavior settings
    const surveysWithSettings = await db.behaviorSettings.findMany({
      select: {
        surveyId: true,
        retentionDays: true,
      },
    });

    // Process each survey
    for (const settings of surveysWithSettings) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - settings.retentionDays);

        // Find expired recordings for this survey
        const expiredRecordings = await db.sessionRecording.findMany({
          where: {
            surveyId: settings.surveyId,
            createdAt: {
              lt: cutoffDate,
            },
            status: {
              not: "EXPIRED",
            },
          },
          select: {
            id: true,
            eventsUrl: true,
            sessionToken: true,
          },
        });

        // Delete Blob files for expired recordings
        for (const recording of expiredRecordings) {
          if (recording.eventsUrl) {
            try {
              await del(recording.eventsUrl);
              results.deletedBlobFiles++;
            } catch (blobError) {
              results.failedDeletions++;
              results.errors.push(
                `Failed to delete blob for recording ${recording.id}: ${blobError}`
              );
            }
          }
        }

        // Mark recordings as expired (or delete them)
        if (expiredRecordings.length > 0) {
          const recordingIds = expiredRecordings.map((r: { id: string }) => r.id);

          // Update recordings to EXPIRED status and clear events URL
          await db.sessionRecording.updateMany({
            where: {
              id: {
                in: recordingIds,
              },
            },
            data: {
              status: "EXPIRED",
              eventsUrl: null,
            },
          });

          results.expiredRecordings += expiredRecordings.length;
        }

        results.cleanedSurveys++;
      } catch (surveyError) {
        results.errors.push(
          `Error processing survey ${settings.surveyId}: ${surveyError}`
        );
      }
    }

    // Clean up orphaned heatmap data for expired recordings
    // (Heatmaps older than 90 days with no associated recordings)
    const heatmapCutoff = new Date();
    heatmapCutoff.setDate(heatmapCutoff.getDate() - 90);

    await db.heatmapData.deleteMany({
      where: {
        periodEnd: {
          lt: heatmapCutoff,
        },
      },
    });

    // Clean up completed recordings that are very old (safety net)
    // Delete recordings marked as EXPIRED for more than 30 days
    const finalCleanupCutoff = new Date();
    finalCleanupCutoff.setDate(finalCleanupCutoff.getDate() - 30);

    const deletedOldExpired = await db.sessionRecording.deleteMany({
      where: {
        status: "EXPIRED",
        createdAt: {
          lt: finalCleanupCutoff,
        },
      },
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      results: {
        ...results,
        permanentlyDeleted: deletedOldExpired.count,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Behavior cleanup cron failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        partialResults: results,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: Request) {
  return GET(request);
}
