import { db } from "@/db";
import { matches, streamPool, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { transitionBroadcast } from "@/lib/match-creation";

export const dynamic = "force-dynamic";

/**
 * POST /api/matches/:id/end
 * Public endpoint to end a live match — completes the YouTube broadcast
 * and releases the stream back to the pool.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (matchRows.length === 0) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  const match = matchRows[0];

  if (match.status === "ended") {
    return Response.json({ message: "Match already ended" });
  }

  if (match.status === "canceled") {
    return Response.json(
      { error: "Match was canceled" },
      { status: 400 }
    );
  }

  // End YouTube broadcast
  if (match.youtubeBroadcastId) {
    try {
      await transitionBroadcast(match.youtubeBroadcastId, "complete");
    } catch (error) {
      console.error("Failed to end YouTube broadcast:", error);
      // Continue with local end even if YouTube fails
    }
  }

  // Release stream back to pool
  if (match.streamPoolId) {
    await db
      .update(streamPool)
      .set({
        status: "available",
        reservedMatchId: null,
        updatedAt: new Date()
      })
      .where(eq(streamPool.id, match.streamPoolId));
  }

  // Update match status
  const updated = await db
    .update(matches)
    .set({ status: "ended", updatedAt: new Date() })
    .where(eq(matches.id, matchId))
    .returning();

  // Audit log
  await db.insert(auditLog).values({
    action: "match_ended",
    detail: {
      matchId,
      previousStatus: match.status,
      source: "public"
    }
  });

  return Response.json({ match: updated[0] });
}
