import { NextResponse } from "next/server";
import { db } from "@/db";
import { streamPool } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Test-only endpoint to populate stream pool with mock data
 * Only available in non-production environments
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  try {
    // Clear existing test streams first (to avoid unique constraint violations)
    await db
      .delete(streamPool)
      .where(eq(streamPool.youtubeStreamId, "test-stream-1"));
    await db
      .delete(streamPool)
      .where(eq(streamPool.youtubeStreamId, "test-stream-2"));
    await db
      .delete(streamPool)
      .where(eq(streamPool.youtubeStreamId, "test-stream-3"));

    // Insert 3 mock streams into pool
    await db.insert(streamPool).values([
      {
        youtubeStreamId: "test-stream-1",
        ingestAddress: "rtmp://test.youtube.com/ingress",
        streamName: "test-key-1",
        status: "available",
        updatedAt: new Date()
      },
      {
        youtubeStreamId: "test-stream-2",
        ingestAddress: "rtmp://test.youtube.com/ingress",
        streamName: "test-key-2",
        status: "reserved",
        reservedMatchId: null, // Will be set by tests
        updatedAt: new Date()
      },
      {
        youtubeStreamId: "test-stream-3",
        ingestAddress: "rtmp://test.youtube.com/ingress",
        streamName: "test-key-3",
        status: "in_use",
        updatedAt: new Date()
      }
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Test stream pool creation error:", error);

    return NextResponse.json(
      {
        error: "Failed to create test streams",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
