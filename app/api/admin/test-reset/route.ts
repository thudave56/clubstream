import { NextResponse } from "next/server";
import { resetAllAttempts } from "@/lib/rate-limit";

/**
 * Test-only endpoint to reset rate limiter
 * Only available in non-production environments
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  resetAllAttempts();

  return NextResponse.json({ success: true });
}
