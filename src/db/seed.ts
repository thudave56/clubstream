import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { teams } from "./schema";

const teamNames = ["Northside Lions", "River Valley Hawks", "East Harbor FC", "Lakeside United"];

async function main() {
  for (const name of teamNames) {
    const existing = await db.select().from(teams).where(eq(teams.name, name)).limit(1);

    if (existing.length === 0) {
      await db.insert(teams).values({ name });
    }
  }

  console.log(`Seeded teams: ${teamNames.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
