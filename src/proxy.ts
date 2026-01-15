import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Admin emails that can access the dashboard
const ADMIN_EMAILS = [
  "thormatt@gmail.com",
  "jmctiernan@anduslabs.com",
];

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/unauthorized",  // Unauthorized access page
  "/s/(.*)",  // Public survey response pages
  "/results/(.*)",  // Public results pages
  "/api/responses(.*)",  // API for submitting responses
  "/api/surveys/(.*)/public(.*)",  // Public survey data endpoint
  "/api/surveys/(.*)/results/public(.*)",  // Public results data endpoint
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId, sessionClaims } = await auth.protect();

    // Check if user email is in admin list
    const userEmail = sessionClaims?.email as string | undefined;

    if (userEmail && !ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
      // Not an admin - redirect to unauthorized page or sign out
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
