import { NextResponse } from "next/server";
import { getSessionToken, deleteSession, clearSessionCookie } from "@/lib/session";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function POST() {
  try {
    const token = await getSessionToken();

    if (token) {
      await deleteSession(token);
      await clearSessionCookie();

      // Log logout
      await db.insert(auditLog).values({
        action: "admin_logout",
        detail: {}
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
