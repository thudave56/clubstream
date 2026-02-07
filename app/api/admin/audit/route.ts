import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        detail: auditLog.detail,
        createdAt: auditLog.createdAt
      })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(20);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Audit log error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
