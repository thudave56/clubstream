import { db } from "@/db";
import { matches, teams } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/matches/:id
 * Returns public match details (no sensitive fields)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;

  const rows = await db
    .select({
      id: matches.id,
      teamId: matches.teamId,
      teamDisplayName: teams.displayName,
      opponentName: matches.opponentName,
      tournamentId: matches.tournamentId,
      scheduledStart: matches.scheduledStart,
      courtLabel: matches.courtLabel,
      status: matches.status,
      youtubeWatchUrl: matches.youtubeWatchUrl,
      createdAt: matches.createdAt
    })
    .from(matches)
    .innerJoin(teams, eq(matches.teamId, teams.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  return Response.json({ match: rows[0] });
}
