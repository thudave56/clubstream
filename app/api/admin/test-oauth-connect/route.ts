import { NextResponse } from "next/server";
import { db } from "@/db";
import { adminSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/**
 * Test-only endpoint to simulate successful OAuth connection
 * POST /api/admin/test-oauth-connect
 *
 * Only available in non-production environments
 * Sets mock OAuth tokens and channel ID for testing
 */
export async function POST() {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    await db
      .update(adminSettings)
      .set({
        youtubeOauthAccessToken: encryptToken("test-access-token"),
        youtubeOauthRefreshToken: encryptToken("test-refresh-token"),
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        channelId: "UC_test_channel_id_12345",
        oauthStatus: "connected",
        updatedAt: new Date()
      })
      .where(eq(adminSettings.id, 1));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Test OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to set test OAuth state" },
      { status: 500 }
    );
  }
}
