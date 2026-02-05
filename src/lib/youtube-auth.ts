import { google, youtube_v3 } from "googleapis";
import { db } from "@/db";
import { adminSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, decryptToken } from "./crypto";

/**
 * Get a valid YouTube API access token, refreshing if necessary
 * @returns Valid access token
 * @throws Error if OAuth not connected or refresh fails
 */
export async function getValidAccessToken(): Promise<string> {
  const settings = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);

  if (!settings[0] || settings[0].oauthStatus !== "connected") {
    throw new Error("YouTube OAuth not connected");
  }

  const {
    youtubeOauthAccessToken,
    youtubeOauthRefreshToken,
    tokenExpiresAt
  } = settings[0];

  if (!youtubeOauthAccessToken || !youtubeOauthRefreshToken) {
    throw new Error("OAuth tokens not found");
  }

  // Check if token is expired or expiring soon (5 minutes buffer)
  const now = new Date();
  const expiryBuffer = new Date(now.getTime() + 5 * 60 * 1000);

  if (!tokenExpiresAt || tokenExpiresAt < expiryBuffer) {
    // Token expired or expiring soon - refresh it
    return await refreshAccessToken(decryptToken(youtubeOauthRefreshToken));
  }

  // Token is still valid
  return decryptToken(youtubeOauthAccessToken);
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - Decrypted refresh token
 * @returns New access token
 * @throws Error if refresh fails
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const { access_token, expiry_date } = credentials;

    if (!access_token) {
      throw new Error("No access token received from refresh");
    }

    // Calculate expiry (use expiry_date if provided, otherwise default to 1 hour)
    const expiresAt = expiry_date
      ? new Date(expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Update database with new access token
    await db
      .update(adminSettings)
      .set({
        youtubeOauthAccessToken: encryptToken(access_token),
        tokenExpiresAt: expiresAt,
        updatedAt: new Date()
      })
      .where(eq(adminSettings.id, 1));

    return access_token;
  } catch (error) {
    console.error("Token refresh failed:", error);

    // Mark as error state
    await db
      .update(adminSettings)
      .set({ oauthStatus: "error" })
      .where(eq(adminSettings.id, 1));

    throw new Error("Failed to refresh access token");
  }
}

/**
 * Get authenticated YouTube API v3 client
 * @returns YouTube API client configured with valid access token
 * @throws Error if OAuth not connected or token refresh fails
 */
export async function getYouTubeClient(): Promise<youtube_v3.Youtube> {
  const accessToken = await getValidAccessToken();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.youtube({ version: "v3", auth: oauth2Client });
}
