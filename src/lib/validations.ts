import { z } from "zod";

/**
 * Common validation schemas for API endpoints
 */

// Email validation
export const emailSchema = z.string().email("Invalid email format").toLowerCase().trim();

// Survey creation/update schema
export const surveySchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional()
    .nullable(),
  published: z.boolean().optional().default(false),
  accessType: z.enum(["UNLISTED", "INVITE_ONLY"]).optional().default("UNLISTED"),
  isAnonymous: z.boolean().optional().default(true),
  closesAt: z.string().datetime().optional().nullable(),
  questions: z
    .array(
      z.object({
        type: z.string().min(1, "Question type is required"),
        title: z
          .string()
          .min(1, "Question title is required")
          .max(500, "Question title must be less than 500 characters"),
        description: z.string().max(1000).optional().nullable(),
        required: z.boolean().optional().default(false),
        options: z.array(z.string()).optional().nullable(),
        settings: z.record(z.string(), z.unknown()).optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

// Response submission schema
export const responseSchema = z.object({
  surveyId: z.string().min(1, "Survey ID is required"),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1, "Question ID is required"),
        value: z.unknown(), // Flexible: string, number, array, etc.
      })
    )
    .optional()
    .default([]),
  respondentEmail: emailSchema.optional().nullable(),
  respondentName: z.string().max(200).optional().nullable(),
});

// Invitation schema
export const invitationSchema = z.object({
  emails: z
    .array(emailSchema)
    .min(1, "At least one email is required")
    .max(500, "Maximum 500 emails per request"),
  subject: z.string().max(200).optional(),
  senderName: z.string().max(100).optional(),
  customMessage: z.string().max(2000).optional(),
  emailTitle: z.string().max(200).optional(),
  ctaButtonText: z.string().max(50).optional(),
  timeEstimate: z.string().max(50).optional(),
});

// Group creation schema
export const groupSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name must be less than 100 characters")
    .trim(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .optional()
    .nullable(),
  members: z
    .array(
      z.object({
        email: emailSchema,
        name: z.string().max(200).optional(),
      })
    )
    .optional()
    .default([]),
});

// Group update schema
export const groupUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  addMembers: z
    .array(
      z.object({
        email: emailSchema,
        name: z.string().max(200).optional(),
      })
    )
    .optional(),
  removeMembers: z.array(emailSchema).optional(),
});

/**
 * Helper to format Zod errors as strings
 */
export function formatZodErrors(error: z.ZodError<unknown>): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
