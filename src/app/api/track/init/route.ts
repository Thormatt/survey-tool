import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateUUID } from "@/lib/utils";

interface InitRequest {
  siteId: string;
  visitorId: string;
  sessionToken: string | null;
  pageUrl: string;
  pagePath: string;
  pageTitle: string;
  referrer: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  timezone: string;
  language: string;
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
    const body: InitRequest = await request.json();

    // Validate required fields
    if (!body.siteId || !body.visitorId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if site exists and is enabled
    const site = await db.site.findFirst({
      where: {
        id: body.siteId,
        enabled: true,
      },
      include: {
        pageTargets: true,
        surveyTriggers: {
          where: { enabled: true },
        },
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found or disabled" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Parse user agent for device info
    const deviceInfo = parseUserAgent(body.userAgent);

    // Get country from request headers (if behind CDN/proxy)
    const country = request.headers.get("cf-ipcountry") ||
      request.headers.get("x-vercel-ip-country") ||
      null;

    // Check if session already exists and is still valid
    let sessionToken = body.sessionToken;
    let recording = sessionToken
      ? await db.siteRecording.findFirst({
          where: {
            sessionToken,
            siteId: body.siteId,
            // Session is valid if started within the last 30 minutes
            startedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
          },
        })
      : null;

    if (!recording) {
      // Create new recording session
      sessionToken = generateUUID();
      recording = await db.siteRecording.create({
        data: {
          siteId: body.siteId,
          visitorId: body.visitorId,
          sessionToken,
          pageUrl: body.pageUrl,
          pagePath: body.pagePath,
          pageTitle: body.pageTitle,
          referrer: body.referrer || null,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          screenWidth: body.screenWidth,
          screenHeight: body.screenHeight,
          viewportWidth: body.viewportWidth,
          viewportHeight: body.viewportHeight,
          country,
          startedAt: new Date(),
          status: "RECORDING",
        },
      });
    } else {
      // Update existing recording with new page info
      await db.siteRecording.update({
        where: { id: recording.id },
        data: {
          pageUrl: body.pageUrl,
          pagePath: body.pagePath,
          pageTitle: body.pageTitle,
        },
      });
    }

    // Build response with config and triggers
    const response = {
      sessionToken,
      config: {
        recordingEnabled: site.recordingEnabled && site.samplingRate > 0,
        heatmapsEnabled: site.heatmapsEnabled,
        surveysEnabled: site.surveyTriggers.length > 0,
        samplingRate: site.samplingRate,
      },
      triggers: site.surveyTriggers.map((t) => ({
        id: t.id,
        surveyId: t.surveyId,
        triggerType: t.triggerType,
        triggerValue: t.triggerValue,
        triggerSelector: t.triggerSelector,
        displayMode: t.displayMode,
        displayPosition: t.displayPosition,
        displayDelay: t.displayDelay,
        showOnce: t.showOnce,
        cooldownDays: t.cooldownDays,
        percentageShow: t.percentageShow,
        pageTargetId: t.pageTargetId,
      })),
      pageTargets: site.pageTargets.map((t) => ({
        id: t.id,
        urlPattern: t.urlPattern,
        matchType: t.matchType,
      })),
    };

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    logger.error("Error initializing tracking session", error);
    return NextResponse.json(
      { error: "Failed to initialize session" },
      { status: 500, headers: corsHeaders }
    );
  }
}

function parseUserAgent(ua: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  let deviceType = "desktop";
  let browser = "Unknown";
  let os = "Unknown";

  const uaLower = ua.toLowerCase();

  // Detect device type
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(uaLower)) {
    deviceType = "mobile";
  } else if (/ipad|tablet|playbook|silk/i.test(uaLower)) {
    deviceType = "tablet";
  }

  // Detect browser
  if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("SamsungBrowser")) {
    browser = "Samsung Internet";
  } else if (ua.includes("Opera") || ua.includes("OPR")) {
    browser = "Opera";
  } else if (ua.includes("Edge") || ua.includes("Edg")) {
    browser = "Edge";
  } else if (ua.includes("Chrome")) {
    browser = "Chrome";
  } else if (ua.includes("Safari")) {
    browser = "Safari";
  } else if (ua.includes("MSIE") || ua.includes("Trident")) {
    browser = "Internet Explorer";
  }

  // Detect OS
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac")) {
    os = "macOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
  }

  return { deviceType, browser, os };
}
