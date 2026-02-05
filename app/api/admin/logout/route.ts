import { NextResponse } from "next/server";
import { getSessionToken, deleteSession, clearSessionCookie } from "@/lib/session";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function POST() {
  try {
    const token = getSessionToken();

    if (token) {
      await deleteSession(token);

      // Log logout
      await db.insert(auditLog).values({
        action: "admin_logout",
        detail: {}
      });
    }

    // Create response and clear cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete("admin_session");

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
