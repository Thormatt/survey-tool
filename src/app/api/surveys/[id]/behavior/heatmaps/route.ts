import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/surveys/[id]/behavior/heatmaps
 * Get aggregated heatmap data for a survey (requires viewRecordings permission)
 */
export async function GET(request: Request, context: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: surveyId } = await context.params;

    await requirePermission(surveyId, userId, "viewRecordings");

    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // CLICK, SCROLL, MOVE, ATTENTION
    const questionId = url.searchParams.get("questionId");
    const viewport = url.searchParams.get("viewport"); // desktop, tablet, mobile

    // Build where clause
    const where: Record<string, unknown> = { surveyId };
    if (type) {
      where.type = type;
    }
    if (questionId) {
      where.questionId = questionId;
    }
    if (viewport) {
      where.viewportBreakpoint = viewport;
    }

    const heatmaps = await db.heatmapData.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        question: {
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
          },
        },
      },
    });

    // Get summary stats
    const stats = await db.sessionRecording.aggregate({
      where: {
        surveyId,
        status: "READY",
      },
      _count: true,
      _sum: { duration: true },
      _avg: { duration: true },
    });

    // Get device breakdown
    const deviceBreakdown = await db.sessionRecording.groupBy({
      by: ["deviceType"],
      where: {
        surveyId,
        status: "READY",
      },
      _count: true,
    });

    return NextResponse.json({
      heatmaps,
      stats: {
        totalRecordings: stats._count,
        totalDuration: stats._sum.duration ?? 0,
        averageDuration: Math.round(stats._avg.duration ?? 0),
        deviceBreakdown: Object.fromEntries(
          deviceBreakdown.map((d) => [d.deviceType ?? "unknown", d._count])
        ),
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error fetching heatmaps:", error);
    return NextResponse.json(
      { error: "Failed to fetch heatmaps" },
      { status: 500 }
    );
  }
}
