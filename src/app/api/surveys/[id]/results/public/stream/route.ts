import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// Public Server-Sent Events endpoint for real-time survey results
// No authentication required - for public results viewing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify survey exists and is published
  const survey = await db.survey.findFirst({
    where: { id, published: true },
    select: { id: true },
  });

  if (!survey) {
    return new Response("Survey not found", { status: 404 });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastResponseCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      // Get initial response count
      const initialCount = await db.response.count({
        where: { surveyId: id },
      });
      lastResponseCount = initialCount;

      // Poll for new responses every 3 seconds (faster for live demos)
      intervalId = setInterval(async () => {
        try {
          const currentCount = await db.response.count({
            where: { surveyId: id },
          });

          if (currentCount !== lastResponseCount) {
            // Fetch updated survey data
            const updatedSurvey = await db.survey.findUnique({
              where: { id, published: true },
              include: {
                questions: {
                  orderBy: { order: "asc" },
                  include: {
                    answers: {
                      include: {
                        response: {
                          select: {
                            completedAt: true,
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

            if (updatedSurvey) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "update",
                    survey: updatedSurvey,
                    newResponses: currentCount - lastResponseCount,
                  })}\n\n`
                )
              );
              lastResponseCount = currentCount;
            }
          }

          // Send heartbeat to keep connection alive
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`)
          );
        } catch (error) {
          console.error("SSE poll error:", error);
        }
      }, 3000);
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
