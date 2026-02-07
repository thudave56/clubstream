import { NextResponse } from "next/server";
import { google } from "googleapis";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptToken } from "@/lib/crypto";
import { getGoogleOAuthConfigOptional } from "@/lib/google-oauth-config";

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
      const cfg = getGoogleOAuthConfigOptional();
      const oauth2Client = cfg
        ? new google.auth.OAuth2(cfg.clientId, cfg.clientSecret)
        : null;

      try {
        if (oauth2Client) {
          await oauth2Client.revokeToken(decryptToken(refreshToken));
        } else {
          console.warn(
            "[oauth] Skipping token revocation: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set"
          );
        }
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
      {
        error: "Failed to disconnect OAuth",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
