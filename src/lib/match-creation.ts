import { z } from "zod";
import { db } from "@/db";
import { matches, teams, tournaments, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getYouTubeClient } from "./youtube-auth";
import {
  reserveStream,
  releaseStream,
  getStreamByMatchId,
  type ReservedStreamData
} from "./stream-pool";

/**
 * Custom error for when no streams are available in the pool
 */
export class NoStreamsAvailableError extends Error {
  constructor() {
    super("No streams available in pool");
    this.name = "NoStreamsAvailableError";
  }
}

/**
 * Zod schema for match creation parameters
 */
export const createMatchSchema = z.object({
  teamId: z.string().uuid(),
  opponentName: z.string().min(1).max(100),
  tournamentId: z.string().uuid().optional(),
  scheduledStart: z.string().datetime().optional(),
  courtLabel: z.string().max(20).optional(),
  privacyStatus: z.enum(["public", "unlisted"]).optional(),
  idempotencyKey: z.string().max(100).optional()
});

export type CreateMatchParams = z.infer<typeof createMatchSchema>;

/**
 * Broadcast details for YouTube API
 */
export interface BroadcastDetails {
  title: string;
  description?: string;
  scheduledStart?: Date;
  privacyStatus: "public" | "unlisted";
}

/**
 * Broadcast data returned from YouTube API
 */
export interface BroadcastData {
  broadcastId: string;
  watchUrl: string;
}

/**
 * Match creation result with Larix URL
 */
export interface MatchCreationResult {
  match: typeof matches.$inferSelect;
  larixUrl: string;
}

/**
 * Create a YouTube live broadcast and bind it to a stream
 * @param matchDetails - Broadcast metadata
 * @param streamId - YouTube stream ID to bind to
 * @returns Broadcast ID and watch URL
 * @throws Error if YouTube API fails
 */
export async function createYouTubeBroadcast(
  matchDetails: BroadcastDetails,
  streamId: string
): Promise<BroadcastData> {
  try {
    const youtube = await getYouTubeClient();

    const response = await youtube.liveBroadcasts.insert({
      part: ["snippet", "contentDetails", "status"],
      requestBody: {
        snippet: {
          title: matchDetails.title,
          description: matchDetails.description || "",
          scheduledStartTime: matchDetails.scheduledStart?.toISOString()
        },
        status: {
          privacyStatus: matchDetails.privacyStatus
        },
        contentDetails: {
          boundStreamId: streamId
        }
      }
    });

    if (!response.data.id) {
      throw new Error("No broadcast ID received from YouTube API");
    }

    const broadcastId = response.data.id;
    const watchUrl = `https://youtube.com/watch?v=${broadcastId}`;

    return { broadcastId, watchUrl };
  } catch (error) {
    console.error("Failed to create YouTube broadcast:", error);
    throw new Error(
      `YouTube broadcast creation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Generate Larix broadcaster URL for one-tap streaming
 * @param ingestAddress - RTMP ingest URL
 * @param streamName - RTMP stream key
 * @param matchTitle - Title for the stream
 * @returns larix:// URL with base64-encoded configuration
 */
export function generateLarixUrl(
  ingestAddress: string,
  streamName: string,
  matchTitle: string
): string {
  // Combine RTMP URL and stream key
  const rtmpUrl = `${ingestAddress}/${streamName}`;

  // Larix configuration object
  const config = {
    connections: [
      {
        url: rtmpUrl,
        name: "ClubStream Match",
        autoReconnect: true,
        record: true
      }
    ],
    video: {
      resolution: "1280x720",
      fps: 30,
      bitrate: 2500000 // 2.5 Mbps
    },
    audio: {
      bitrate: 128000 // 128 kbps
    },
    title: matchTitle
  };

  // Encode as base64
  const configJson = JSON.stringify(config);
  const base64 = Buffer.from(configJson).toString("base64");

  return `larix://set/${base64}`;
}

/**
 * Create a new match with YouTube broadcast and stream assignment
 * @param params - Match creation parameters
 * @returns Match record with Larix URL
 * @throws NoStreamsAvailableError if pool is exhausted
 * @throws Error if validation fails or YouTube API fails
 */
export async function createMatch(
  params: CreateMatchParams
): Promise<MatchCreationResult> {
  // Validate parameters
  const validated = createMatchSchema.parse(params);

  // Check idempotency key for duplicate requests
  if (validated.idempotencyKey) {
    const existing = await db
      .select()
      .from(matches)
      .where(eq(matches.idempotencyKey, validated.idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      // Return existing match
      const existingMatch = existing[0];
      const streamData = await getStreamByMatchId(existingMatch.id);

      if (!streamData) {
        throw new Error("Stream data not found for existing match");
      }

      const larixUrl = generateLarixUrl(
        streamData.ingestAddress,
        streamData.streamName,
        `${existingMatch.opponentName} Match`
      );

      return { match: existingMatch, larixUrl };
    }
  }

  // Verify team exists
  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, validated.teamId))
    .limit(1);

  if (team.length === 0) {
    throw new Error("Team not found");
  }

  // Verify tournament exists if provided
  if (validated.tournamentId) {
    const tournament = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, validated.tournamentId))
      .limit(1);

    if (tournament.length === 0) {
      throw new Error("Tournament not found");
    }
  }

  let reservedStream: ReservedStreamData | null = null;

  try {
    // Generate a temporary match ID for stream reservation
    // We'll use this to reserve the stream before creating the match
    const tempMatchId = crypto.randomUUID();

    // Step 1: Reserve stream from pool
    reservedStream = await reserveStream(tempMatchId);

    if (!reservedStream) {
      throw new NoStreamsAvailableError();
    }

    // Step 2: Create YouTube broadcast (external API - cannot be rolled back)
    const broadcastDetails: BroadcastDetails = {
      title: `${team[0].displayName} vs ${validated.opponentName}`,
      description: validated.courtLabel
        ? `Court: ${validated.courtLabel}`
        : undefined,
      scheduledStart: validated.scheduledStart
        ? new Date(validated.scheduledStart)
        : undefined,
      privacyStatus: validated.privacyStatus || "unlisted"
    };

    const broadcast = await createYouTubeBroadcast(
      broadcastDetails,
      reservedStream.youtubeStreamId
    );

    // Step 3: Insert match record
    const insertedMatch = await db
      .insert(matches)
      .values({
        teamId: validated.teamId,
        opponentName: validated.opponentName,
        tournamentId: validated.tournamentId,
        scheduledStart: validated.scheduledStart
          ? new Date(validated.scheduledStart)
          : null,
        courtLabel: validated.courtLabel,
        status: "draft",
        youtubeBroadcastId: broadcast.broadcastId,
        youtubeWatchUrl: broadcast.watchUrl,
        streamPoolId: reservedStream.id,
        idempotencyKey: validated.idempotencyKey,
        updatedAt: new Date()
      })
      .returning();

    const match = insertedMatch[0];

    // Update the stream reservation with the actual match ID
    await db
      .update(matches)
      .set({ id: match.id })
      .where(eq(matches.id, tempMatchId));

    // Generate Larix URL
    const larixUrl = generateLarixUrl(
      reservedStream.ingestAddress,
      reservedStream.streamName,
      `${team[0].displayName} vs ${validated.opponentName}`
    );

    // Log to audit
    await db.insert(auditLog).values({
      action: "match_created",
      detail: {
        matchId: match.id,
        teamId: match.teamId,
        opponentName: match.opponentName,
        broadcastId: match.youtubeBroadcastId,
        streamPoolId: match.streamPoolId
      }
    });

    return { match, larixUrl };
  } catch (error) {
    // Cleanup on error - release reserved stream
    if (reservedStream) {
      try {
        await releaseStream(reservedStream.youtubeStreamId);
      } catch (releaseError) {
        console.error("Failed to release stream during rollback:", releaseError);
      }
    }

    // Re-throw the error
    throw error;
  }
}

/**
 * Cancel a match and release its stream back to the pool
 * @param matchId - Match ID to cancel
 * @throws Error if match is live or not found
 */
export async function cancelMatch(matchId: string): Promise<void> {
  // Load match
  const matchRecords = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (matchRecords.length === 0) {
    throw new Error("Match not found");
  }

  const match = matchRecords[0];

  // Cannot cancel live matches
  if (match.status === "live") {
    throw new Error("Cannot cancel a live match");
  }

  // Cannot cancel already ended/canceled matches
  if (match.status === "ended" || match.status === "canceled") {
    throw new Error(`Match is already ${match.status}`);
  }

  // Update match status to canceled
  await db
    .update(matches)
    .set({
      status: "canceled",
      updatedAt: new Date()
    })
    .where(eq(matches.id, matchId));

  // Release stream back to pool
  if (match.streamPoolId) {
    const streamData = await getStreamByMatchId(matchId);
    if (streamData) {
      await releaseStream(streamData.youtubeStreamId);
    }
  }

  // Log to audit
  await db.insert(auditLog).values({
    action: "match_canceled",
    detail: {
      matchId: match.id,
      previousStatus: match.status
    }
  });
}
