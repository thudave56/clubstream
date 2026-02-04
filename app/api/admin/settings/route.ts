import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { isAuthenticated } from "@/lib/session";
import { eq } from "drizzle-orm";

const updateSettingsSchema = z.object({
  requireCreatePin: z.boolean().optional()
});

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check authentication
    if (!await isAuthenticated()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get settings
    const settings = await db
      .select({
        requireCreatePin: adminSettings.requireCreatePin,
        oauthStatus: adminSettings.oauthStatus,
        channelId: adminSettings.channelId,
        hasAdminPin: adminSettings.adminPinHash,
        hasCreatePin: adminSettings.createPinHash
      })
      .from(adminSettings)
      .where(eq(adminSettings.id, 1))
      .limit(1);

    if (settings.length === 0) {
      return NextResponse.json(
        { error: "Settings not initialized" },
        { status: 500 }
      );
    }

    const result = settings[0];

    return NextResponse.json({
      requireCreatePin: result.requireCreatePin,
      oauthStatus: result.oauthStatus,
      channelId: result.channelId,
      hasAdminPin: !!result.hasAdminPin,
      hasCreatePin: !!result.hasCreatePin
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    if (!await isAuthenticated()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = updateSettingsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const updates = parseResult.data;

    // Update settings
    await db
      .update(adminSettings)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(adminSettings.id, 1));

    // Log settings change
    await db.insert(auditLog).values({
      action: "admin_settings_updated",
      detail: updates
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
