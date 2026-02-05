import { NextResponse } from "next/server";
import { google } from "googleapis";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/**
 * Disconnect YouTube OAuth
 * POST /api/admin/oauth/disconnect
 *
 * Requires admin authentication
 * Revokes OAuth tokens and clears stored credentials
 */
export async function POST() {
  // Check authentication
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch current settings
    const settings = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, 1))
      .limit(1);

    const refreshToken = settings[0]?.youtubeOauthRefreshToken;

    // Revoke token with Google if it exists
    if (refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      try {
        await oauth2Client.revokeToken(decryptToken(refreshToken));
      } catch (error) {
        console.error("Token revocation failed:", error);
        // Continue anyway to clear local data
      }
    }

    // Clear OAuth data
    await db
      .update(adminSettings)
      .set({
        youtubeOauthAccessToken: null,
        youtubeOauthRefreshToken: null,
        tokenExpiresAt: null,
        channelId: null,
        oauthStatus: "disconnected",
        updatedAt: new Date()
      })
      .where(eq(adminSettings.id, 1));

    // Log to audit
    await db.insert(auditLog).values({
      action: "youtube_oauth_disconnected",
      detail: {}
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("OAuth disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect OAuth" },
      { status: 500 }
    );
  }
}
