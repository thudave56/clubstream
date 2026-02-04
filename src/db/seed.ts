import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { teams } from "./schema";

const teamData = [
  { slug: "northside-lions", displayName: "Northside Lions" },
  { slug: "river-valley-hawks", displayName: "River Valley Hawks" },
  { slug: "east-harbor-fc", displayName: "East Harbor FC" },
  { slug: "lakeside-united", displayName: "Lakeside United" }
];

async function main() {
  for (const team of teamData) {
    const existing = await db.select().from(teams).where(eq(teams.slug, team.slug)).limit(1);

    if (existing.length === 0) {
      await db.insert(teams).values({
        slug: team.slug,
        displayName: team.displayName,
        enabled: true
      });
    }
  }

  console.log(`Seeded teams: ${teamData.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
