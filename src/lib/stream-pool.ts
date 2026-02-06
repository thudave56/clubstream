import { getYouTubeClient } from "./youtube-auth";
import { db } from "@/db";
import { streamPool } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Data returned when creating a YouTube stream
 */
export interface StreamData {
  streamId: string;
  ingestAddress: string;
  streamName: string;
}

/**
 * Result of initializing stream pool
 */
export interface InitResult {
  created: number;
  errors: any[];
}

/**
 * Stream pool status with counts
 */
export interface PoolStatus {
  available: number;
  reserved: number;
  in_use: number;
  stuck: number;
  disabled: number;
  total: number;
}

/**
 * Create a single YouTube live stream
 * @param title - Title for the stream (e.g., "ClubStream Pool #1")
 * @returns Stream data with ID and ingestion info
 * @throws Error if YouTube API call fails
 */
export async function createYouTubeStream(title: string): Promise<StreamData> {
  try {
    const youtube = await getYouTubeClient();

    const response = await youtube.liveStreams.insert({
      part: ["snippet", "cdn"],
      requestBody: {
        snippet: {
          title
        },
        cdn: {
          frameRate: "30fps",
          ingestionType: "rtmp",
          resolution: "720p"
        }
      }
    });

    const streamId = response.data.id;
    const ingestionInfo = response.data.cdn?.ingestionInfo;

    if (!streamId || !ingestionInfo?.ingestionAddress || !ingestionInfo?.streamName) {
      throw new Error("Invalid response from YouTube API - missing required fields");
    }

    return {
      streamId,
      ingestAddress: ingestionInfo.ingestionAddress,
      streamName: ingestionInfo.streamName
    };
  } catch (error) {
    console.error("Failed to create YouTube stream:", error);
    throw error;
  }
}

/**
 * Initialize stream pool by creating multiple YouTube streams
 * @param count - Number of streams to create (1-20)
 * @returns Result with count of created streams and any errors
 */
export async function initializeStreamPool(count: number): Promise<InitResult> {
  if (count < 1 || count > 20) {
    throw new Error("Count must be between 1 and 20");
  }

  const created: number[] = [];
  const errors: any[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const title = `ClubStream Pool #${Date.now()}-${i + 1}`;
      const streamData = await createYouTubeStream(title);

      // Insert into database
      await db.insert(streamPool).values({
        youtubeStreamId: streamData.streamId,
        ingestAddress: streamData.ingestAddress,
        streamName: streamData.streamName,
        status: "available",
        updatedAt: new Date()
      });

      created.push(i);
    } catch (error) {
      console.error(`Failed to create stream ${i + 1}:`, error);
      errors.push({ index: i + 1, error });
    }
  }

  return {
    created: created.length,
    errors
  };
}

/**
 * Get current stream pool status with counts by state
 * @returns Pool status with counts for each state
 */
export async function getPoolStatus(): Promise<PoolStatus> {
  const streams = await db.select().from(streamPool);

  const status: PoolStatus = {
    available: 0,
    reserved: 0,
    in_use: 0,
    stuck: 0,
    disabled: 0,
    total: streams.length
  };

  for (const stream of streams) {
    if (stream.status === "available") status.available++;
    else if (stream.status === "reserved") status.reserved++;
    else if (stream.status === "in_use") status.in_use++;
    else if (stream.status === "stuck") status.stuck++;
    else if (stream.status === "disabled") status.disabled++;
  }

  return status;
}

/**
 * Reserve an available stream for a match
 * @param matchId - UUID of the match reserving the stream
 * @returns Stream data if reservation successful, null if no streams available
 */
export async function reserveStream(matchId: string): Promise<StreamData | null> {
  // Find first available stream
  const availableStreams = await db
    .select()
    .from(streamPool)
    .where(eq(streamPool.status, "available"))
    .limit(1);

  if (availableStreams.length === 0) {
    return null;
  }

  const stream = availableStreams[0];

  // Update to reserved status
  await db
    .update(streamPool)
    .set({
      status: "reserved",
      reservedMatchId: matchId,
      updatedAt: new Date()
    })
    .where(eq(streamPool.id, stream.id));

  return {
    streamId: stream.youtubeStreamId,
    ingestAddress: stream.ingestAddress,
    streamName: stream.streamName
  };
}

/**
 * Release a stream back to the available pool
 * @param streamId - YouTube stream ID to release
 */
export async function releaseStream(streamId: string): Promise<void> {
  await db
    .update(streamPool)
    .set({
      status: "available",
      reservedMatchId: null,
      updatedAt: new Date()
    })
    .where(eq(streamPool.youtubeStreamId, streamId));
}
