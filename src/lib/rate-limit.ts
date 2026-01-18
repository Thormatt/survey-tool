import { kv } from "@vercel/kv";
import { NextRequest } from "next/server";
import { apiError } from "./api-response";

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional key prefix for grouping rate limits */
  prefix?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Get the client IP from the request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * Check rate limit for a given identifier
 * Uses Vercel KV sliding window rate limiting
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { limit, windowSeconds, prefix = "ratelimit" } = config;
  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    // Check if KV is configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      // KV not configured - allow all requests in development
      if (process.env.NODE_ENV === "development") {
        return { success: true, remaining: limit, reset: now + windowMs };
      }
      // In production without KV, still allow but log warning
      console.warn("Rate limiting disabled: Vercel KV not configured");
      return { success: true, remaining: limit, reset: now + windowMs };
    }

    // Use sliding window rate limiting with sorted set
    const windowStart = now - windowMs;

    // Pipeline: Remove old entries, add new entry, count entries
    const pipeline = kv.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart); // Remove old entries
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` }); // Add current request
    pipeline.zcard(key); // Count total entries
    pipeline.expire(key, windowSeconds); // Set TTL

    const results = await pipeline.exec();
    const count = (results[2] as number) || 0;

    const success = count <= limit;
    const remaining = Math.max(0, limit - count);
    const reset = now + windowMs;

    return { success, remaining, reset };
  } catch (error) {
    // If KV fails, allow the request but log the error
    console.error("Rate limit check failed:", error);
    return { success: true, remaining: limit, reset: now + windowMs };
  }
}

/**
 * Rate limit middleware for API routes
 * Returns null if allowed, or an error Response if rate limited
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
) {
  const ip = getClientIp(request);
  const result = await checkRateLimit(ip, config);

  if (!result.success) {
    return apiError(
      "Too many requests. Please try again later.",
      429,
      "RATE_LIMITED"
    );
  }

  return null;
}

/**
 * Rate limit by user ID (for authenticated routes)
 */
export async function rateLimitByUser(
  userId: string,
  config: RateLimitConfig
) {
  const result = await checkRateLimit(`user:${userId}`, config);

  if (!result.success) {
    return apiError(
      "Too many requests. Please try again later.",
      429,
      "RATE_LIMITED"
    );
  }

  return null;
}
