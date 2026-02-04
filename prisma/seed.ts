import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teams = ["Northside Lions", "River Valley Hawks", "East Harbor FC", "Lakeside United"];

  for (const name of teams) {
    await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  console.log("Seeded teams:", teams.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
