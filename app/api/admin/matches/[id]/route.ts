import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/session";
import { cancelMatch } from "@/lib/match-creation";
import { db } from "@/db";
import { matches, streamPool, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Zod schema for match update
 */
const updateMatchSchema = z.object({
  opponentName: z.string().min(1).max(100).optional(),
  scheduledStart: z.string().datetime().optional(),
  courtLabel: z.string().max(20).optional(),
  status: z
    .enum(["scheduled", "ready", "live", "ended"])
    .optional()
});

/**
 * Valid status transitions
 * draft → scheduled → ready → live → ended
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "ready", "live", "ended", "canceled"],
  scheduled: ["ready", "live", "ended", "canceled"],
  ready: ["live", "ended"],
  live: ["ended"],
  ended: [],
  canceled: [],
  error: []
};

/**
 * PUT /api/admin/matches/[id]
 * Update match details or transition status
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Check admin authentication
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const matchId = params.id;

    // Parse and validate request body
    const body = await request.json();
    const validated = updateMatchSchema.parse(body);

    // Load existing match
    const existingMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (existingMatches.length === 0) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const existingMatch = existingMatches[0];

    // Validate status transition if status is being updated
    if (validated.status) {
      const allowedTransitions = VALID_TRANSITIONS[existingMatch.status];

      if (!allowedTransitions.includes(validated.status)) {
        return NextResponse.json(
          {
            error: "Invalid status transition",
            message: `Cannot transition from ${existingMatch.status} to ${validated.status}`
          },
          { status: 400 }
        );
      }
    }

    // Cannot edit opponent name after match leaves draft status
    if (validated.opponentName && existingMatch.status !== "draft") {
      return NextResponse.json(
        {
          error: "Cannot edit opponent name",
          message: "Opponent name can only be edited while match is in draft status"
        },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date()
    };

    if (validated.opponentName) updateData.opponentName = validated.opponentName;
    if (validated.scheduledStart)
      updateData.scheduledStart = new Date(validated.scheduledStart);
    if (validated.courtLabel !== undefined)
      updateData.courtLabel = validated.courtLabel;
    if (validated.status) updateData.status = validated.status;

    // Handle stream pool status updates based on match status
    if (validated.status) {
      if (validated.status === "live" && existingMatch.streamPoolId) {
        // Update stream to in_use
        await db
          .update(streamPool)
          .set({
            status: "in_use",
            updatedAt: new Date()
          })
          .where(eq(streamPool.id, existingMatch.streamPoolId));
      } else if (validated.status === "ended" && existingMatch.streamPoolId) {
        // Release stream back to pool
        await db
          .update(streamPool)
          .set({
            status: "available",
            reservedMatchId: null,
            updatedAt: new Date()
          })
          .where(eq(streamPool.id, existingMatch.streamPoolId));
      }
    }

    // Update match
    const updatedMatches = await db
      .update(matches)
      .set(updateData)
      .where(eq(matches.id, matchId))
      .returning();

    // Log to audit
    await db.insert(auditLog).values({
      action: "match_updated",
      detail: {
        matchId,
        updates: validated,
        previousStatus: existingMatch.status,
        newStatus: validated.status
      }
    });

    return NextResponse.json({ match: updatedMatches[0] });
  } catch (error) {
    console.error("Match update error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        {
          error: "Validation error",
          message: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to update match",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/matches/[id]
 * Cancel a match and release its stream
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Check admin authentication
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const matchId = params.id;

    // Call cancelMatch from library
    await cancelMatch(matchId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Match cancel error:", error);

    if (error instanceof Error) {
      if (error.message === "Match not found") {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
      }

      if (
        error.message === "Cannot cancel a live match" ||
        error.message.includes("Match is already")
      ) {
        return NextResponse.json(
          {
            error: "Cannot cancel match",
            message: error.message
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to cancel match",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
