import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { teams, adminSettings } from "./schema";
import { hashPin } from "../lib/auth";

const teamData = [
  { slug: "northside-lions", displayName: "Northside Lions" },
  { slug: "river-valley-hawks", displayName: "River Valley Hawks" },
  { slug: "east-harbor-fc", displayName: "East Harbor FC" },
  { slug: "lakeside-united", displayName: "Lakeside United" }
];

// Default admin PIN - configurable via environment variable
const DEFAULT_ADMIN_PIN = process.env.DEFAULT_ADMIN_PIN || "1234";

async function main() {
  // Seed teams
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

  // Initialize admin settings
  const existingSettings = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);

  if (existingSettings.length === 0) {
    const adminPinHash = hashPin(DEFAULT_ADMIN_PIN);

    await db.insert(adminSettings).values({
      id: 1,
      requireCreatePin: false,
      adminPinHash,
      oauthStatus: "disconnected"
    });

    console.log("Initialized admin settings");
    console.log(`[seed] Default admin PIN: ${DEFAULT_ADMIN_PIN}`);
    console.log("[seed] IMPORTANT: Change this PIN in production!");
  } else {
    console.log("Admin settings already initialized");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
