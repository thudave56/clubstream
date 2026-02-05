import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { verifyPin } from "@/lib/auth";
import { createSession } from "@/lib/session";

const loginSchema = z.object({
  pin: z.string().min(4, "PIN must be at least 4 characters")
});

/**
 * Test-only login endpoint that returns the session token in the response body
 * This helps with Playwright testing in CI where Set-Cookie headers don't work reliably
 */
export async function POST(request: NextRequest) {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid PIN format" },
        { status: 400 }
      );
    }

    const { pin } = parseResult.data;

    const settings = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, 1))
      .limit(1);

    if (settings.length === 0 || !settings[0].adminPinHash) {
      return NextResponse.json(
        { error: "Admin PIN not configured" },
        { status: 500 }
      );
    }

    const adminPinHash = settings[0].adminPinHash;

    if (!verifyPin(pin, adminPinHash)) {
      return NextResponse.json(
        { error: "Invalid PIN" },
        { status: 401 }
      );
    }

    const sessionToken = await createSession();

    await db.insert(auditLog).values({
      action: "admin_test_login_success",
      detail: { test: true }
    });

    // Return token in body for manual cookie injection
    return NextResponse.json({
      success: true,
      sessionToken
    });
  } catch (error) {
    console.error("Admin test login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
