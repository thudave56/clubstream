import { NextResponse } from "next/server";
import {
  getBroadcastStatus,
  getYouTubeStreamStatus,
  transitionBroadcast
} from "@/lib/match-creation";
import { db } from "@/db";
import { matches, streamPool, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Throttle: track last poll time per match ID */
const lastPollTime = new Map<string, number>();
const THROTTLE_MS = 3000;

/**
 * POST /api/matches/[id]/auto-live
 * Public endpoint to check stream status and auto-transition to live.
 * Throttled to 1 request per 3 seconds per match ID.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;

    // Throttle polling
    const now = Date.now();
    const lastPoll = lastPollTime.get(matchId);
    if (lastPoll && now - lastPoll < THROTTLE_MS) {
      return NextResponse.json({
        status: "waiting",
        streamStatus: "throttled"
      });
    }
    lastPollTime.set(matchId, now);

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

    // Match ended or canceled — stop polling
    if (["ended", "canceled"].includes(match.status)) {
      return NextResponse.json({ status: match.status });
    }

    // Already live — return current stream health so callers can monitor
    if (match.status === "live") {
      if (match.streamPoolId) {
        const liveStreamRecords = await db
          .select()
          .from(streamPool)
          .where(eq(streamPool.id, match.streamPoolId))
          .limit(1);

        if (liveStreamRecords.length > 0) {
          const ytHealth = await getYouTubeStreamStatus(
            liveStreamRecords[0].youtubeStreamId
          );
          return NextResponse.json({
            status: "already_live",
            streamStatus: ytHealth.status,
            healthStatus: ytHealth.healthStatus
          });
        }
      }
      return NextResponse.json({ status: "already_live" });
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

    // Stream is active - check broadcast status and transition to live
    const broadcastStatus = await getBroadcastStatus(match.youtubeBroadcastId);

    try {
      if (broadcastStatus === "ready" || broadcastStatus === "created") {
        await transitionBroadcast(match.youtubeBroadcastId, "testing");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // Re-check in case testing transition just happened or was already done
      const currentStatus = broadcastStatus === "ready" || broadcastStatus === "created"
        ? "testing"
        : broadcastStatus;

      if (currentStatus === "testing" || currentStatus === "testStarting") {
        await transitionBroadcast(match.youtubeBroadcastId, "live");
      } else if (currentStatus === "live" || currentStatus === "liveStarting") {
        // Already live — fall through to update DB
      } else {
        return NextResponse.json({
          status: "waiting",
          streamStatus: ytStatus.status,
          broadcastStatus: currentStatus
        });
      }
    } catch (error) {
      console.error("Auto-live transition failed:", error);
      return NextResponse.json({
        status: "transition_failed",
        streamStatus: ytStatus.status,
        broadcastStatus
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
        streamStatus: ytStatus.status,
        source: "public"
      }
    });

    return NextResponse.json({ status: "live" });
  } catch (error) {
    console.error("Auto-live error:", error);
    return NextResponse.json(
      { error: "Auto-live check failed" },
      { status: 500 }
    );
  }
}
