import { z } from "zod";
import { db } from "@/db";
import { matches, teams, tournaments, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getYouTubeClient } from "./youtube-auth";
import {
  reserveStream,
  releaseStream,
  getStreamByMatchId,
  updateStreamReservation,
  type ReservedStreamData
} from "./stream-pool";
import { buildYouTubeDescription, buildYouTubeTitle } from "./youtube-title";

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
  tournamentName: z.string().min(1).max(120).optional(),
  scheduledStart: z.string().datetime().optional(),
  courtLabel: z.string().max(20).optional(),
  privacyStatus: z.enum(["public", "unlisted"]).optional(),
  idempotencyKey: z.string().max(100).optional(),
  recordLocally: z.boolean().optional()
});

export type CreateMatchParams = z.infer<typeof createMatchSchema>;

/**
 * Broadcast details for YouTube API
 */
export interface BroadcastDetails {
  title: string;
  description?: string;
  scheduledStart: Date; // Required by YouTube API when binding to a stream
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

    // Step 1: Create the broadcast
    const response = await youtube.liveBroadcasts.insert({
      part: ["snippet", "contentDetails", "status"],
      requestBody: {
        snippet: {
          title: matchDetails.title,
          description: matchDetails.description || "",
          scheduledStartTime: matchDetails.scheduledStart.toISOString()
        },
        status: {
          privacyStatus: matchDetails.privacyStatus
        }
      }
    });

    if (!response.data.id) {
      throw new Error("No broadcast ID received from YouTube API");
    }

    const broadcastId = response.data.id;

    // Step 2: Explicitly bind the stream to the broadcast
    await youtube.liveBroadcasts.bind({
      id: broadcastId,
      part: ["id", "contentDetails"],
      streamId: streamId
    });

    console.log(`Broadcast ${broadcastId} bound to stream ${streamId}`);

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
 * Check YouTube stream status to verify it's receiving data
 * @param streamId - YouTube stream ID
 * @returns Stream status info
 */
export async function getYouTubeStreamStatus(
  streamId: string
): Promise<{ status: string; healthStatus: string }> {
  try {
    const youtube = await getYouTubeClient();
    const response = await youtube.liveStreams.list({
      part: ["status"],
      id: [streamId]
    });

    const stream = response.data.items?.[0];
    if (!stream) {
      return { status: "not_found", healthStatus: "unknown" };
    }

    return {
      status: stream.status?.streamStatus || "unknown",
      healthStatus: stream.status?.healthStatus?.status || "unknown"
    };
  } catch (error) {
    console.error("Failed to check stream status:", error);
    return { status: "error", healthStatus: "error" };
  }
}

/**
 * Transition a YouTube broadcast status
 * @param broadcastId - YouTube broadcast ID
 * @param status - Target status: "testing", "live", or "complete"
 * @throws Error if transition fails
 */
export async function transitionBroadcast(
  broadcastId: string,
  status: "testing" | "live" | "complete"
): Promise<void> {
  try {
    const youtube = await getYouTubeClient();
    await youtube.liveBroadcasts.transition({
      broadcastStatus: status,
      id: broadcastId,
      part: ["status"]
    });
  } catch (error) {
    console.error(`Failed to transition broadcast to ${status}:`, error);
    throw new Error(
      `Broadcast transition to ${status} failed: ${
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
export interface LarixUrlOptions {
  overlayUrl?: string;
  platform?: "ios" | "android";
  recordLocally?: boolean;
}

export function generateLarixUrl(
  ingestAddress: string,
  streamName: string,
  matchTitle: string,
  overlayUrl?: string,
  platform?: "ios" | "android",
  options?: LarixUrlOptions
): string {
  // Merge legacy positional args with options object
  const resolvedOverlayUrl = options?.overlayUrl ?? overlayUrl;
  const resolvedPlatform = options?.platform ?? platform;
  const recordLocally = options?.recordLocally ?? false;

  // Combine RTMP URL and stream key
  const rtmpUrl = `${ingestAddress}/${streamName}`;

  // Build Larix Grove deep link with URL query parameters
  // See: https://softvelum.com/larix/grove/
  const params = new URLSearchParams();
  params.append("conn[][url]", rtmpUrl);
  params.append("conn[][name]", matchTitle);
  params.append("enc[vid][res]", "1280x720");
  params.append("enc[vid][fps]", "30");
  params.append("enc[vid][bitrate]", "2500"); // Kbps
  params.append("enc[aud][bitrate]", "128");  // Kbps

  if (recordLocally) {
    params.append("enc[record][enabled]", "on");
  }

  if (resolvedOverlayUrl) {
    params.append("widget[][name]", "Scoreboard");
    params.append("widget[][url]", resolvedOverlayUrl);
    params.append("widget[][mode]", "s");
    params.append("widget[][overwrite]", "on");
    params.append("widget[][active]", "on");
    params.append("widget[][x]", "0.05");
    params.append("widget[][y]", "0.05");

    if (resolvedPlatform === "ios") {
      params.append("widget[][w]", "0.9");
      params.append("widget[][h]", "0.2");
    } else if (resolvedPlatform === "android") {
      params.append("widget[][w]", "900");
      params.append("widget[][h]", "180");
    }
  }

  return `larix://set/v1?${params.toString()}`;
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
        `${existingMatch.opponentName} Match`,
        undefined,
        undefined,
        { recordLocally: validated.recordLocally }
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
  let tournamentName: string | undefined;
  if (validated.tournamentId) {
    const tournament = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, validated.tournamentId))
      .limit(1);

    if (tournament.length === 0) {
      throw new Error("Tournament not found");
    }

    tournamentName = tournament[0].name;
  }
  if (!validated.tournamentId && validated.tournamentName) {
    tournamentName = validated.tournamentName;
  }

  let reservedStream: ReservedStreamData | null = null;

  try {
    // Step 1: Reserve stream from pool (without match ID to avoid FK constraint violation)
    reservedStream = await reserveStream();

    if (!reservedStream) {
      throw new NoStreamsAvailableError();
    }

    // Step 2: Create YouTube broadcast (external API - cannot be rolled back)
    // YouTube requires scheduledStartTime when binding to a stream, so default to 5 minutes from now
    const defaultScheduledStart = new Date(Date.now() + 5 * 60 * 1000);

    const broadcastDetails: BroadcastDetails = {
      title: buildYouTubeTitle({
        tournamentName,
        teamName: team[0].displayName,
        opponentName: validated.opponentName,
        matchDate: validated.scheduledStart
          ? new Date(validated.scheduledStart)
          : new Date()
      }),
      description: buildYouTubeDescription(validated.courtLabel),
      scheduledStart: validated.scheduledStart
        ? new Date(validated.scheduledStart)
        : defaultScheduledStart,
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
        tournamentName: validated.tournamentId ? null : validated.tournamentName,
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

    // Step 4: Update the stream reservation with the actual match ID now that match exists
    await updateStreamReservation(reservedStream.id, match.id);

    // Generate Larix URL
    const baseUrl = process.env.APP_BASE_URL;
    const overlayUrl = baseUrl
      ? `${baseUrl}/m/${match.id}/overlay?mode=larix`
      : undefined;
    const larixUrl = generateLarixUrl(
      reservedStream.ingestAddress,
      reservedStream.streamName,
      `${team[0].displayName} vs ${validated.opponentName}`,
      overlayUrl,
      undefined,
      { recordLocally: validated.recordLocally }
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

  // Delete YouTube broadcast if it exists
  if (match.youtubeBroadcastId) {
    try {
      const youtube = await getYouTubeClient();
      await youtube.liveBroadcasts.delete({
        id: match.youtubeBroadcastId
      });
    } catch (error) {
      // Log error but don't fail the cancellation
      console.error("Failed to delete YouTube broadcast:", error);
      // Continue with local cancellation even if YouTube API fails
    }
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
      previousStatus: match.status,
      broadcastDeleted: !!match.youtubeBroadcastId
    }
  });
}
