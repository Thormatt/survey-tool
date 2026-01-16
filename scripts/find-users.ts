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
  const users = await prisma.survey.findMany({
    select: { userId: true },
    distinct: ["userId"],
    take: 5,
  });
  console.log(
    "Found user IDs:",
    users.map((u) => u.userId)
  );
}

main().finally(() => prisma.$disconnect());
