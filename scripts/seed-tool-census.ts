/**
 * Seed Script: The Great Tool Census of 2025
 *
 * Run with: npx tsx scripts/seed-tool-census.ts <clerk_user_id>
 *
 * This creates a witty, engaging survey about workplace tools.
 * Humor level: turned up to 11.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import "dotenv/config";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaNeonHttp(connectionString, {
    arrayMode: false,
    fullResults: true,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

// Define all the questions
const questions = [
  // ===== SECTION 1: ABOUT YOU =====
  {
    type: "SECTION_HEADER",
    title: "About You",
    description:
      "Quick identity check—we promise this isn't a Voight-Kampff test",
    required: false,
    order: 0,
  },
  {
    type: "SINGLE_CHOICE",
    title: "What hat do you mostly wear?",
    description: "Pick the role that takes up most of your brain space",
    required: true,
    order: 1,
    options: [
      "The 'But Why?' Philosopher (Strategy/Advisory)",
      "Professional Cat Herder (Project Management)",
      "The One Who Actually Builds The Thing (Technical)",
      "The Reason Anything Works (Operations/Admin)",
      "Professional Friend-Maker (Business Development)",
      "It's Complicated (Other)",
    ],
  },
  {
    type: "SINGLE_CHOICE",
    title: "How long have you been navigating this particular spaceship?",
    required: true,
    order: 2,
    options: [
      "Still finding the bathroom and the Notion page (<3 months)",
      "Starting to recognize faces in the Zoom grid (3-6 months)",
      "Can finally find things in Drive, sometimes (6-12 months)",
      "Has opinions about the old logo (1+ year)",
    ],
  },
  {
    type: "SINGLE_CHOICE",
    title: "How many hours per week do you spend in digital tools?",
    description: "Be honest. We won't judge. Much.",
    required: true,
    order: 3,
    options: [
      "Blessed and/or suspicious (<10 hours)",
      "Healthy-ish (10-20 hours)",
      "Tool-forward (20-30 hours)",
      "Please accept our condolences (30+ hours)",
    ],
  },

  // ===== SECTION 2: GOOGLE TOOLS =====
  {
    type: "SECTION_HEADER",
    title: "The Alphabet Empire",
    description:
      "Google: Where your data goes to feel loved. Gmail, Drive, Gemini—the holy trinity of 'wait, which Google account am I logged into?'",
    required: false,
    order: 4,
  },
  {
    type: "MULTIPLE_CHOICE",
    title: "Which Google tools do you use for work?",
    description: "Check all that apply. Yes, even that random one.",
    required: true,
    order: 5,
    options: [
      "Gmail (The inbox that never sleeps)",
      "Google Drive (The cloud that contains everything)",
      "Google Docs (Collaborative chaos)",
      "Google Sheets (Excel's cooler cousin)",
      "Google Slides (Death by presentation)",
      "Google Meet (Zoom's competition)",
      "Google Calendar (Time Tetris)",
      "Gemini (Our AI overlord)",
      "None of the above (How?!)",
    ],
  },
  {
    type: "MATRIX",
    title: "Rate your Google tools",
    description: "How satisfied are you with each tool you use?",
    required: false,
    order: 6,
    options: [
      "Gmail",
      "Google Drive",
      "Google Docs",
      "Google Sheets",
      "Google Slides",
      "Google Meet",
      "Google Calendar",
      "Gemini",
    ],
    settings: {
      scaleMin: 1,
      scaleMax: 5,
      scaleLabels: {
        "1": "Why does this exist?",
        "2": "Meh with sighing",
        "3": "Gets the job done",
        "4": "Actually pretty great",
        "5": "Would defend in combat",
      },
    },
  },
  {
    type: "LONG_TEXT",
    title: "What does Google do well for you?",
    description:
      "Give credit where it's due. What makes you smile (or at least not grimace)?",
    required: false,
    order: 7,
  },
  {
    type: "LONG_TEXT",
    title: "What frustrates you about Google tools?",
    description: "Let it out. This is a safe space for complaints.",
    required: false,
    order: 8,
  },

  // ===== SECTION 3: NOTION =====
  {
    type: "SECTION_HEADER",
    title: "The Second Brain (With Occasional Amnesia)",
    description:
      "Part wiki, part database, part existential puzzle. Notion contains everything we know—in theory. Finding it is another matter entirely.",
    required: false,
    order: 9,
  },
  {
    type: "SINGLE_CHOICE",
    title: "Do you use Notion?",
    required: true,
    order: 10,
    options: [
      "Yes, religiously",
      "Yes, occasionally",
      "I'm supposed to, but I keep forgetting",
      "No, what's Notion?",
    ],
  },
  {
    type: "RATING",
    title: "How helpful is Notion for your work?",
    description:
      "1 = 'I'd rather use stone tablets' → 5 = 'My second brain is thriving'",
    required: false,
    order: 11,
  },
  {
    type: "LONG_TEXT",
    title: "What's great about Notion?",
    description: "What makes you want to organize all the things?",
    required: false,
    order: 12,
  },
  {
    type: "LONG_TEXT",
    title: "What frustrates you about Notion?",
    description: "What makes you want to throw your laptop into the sea?",
    required: false,
    order: 13,
  },

  // ===== SECTION 4: SLACK =====
  {
    type: "SECTION_HEADER",
    title: "The Place Where Keyboards Go to Die",
    description:
      "Slack walked into a bar. It immediately created #bar-general, #bar-random, and #bar-standup-async. You've been added to all of them.",
    required: false,
    order: 14,
  },
  {
    type: "SINGLE_CHOICE",
    title: "Do you use Slack?",
    required: true,
    order: 15,
    options: [
      "Yes, it's always open",
      "Yes, but I try to limit it",
      "Only when I absolutely have to",
      "No",
    ],
  },
  {
    type: "RATING",
    title: "How helpful is Slack for team communication?",
    description:
      "1 = 'Carrier pigeons were better' → 5 = 'Can't imagine work without it'",
    required: false,
    order: 16,
  },
  {
    type: "SINGLE_CHOICE",
    title: "How do you feel about your current Slack notification settings?",
    required: false,
    order: 17,
    options: [
      "Perfectly tuned, like a Swiss watch",
      "Good enough, occasional noise",
      "Constant anxiety ping pong",
      "I've given up and muted everything",
      "What notifications?",
    ],
  },
  {
    type: "LONG_TEXT",
    title: "What's great about Slack?",
    required: false,
    order: 18,
  },
  {
    type: "LONG_TEXT",
    title: "What frustrates you about Slack?",
    description:
      "DMs? Channels? The eternal search for that one message from three weeks ago?",
    required: false,
    order: 19,
  },

  // ===== SECTION 5: CLAUDE =====
  {
    type: "SECTION_HEADER",
    title: "Your Friendly Neighborhood AI",
    description:
      "An AI that won't judge your questions. Yes, even that one. Claude has seen things. Claude helps anyway.",
    required: false,
    order: 20,
  },
  {
    type: "SINGLE_CHOICE",
    title: "Do you use Claude (or other AI assistants) for work?",
    required: true,
    order: 21,
    options: [
      "Yes, daily companion",
      "Yes, when I remember it exists",
      "Tried it a few times",
      "No, not yet",
      "What's Claude?",
    ],
  },
  {
    type: "RATING",
    title: "How helpful is Claude for your work?",
    description:
      "1 = 'Skynet with worse advice' → 5 = 'My productivity superpower'",
    required: false,
    order: 22,
  },
  {
    type: "MULTIPLE_CHOICE",
    title: "What do you primarily use Claude for?",
    required: false,
    order: 23,
    options: [
      "Writing & editing text",
      "Brainstorming ideas",
      "Research & summarizing",
      "Code & technical help",
      "Data analysis",
      "Learning new things",
      "Avoiding awkward Google searches",
      "Other creative chaos",
    ],
  },
  {
    type: "LONG_TEXT",
    title: "What's great about Claude?",
    required: false,
    order: 24,
  },
  {
    type: "LONG_TEXT",
    title: "What frustrates you about Claude?",
    description: "It's okay, Claude won't take it personally. Probably.",
    required: false,
    order: 25,
  },

  // ===== SECTION 6: HUBSPOT =====
  {
    type: "SECTION_HEADER",
    title: "Relationship Status: It's Complicated",
    description:
      "Where we pretend to remember everyone's birthday and track deals like a hawk tracking a very professional rabbit.",
    required: false,
    order: 26,
  },
  {
    type: "SINGLE_CHOICE",
    title: "Do you use HubSpot?",
    required: true,
    order: 27,
    options: [
      "Yes, it's my CRM soulmate",
      "Yes, when forced",
      "I log in quarterly to update something",
      "No",
    ],
  },
  {
    type: "RATING",
    title: "How helpful is HubSpot for your work?",
    description:
      "1 = 'Just use a spreadsheet' → 5 = 'Customer relationship nirvana'",
    required: false,
    order: 28,
  },
  {
    type: "LONG_TEXT",
    title: "What's great about HubSpot?",
    required: false,
    order: 29,
  },
  {
    type: "LONG_TEXT",
    title: "What frustrates you about HubSpot?",
    required: false,
    order: 30,
  },

  // ===== SECTION 7: ZOOM =====
  {
    type: "SECTION_HEADER",
    title: "The Portal to Tiny Boxes of Faces",
    description:
      "'You're on mute.' 'Can you see my screen?' 'Let me share my—wait, wrong window.' Every. Single. Time.",
    required: false,
    order: 31,
  },
  {
    type: "SINGLE_CHOICE",
    title: "Do you use Zoom?",
    required: true,
    order: 32,
    options: [
      "Yes, multiple times daily",
      "Yes, a few times a week",
      "Only for special occasions",
      "No, we use something else",
    ],
  },
  {
    type: "RATING",
    title: "How would you rate Zoom as a meeting tool?",
    description:
      "1 = 'Carrier pigeons were clearer' → 5 = 'Crystal clear communication'",
    required: false,
    order: 33,
  },
  {
    type: "LONG_TEXT",
    title: "What's great about Zoom?",
    required: false,
    order: 34,
  },
  {
    type: "LONG_TEXT",
    title: "What frustrates you about Zoom?",
    description:
      "Virtual backgrounds? Recording anxiety? The existential dread of 'you're on mute'?",
    required: false,
    order: 35,
  },

  // ===== SECTION 8: MEETINGS =====
  {
    type: "SECTION_HEADER",
    title: "The Gathering of Rectangles",
    description:
      "When distributed team members align their calendars, their webcams, and occasionally their pants.",
    required: false,
    order: 36,
  },
  {
    type: "SINGLE_CHOICE",
    title: "How effective are your team meetings generally?",
    required: true,
    order: 37,
    options: [
      "This could've been a carrier pigeon",
      "Mostly staring at my own face",
      "Hit or miss, like WiFi",
      "Generally worth pants",
      "Would voluntarily attend",
    ],
  },
  {
    type: "SINGLE_CHOICE",
    title: "How do you feel about the current meeting frequency?",
    required: true,
    order: 38,
    options: [
      "WAY too many meetings",
      "Slightly too many",
      "Just right, Goldilocks-style",
      "Could use a few more",
      "Meetings? What meetings?",
    ],
  },
  {
    type: "SINGLE_CHOICE",
    title: "How do you feel about meeting lengths?",
    required: true,
    order: 39,
    options: [
      "They drag on forever",
      "Usually a bit too long",
      "Generally appropriate",
      "Often too short to be useful",
      "Speed-running meetings over here",
    ],
  },
  {
    type: "LONG_TEXT",
    title: "What makes team meetings actually useful?",
    description:
      "What's the secret sauce for a meeting that doesn't make you want to fake a WiFi outage?",
    required: false,
    order: 40,
  },
  {
    type: "LONG_TEXT",
    title: "What derails team meetings?",
    description:
      "The tangents, the tech issues, the 'can we loop back to that'?",
    required: false,
    order: 41,
  },
  {
    type: "LONG_TEXT",
    title: "How would you improve team meetings?",
    description:
      "Dream big. Standing meetings? Async updates? Interpretive dance recaps?",
    required: false,
    order: 42,
  },
  {
    type: "SINGLE_CHOICE",
    title: "Sync vs async: where's the sweet spot?",
    required: true,
    order: 43,
    options: [
      "More sync, less async (I like face time)",
      "Current balance is good",
      "More async, less sync (Let me work in peace)",
      "100% async or I riot",
    ],
  },

  // ===== SECTION 9: INTEGRATION DREAMS =====
  {
    type: "SECTION_HEADER",
    title: "If Our Tools Got Married",
    description:
      "Which tools should get couples therapy? Which should finally exchange API keys?",
    required: false,
    order: 44,
  },
  {
    type: "SCALE",
    title: "How well do your current tools work together?",
    description:
      "1 = 'They don't even know each other exist' → 10 = 'Seamless symphony'",
    required: true,
    order: 45,
  },
  {
    type: "MULTIPLE_CHOICE",
    title: "Which tool integrations would make your life less copy-paste-y?",
    description: "Check all the dream team-ups",
    required: false,
    order: 46,
    options: [
      "Slack ↔ Notion (Messages become docs)",
      "Gmail ↔ HubSpot (Emails that remember themselves)",
      "Claude ↔ Google Docs (AI-powered writing)",
      "Slack ↔ Google Calendar (Smart scheduling)",
      "Notion ↔ Google Drive (One brain, finally)",
      "Zoom ↔ Notion (Meeting notes that write themselves)",
      "Everything ↔ Everything (Just make it work)",
    ],
  },
  {
    type: "LONG_TEXT",
    title:
      "What repetitive task do you do that feels like it should be automated?",
    description:
      "The copy-paste shuffle, the manual data entry dance, the 'why is this still a thing' tasks?",
    required: false,
    order: 47,
  },

  // ===== SECTION 10: YOUR SECRET WEAPONS =====
  {
    type: "SECTION_HEADER",
    title: "The Ghost of Workplaces Past",
    description:
      "Tools you've loved and lost. We want to hear about your exes (the software kind).",
    required: false,
    order: 48,
  },
  {
    type: "LONG_TEXT",
    title: "What tools from past jobs do you miss?",
    description:
      "The one that got away. The software you still think about sometimes.",
    required: false,
    order: 49,
  },
  {
    type: "LONG_TEXT",
    title: "If you had a magic wand, what one tool or capability would you add?",
    description:
      "Sky's the limit. Teleportation app? Mind-reading CRM? A button that says 'Do The Thing'?",
    required: false,
    order: 50,
  },

  // ===== SECTION 11: LEVEL UP =====
  {
    type: "SECTION_HEADER",
    title: "Level Up",
    description: "Because we're all forever students of the tool arts",
    required: false,
    order: 51,
  },
  {
    type: "MULTIPLE_CHOICE",
    title: "Which tools would you like to learn better?",
    description: "Check all that apply. No judgment on current skill levels.",
    required: false,
    order: 52,
    options: [
      "Google Suite (Sheets ninja mode)",
      "Notion (Database wizardry)",
      "Slack (Workflow automation)",
      "Claude (AI whispering)",
      "HubSpot (CRM mastery)",
      "Zoom (Meeting hosting pro)",
      "I'm good, thanks",
    ],
  },
  {
    type: "SINGLE_CHOICE",
    title: "How do you prefer to learn new tools?",
    required: true,
    order: 53,
    options: [
      "Self-guided exploration (RTFM, but make it fun)",
      "Quick video tutorials",
      "Hands-on workshops with others",
      "One-on-one training",
      "Just throw me in, I'll figure it out",
      "Ask Claude or Google",
    ],
  },
  {
    type: "LONG_TEXT",
    title: "Final soapbox: anything else about tools, workflows, or digital life?",
    description: "Your moment to rant, rave, or request. We're listening. 🎤",
    required: false,
    order: 54,
  },
];

async function main() {
  // Get the user ID from command line or use a default
  const userId = process.argv[2];

  if (!userId) {
    console.error(
      "Usage: npx tsx scripts/seed-tool-census.ts <clerk_user_id>"
    );
    console.error(
      "\nTo find your Clerk user ID, check your Clerk dashboard or run:"
    );
    console.error("  npx tsx scripts/find-users.ts");
    process.exit(1);
  }

  console.log("🎯 Creating The Great Tool Census of 2025...\n");

  // Create survey first (without nested questions to avoid transaction)
  const survey = await prisma.survey.create({
    data: {
      title: "The Great Tool Census of 2025",
      description:
        "A Survey About Our Digital Companions\n\nPlot twist: We spend more quality time with our tools than with most humans. Let's make sure they deserve us. This takes ~10 minutes, or exactly one coffee + existential crisis about tabs vs spaces.",
      published: false, // Draft mode
      userId,
      accessType: "UNLISTED",
      isAnonymous: true,
    },
  });

  console.log(`📝 Survey created: ${survey.id}`);
  console.log(`⏳ Adding ${questions.length} questions...`);

  // Create questions one by one
  for (const q of questions) {
    await prisma.question.create({
      data: {
        surveyId: survey.id,
        type: q.type as any,
        title: q.title,
        description: q.description ?? null,
        required: q.required,
        order: q.order,
        options: q.options ?? null,
        settings: (q as any).settings ?? null,
      },
    });
    process.stdout.write(".");
  }

  console.log("\n\n✅ Survey created successfully!");
  console.log(`\n📊 Survey ID: ${survey.id}`);
  console.log(`📝 Title: ${survey.title}`);
  console.log(`❓ Questions: ${questions.length}`);
  console.log(`📋 Status: Draft (not published)`);
  console.log(`\n🔗 To edit: http://localhost:3000/surveys/${survey.id}`);
  console.log(`\n🚀 Remember to publish when ready!`);
}

main()
  .catch((e) => {
    console.error("Error creating survey:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
