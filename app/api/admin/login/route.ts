import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { verifyPin } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/session";
import { isRateLimited, recordAttempt, clearAttempts, getResetTime } from "@/lib/rate-limit";

const loginSchema = z.object({
  pin: z.string().min(4, "PIN must be at least 4 characters")
});

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // Check rate limit
    if (isRateLimited(ip)) {
      const resetTime = getResetTime(ip);

      // Log failed attempt
      await db.insert(auditLog).values({
        action: "admin_login_rate_limited",
        detail: { ip, resetTime }
      });

      return NextResponse.json(
        {
          error: "Too many login attempts",
          retryAfter: resetTime
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      recordAttempt(ip);
      return NextResponse.json(
        { error: "Invalid PIN format" },
        { status: 400 }
      );
    }

    const { pin } = parseResult.data;

    // Get admin settings
    const settings = await db
      .select()
      .from(adminSettings)
      .where((adminSettings.id as any).$eq(1))
      .limit(1);

    if (settings.length === 0 || !settings[0].adminPinHash) {
      // Log missing configuration
      await db.insert(auditLog).values({
        action: "admin_login_failed_no_pin_configured",
        detail: { ip }
      });

      return NextResponse.json(
        { error: "Admin PIN not configured" },
        { status: 500 }
      );
    }

    const adminPinHash = settings[0].adminPinHash;

    // Verify PIN
    if (!verifyPin(pin, adminPinHash)) {
      recordAttempt(ip);

      // Log failed login
      await db.insert(auditLog).values({
        action: "admin_login_failed",
        detail: { ip }
      });

      return NextResponse.json(
        { error: "Invalid PIN" },
        { status: 401 }
      );
    }

    // Clear rate limit on successful login
    clearAttempts(ip);

    // Create session
    const sessionToken = await createSession();
    setSessionCookie(sessionToken);

    // Log successful login
    await db.insert(auditLog).values({
      action: "admin_login_success",
      detail: { ip }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
