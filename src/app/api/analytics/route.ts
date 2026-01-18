import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    // Get all surveys for the user
    const surveys = await db.survey.findMany({
      where: { userId },
      include: {
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate statistics
    const totalSurveys = surveys.length;
    const publishedSurveys = surveys.filter((s) => s.published).length;
    const totalResponses = surveys.reduce((sum, s) => sum + s._count.responses, 0);

    // Get responses from this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const responsesThisWeek = await db.response.count({
      where: {
        survey: {
          userId,
        },
        completedAt: {
          gte: oneWeekAgo,
        },
      },
    });

    // Format recent surveys
    const recentSurveys = surveys.slice(0, 5).map((survey) => ({
      id: survey.id,
      title: survey.title,
      responseCount: survey._count.responses,
      published: survey.published,
      createdAt: survey.createdAt.toISOString(),
    }));

    return apiSuccess({
      totalSurveys,
      publishedSurveys,
      totalResponses,
      responsesThisWeek,
      recentSurveys,
    });
  } catch (error) {
    logger.error("Error fetching analytics", error);
    return apiError("Failed to fetch analytics", 500);
  }
}
