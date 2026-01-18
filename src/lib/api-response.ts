import { NextResponse } from "next/server";

/**
 * Standard API error response helper
 */
export function apiError(
  message: string,
  status: number,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...(code && { code }),
    },
    { status }
  );
}

/**
 * Standard API success response helper
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Validation error response helper
 */
export function validationError(errors: string[]): NextResponse {
  return NextResponse.json(
    {
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: errors,
    },
    { status: 400 }
  );
}
