import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import {
  getYouTubeStreamStatus,
  transitionBroadcast
} from "@/lib/match-creation";
import { db } from "@/db";
import { matches, streamPool, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/matches/[id]/auto-live
 * Checks if the YouTube stream is active and automatically transitions the broadcast to live.
 * Designed to be polled by the frontend after match creation.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const matchId = params.id;

    // Load match
    const matchRecords = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (matchRecords.length === 0) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const match = matchRecords[0];

    // Already live or ended - nothing to do
    if (match.status === "live") {
      return NextResponse.json({ status: "already_live" });
    }
    if (["ended", "canceled"].includes(match.status)) {
      return NextResponse.json({ status: match.status });
    }

    // Need broadcast and stream to check
    if (!match.youtubeBroadcastId || !match.streamPoolId) {
      return NextResponse.json({
        status: "waiting",
        streamStatus: "no_stream_bound"
      });
    }

    // Get stream record
    const streamRecords = await db
      .select()
      .from(streamPool)
      .where(eq(streamPool.id, match.streamPoolId))
      .limit(1);

    if (streamRecords.length === 0) {
      return NextResponse.json({
        status: "waiting",
        streamStatus: "stream_not_found"
      });
    }

    // Check YouTube stream status
    const ytStatus = await getYouTubeStreamStatus(
      streamRecords[0].youtubeStreamId
    );

    if (ytStatus.status !== "active") {
      return NextResponse.json({
        status: "waiting",
        streamStatus: ytStatus.status,
        healthStatus: ytStatus.healthStatus
      });
    }

    // Stream is active - transition broadcast to live
    try {
      await transitionBroadcast(match.youtubeBroadcastId, "testing");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await transitionBroadcast(match.youtubeBroadcastId, "live");
    } catch (error) {
      console.error("Auto-live transition failed:", error);
      return NextResponse.json({
        status: "transition_failed",
        streamStatus: ytStatus.status,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // Update match status to live
    await db
      .update(matches)
      .set({ status: "live", updatedAt: new Date() })
      .where(eq(matches.id, matchId));

    // Update stream pool to in_use
    await db
      .update(streamPool)
      .set({ status: "in_use", updatedAt: new Date() })
      .where(eq(streamPool.id, match.streamPoolId));

    // Audit log
    await db.insert(auditLog).values({
      action: "match_auto_live",
      detail: {
        matchId,
        broadcastId: match.youtubeBroadcastId,
        streamStatus: ytStatus.status
      }
    });

    return NextResponse.json({ status: "live" });
  } catch (error) {
    console.error("Auto-live error:", error);
    return NextResponse.json(
      {
        error: "Auto-live check failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
