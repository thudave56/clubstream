import { NextResponse } from "next/server";
import { google } from "googleapis";
import { isAuthenticated } from "@/lib/session";
import { generateOAuthState, storeOAuthState } from "@/lib/oauth";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Initiate YouTube OAuth flow
 * GET /api/admin/oauth/connect
 *
 * Requires admin authentication
 * Returns authorization URL for user to complete OAuth flow
 */
export async function GET() {
  // Check authentication
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Update status to "connecting"
    await db
      .update(adminSettings)
      .set({ oauthStatus: "connecting" })
      .where(eq(adminSettings.id, 1));

    // Generate and store state for CSRF protection
    const state = generateOAuthState();
    await storeOAuthState(state);

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_BASE_URL}/api/admin/oauth/callback`
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/youtube.force-ssl"],
      state,
      prompt: "consent"
    });

    // Log to audit
    await db.insert(auditLog).values({
      action: "youtube_oauth_connect_initiated",
      detail: {}
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
