import { desc } from "drizzle-orm";
import { db } from "@/db";
import { tournaments } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/tournaments
 * Returns list of all tournaments ordered by start date (most recent first)
 */
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.startDate));

    return Response.json({ tournaments: rows });
  } catch (error) {
    console.error("Failed to fetch tournaments:", error);

    return Response.json(
      {
        error: "Failed to fetch tournaments",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
