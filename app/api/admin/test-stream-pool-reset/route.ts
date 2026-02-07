import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { streamPool } from "@/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    count: z.number().int().min(1).max(20).optional()
  })
  .optional();

/**
 * Test-only endpoint to reset the stream pool to a known-good state.
 *
 * This exists to keep E2E/regression runs deterministic without relying on
 * external YouTube APIs or leftover pool state from previous tests.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.errors },
      { status: 400 }
    );
  }

  const count = parsed.data?.count ?? 5;

  try {
    // Wipe the table so every run starts from the same state.
    await db.delete(streamPool);

    const now = new Date();
    await db.insert(streamPool).values(
      Array.from({ length: count }, (_, i) => ({
        youtubeStreamId: `test-stream-${i + 1}`,
        ingestAddress: "rtmp://test.youtube.com/ingress",
        streamName: `test-key-${i + 1}`,
        status: "available" as const,
        updatedAt: now
      }))
    );

    return NextResponse.json({ success: true, created: count });
  } catch (error) {
    console.error("Test stream pool reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset stream pool" },
      { status: 500 }
    );
  }
}

