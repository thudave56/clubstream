import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyOAuthState, deleteOAuthState } from "@/lib/oauth";
import { encryptToken } from "@/lib/crypto";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getGoogleOAuthConfig } from "@/lib/google-oauth-config";

export const dynamic = "force-dynamic";

/**
 * Handle YouTube OAuth callback
 * GET /api/admin/oauth/callback?code=...&state=...
 *
 * Exchanges authorization code for tokens and fetches channel info
 * Redirects to dashboard with success/error query param
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = getAppBaseUrl();

  // Handle user denial
  if (error === "access_denied") {
    await db
      .update(adminSettings)
      .set({ oauthStatus: "disconnected" })
      .where(eq(adminSettings.id, 1));

    return NextResponse.redirect(
      new URL("/admin/dashboard?oauth=denied", baseUrl)
    );
  }

  // Validate parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/admin/dashboard?oauth=error", baseUrl)
    );
  }

  // Verify state (CSRF protection)
  if (!(await verifyOAuthState(state))) {
    return NextResponse.redirect(
      new URL("/admin/dashboard?oauth=error", baseUrl)
    );
  }

  // Delete state (one-time use)
  await deleteOAuthState(state);

  try {
    const { clientId, clientSecret } = getGoogleOAuthConfig();

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${baseUrl}/api/admin/oauth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch YouTube channel info
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const channelResponse = await youtube.channels.list({
      part: ["id"],
      mine: true
    });

    const channelId = channelResponse.data.items?.[0]?.id;

    if (!channelId) {
      throw new Error("No YouTube channel found for this account");
    }

    // Calculate token expiry
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default to 1 hour if not provided

    // Store encrypted tokens
    await db
      .update(adminSettings)
      .set({
        youtubeOauthAccessToken: encryptToken(tokens.access_token!),
        youtubeOauthRefreshToken: encryptToken(tokens.refresh_token!),
        tokenExpiresAt: expiresAt,
        channelId,
        oauthStatus: "connected",
        updatedAt: new Date()
      })
      .where(eq(adminSettings.id, 1));

    // Log to audit
    await db.insert(auditLog).values({
      action: "youtube_oauth_connected",
      detail: { channelId }
    });

    return NextResponse.redirect(
      new URL("/admin/dashboard?oauth=success", baseUrl)
    );
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Set error state
    await db
      .update(adminSettings)
      .set({ oauthStatus: "error" })
      .where(eq(adminSettings.id, 1));

    return NextResponse.redirect(
      new URL("/admin/dashboard?oauth=error", baseUrl)
    );
  }
}
