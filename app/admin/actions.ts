"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { verifyPin } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { isRateLimited, recordAttempt, clearAttempts, getResetTime } from "@/lib/rate-limit";

const loginSchema = z.object({
  pin: z.string().min(4, "PIN must be at least 4 characters")
});

interface LoginResult {
  success?: boolean;
  error?: string;
  retryAfter?: number;
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  try {
    // Note: We can't get real IP in Server Actions, so we'll use a placeholder
    // In production, you'd want to use middleware or headers
    const ip = "server-action";

    // Check rate limit
    if (isRateLimited(ip)) {
      const resetTime = getResetTime(ip);

      await db.insert(auditLog).values({
        action: "admin_login_rate_limited",
        detail: { ip, resetTime }
      });

      return {
        error: `Too many attempts. Please try again in ${resetTime} seconds.`,
        retryAfter: resetTime
      };
    }

    // Get PIN from form data
    const pin = formData.get("pin");

    // Validate
    const parseResult = loginSchema.safeParse({ pin });

    if (!parseResult.success) {
      recordAttempt(ip);
      return { error: "Invalid PIN format" };
    }

    // Get admin settings
    const settings = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, 1))
      .limit(1);

    if (settings.length === 0 || !settings[0].adminPinHash) {
      await db.insert(auditLog).values({
        action: "admin_login_failed_no_pin_configured",
        detail: { ip }
      });

      return { error: "Admin PIN not configured" };
    }

    const adminPinHash = settings[0].adminPinHash;

    // Verify PIN
    if (!verifyPin(parseResult.data.pin, adminPinHash)) {
      recordAttempt(ip);

      await db.insert(auditLog).values({
        action: "admin_login_failed",
        detail: { ip }
      });

      return { error: "Invalid PIN" };
    }

    // Clear rate limit on successful login
    clearAttempts(ip);

    // Create session
    const sessionToken = await createSession();

    // Log successful login
    await db.insert(auditLog).values({
      action: "admin_login_success",
      detail: { ip }
    });

    // Set cookie using cookies() from next/headers
    cookies().set("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/"
    });

    // Server-side redirect
    redirect("/admin/dashboard");
  } catch (error) {
    // If error is from redirect(), re-throw it (redirect uses throw internally)
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Admin login error:", error);
    return { error: "Internal server error" };
  }
}
