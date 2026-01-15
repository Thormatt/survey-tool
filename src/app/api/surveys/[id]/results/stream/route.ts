import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Server-Sent Events endpoint for real-time survey results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify ownership
  const survey = await db.survey.findFirst({
    where: { id, userId },
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

      // Poll for new responses every 5 seconds
      intervalId = setInterval(async () => {
        try {
          const currentCount = await db.response.count({
            where: { surveyId: id },
          });

          if (currentCount !== lastResponseCount) {
            // Fetch updated survey data
            const updatedSurvey = await db.survey.findUnique({
              where: { id },
              include: {
                questions: {
                  orderBy: { order: "asc" },
                  include: {
                    answers: {
                      include: {
                        response: {
                          select: {
                            completedAt: true,
                            respondentEmail: true,
                            respondentName: true,
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
      }, 5000);
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
      "X-Accel-Buffering": "no", // Disable buffering for Nginx
    },
  });
}
