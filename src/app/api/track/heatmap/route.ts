import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { HeatmapType, Prisma } from "@/generated/prisma/client";

interface HeatmapPoint {
  x: number;
  y: number;
  count: number;
  selector?: string;
}

interface ScrollData {
  depth: number;
  count: number;
}

interface HeatmapRequest {
  siteId: string;
  pagePath: string;
  viewportBreakpoint: string;
  clicks: HeatmapPoint[];
  moves: HeatmapPoint[];
  scrolls: ScrollData[];
}

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body: HeatmapRequest = await request.json();

    // Validate required fields
    if (!body.siteId || !body.pagePath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if site exists and has heatmaps enabled
    const site = await db.site.findFirst({
      where: {
        id: body.siteId,
        enabled: true,
        heatmapsEnabled: true,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found or heatmaps disabled" },
        { status: 404, headers: corsHeaders }
      );
    }

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setMinutes(0, 0, 0); // Round to current hour

    // Aggregate click data
    if (body.clicks.length > 0) {
      await upsertHeatmapData(
        body.siteId,
        body.pagePath,
        "CLICK" as HeatmapType,
        body.viewportBreakpoint,
        { points: body.clicks },
        periodStart,
        now
      );
    }

    // Aggregate move data
    if (body.moves.length > 0) {
      await upsertHeatmapData(
        body.siteId,
        body.pagePath,
        "MOVE" as HeatmapType,
        body.viewportBreakpoint,
        { points: body.moves },
        periodStart,
        now
      );
    }

    // Aggregate scroll data
    if (body.scrolls.length > 0) {
      const scrollPoints = body.scrolls.map((s) => ({
        x: 50, // Center of page
        y: s.depth,
        count: s.count,
      }));

      await upsertHeatmapData(
        body.siteId,
        body.pagePath,
        "SCROLL" as HeatmapType,
        body.viewportBreakpoint,
        { points: scrollPoints },
        periodStart,
        now
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    logger.error("Error processing heatmap data", error);
    return NextResponse.json(
      { error: "Failed to process heatmap data" },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function upsertHeatmapData(
  siteId: string,
  pagePath: string,
  type: HeatmapType,
  viewportBreakpoint: string,
  newData: { points: HeatmapPoint[] },
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  // Find existing record for this period
  const existing = await db.siteHeatmapData.findFirst({
    where: {
      siteId,
      pagePath,
      type,
      viewportBreakpoint,
      periodStart: { gte: periodStart },
    },
  });

  if (existing) {
    // Merge data points
    const existingData = existing.data as unknown as { points: HeatmapPoint[] };
    const existingPoints = existingData?.points || [];
    const pointMap = new Map<string, HeatmapPoint>();

    // Add existing points to map
    for (const point of existingPoints) {
      const key = `${point.x},${point.y}`;
      pointMap.set(key, point);
    }

    // Merge new points
    for (const point of newData.points) {
      const key = `${point.x},${point.y}`;
      const existing = pointMap.get(key);
      if (existing) {
        existing.count += point.count;
      } else {
        pointMap.set(key, point);
      }
    }

    // Update record - serialize to plain JSON to satisfy Prisma's type requirements
    const updatedData = JSON.parse(JSON.stringify({ points: Array.from(pointMap.values()) }));
    await db.siteHeatmapData.update({
      where: { id: existing.id },
      data: {
        data: updatedData,
        sessionCount: existing.sessionCount + 1,
        periodEnd,
      },
    });
  } else {
    // Create new record - serialize to plain JSON
    await db.siteHeatmapData.create({
      data: {
        siteId,
        pagePath,
        type,
        viewportBreakpoint,
        data: JSON.parse(JSON.stringify(newData)),
        sessionCount: 1,
        periodStart,
        periodEnd,
      },
    });
  }
}
