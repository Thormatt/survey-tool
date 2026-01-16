/**
 * Delete all responses from a survey
 * Run with: npx tsx scripts/delete-responses.ts <survey_id>
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

async function main() {
  const surveyId = process.argv[2];

  if (!surveyId) {
    console.log("Usage: npx tsx scripts/delete-responses.ts <survey_id>");
    process.exit(1);
  }

  // Find and delete all responses for this survey
  const responses = await prisma.response.findMany({
    where: { surveyId },
    select: { id: true },
  });

  console.log(`Found ${responses.length} response(s) to delete`);

  for (const response of responses) {
    // Delete answers first (cascade should handle this but being explicit)
    await prisma.answer.deleteMany({
      where: { responseId: response.id },
    });

    // Delete the response
    await prisma.response.delete({
      where: { id: response.id },
    });

    console.log(`Deleted response ${response.id}`);
  }

  console.log("Done!");
}

main().finally(() => prisma.$disconnect());
