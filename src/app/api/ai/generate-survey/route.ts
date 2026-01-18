import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { logger } from "@/lib/logger";

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENROUTER_API_KEY) {
    return null;
  }
  if (!openai) {
    openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return openai;
}

// Valid question types from our schema
const VALID_QUESTION_TYPES = [
  "SECTION_HEADER",
  "SHORT_TEXT",
  "LONG_TEXT",
  "EMAIL",
  "PHONE",
  "NUMBER",
  "URL",
  "DATE",
  "TIME",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "DROPDOWN",
  "YES_NO",
  "IMAGE_CHOICE",
  "RATING",
  "SCALE",
  "NPS",
  "LIKERT",
  "SLIDER",
  "MATRIX",
  "RANKING",
  "CONSTANT_SUM",
  "FILE_UPLOAD",
  "SIGNATURE",
  "ADDRESS",
  "HIDDEN",
] as const;

const SYSTEM_PROMPT = `You are a survey design expert. Your task is to create well-structured surveys based on user prompts.

IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just raw JSON.

Available question types and when to use them:
- SECTION_HEADER: Use to organize surveys into logical sections. No input, just displays a title and optional description.
- SHORT_TEXT: Single line text input. Good for names, brief answers.
- LONG_TEXT: Multi-line text area. Good for detailed feedback, explanations.
- EMAIL: Email input with validation.
- PHONE: Phone number input.
- NUMBER: Numeric input. Use settings: { min, max } to set range.
- DATE: Date picker.
- TIME: Time picker.
- SINGLE_CHOICE: Radio buttons, pick one. Use options array. Good for demographic questions, categories.
- MULTIPLE_CHOICE: Checkboxes, pick multiple. Use options array. Good for "select all that apply".
- DROPDOWN: Single select dropdown. Use options array. Better than SINGLE_CHOICE when you have many options (5+).
- YES_NO: Simple yes/no toggle. Use for binary questions.
- RATING: Star rating 1-5. Good for satisfaction, quality ratings.
- SCALE: Linear scale. Use settings: { min, max, minLabel, maxLabel }. Good for agreement scales.
- NPS: Net Promoter Score 0-10. Use for "How likely to recommend?" questions.
- LIKERT: Opinion scale with 5 levels. Good for agreement (Strongly Disagree to Strongly Agree).
- SLIDER: Visual slider. Use settings: { min, max }. Good for percentages, continuous values.
- MATRIX: Rate multiple items on same scale. Use options for items, settings: { scale: ["Low", "Medium", "High"] }.
- RANKING: Drag to order items. Use options array. Good for preferences.
- CONSTANT_SUM: Distribute points. Use options array, settings: { total: 100 }. Good for budget allocation, importance weighting.
- URL: Website/URL input with validation. Good for collecting links, portfolios, social profiles.
- FILE_UPLOAD: File upload field. Use settings: { allowedTypes: ["image/*", "application/pdf"], maxSizeMB: 10 }. Good for resumes, documents, screenshots.
- SIGNATURE: Digital signature capture. Good for agreements, consent forms, contracts.
- ADDRESS: Location/address input with fields for street, city, ZIP. Use settings: { includeCountry: true }.
- HIDDEN: Hidden field not shown to respondents. Use settings: { defaultValue: "" }. Good for tracking sources, campaign IDs.

Guidelines:
1. Start with a SECTION_HEADER if the survey covers multiple topics
2. Mix question types appropriately - don't use all the same type
3. Use RATING or NPS for satisfaction/recommendation questions
4. Use SINGLE_CHOICE for categorical questions with 2-5 options
5. Use MULTIPLE_CHOICE when users can select multiple answers
6. Keep surveys focused - typically 5-15 questions
7. Make questions clear and concise
8. Use required: true for essential questions, false for optional ones
9. Include helpful descriptions where needed

Response format (JSON only):
{
  "title": "Survey title",
  "description": "Brief survey description",
  "questions": [
    {
      "type": "QUESTION_TYPE",
      "title": "Question text",
      "description": "Optional helper text",
      "required": true,
      "options": ["Option 1", "Option 2"], // Only for choice/ranking questions
      "settings": {} // Type-specific settings
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if OpenRouter is configured
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "AI generation is not configured. Please add OPENROUTER_API_KEY to your environment." },
        { status: 503 }
      );
    }

    const { prompt, model = "openai/gpt-4o-mini" } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Please provide a prompt describing your survey" },
        { status: 400 }
      );
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "Prompt is too long. Please keep it under 2000 characters." },
        { status: 400 }
      );
    }

    // Call OpenRouter
    const client = getOpenAIClient();
    if (!client) {
      return NextResponse.json(
        { error: "AI generation is not configured. Please add OPENROUTER_API_KEY to your environment." },
        { status: 503 }
      );
    }
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a survey for: ${prompt}` },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Failed to generate survey. Please try again." },
        { status: 500 }
      );
    }

    // Parse and validate the response
    let survey;
    try {
      survey = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Validate structure
    if (!survey.title || !Array.isArray(survey.questions)) {
      return NextResponse.json(
        { error: "Invalid survey structure generated. Please try again." },
        { status: 500 }
      );
    }

    // Validate and clean up questions
    const validatedQuestions = survey.questions
      .filter((q: Record<string, unknown>) => {
        // Must have type and title
        if (!q.type || !q.title) return false;
        // Type must be valid
        if (!VALID_QUESTION_TYPES.includes(q.type as typeof VALID_QUESTION_TYPES[number])) return false;
        return true;
      })
      .map((q: Record<string, unknown>, index: number) => ({
        id: `ai-${Date.now()}-${index}`,
        type: q.type,
        title: q.title,
        description: q.description || "",
        required: q.required ?? true,
        options: Array.isArray(q.options) ? q.options : undefined,
        settings: typeof q.settings === "object" ? q.settings : undefined,
      }));

    if (validatedQuestions.length === 0) {
      return NextResponse.json(
        { error: "No valid questions were generated. Please try a different prompt." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: survey.title,
      description: survey.description || "",
      questions: validatedQuestions,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (error) {
    logger.error("AI generation error", error);

    if (error instanceof Error && error.message.includes("401")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your OPENROUTER_API_KEY." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate survey. Please try again." },
      { status: 500 }
    );
  }
}
