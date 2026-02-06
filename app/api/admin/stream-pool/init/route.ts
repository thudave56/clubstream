import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/session";
import { initializeStreamPool } from "@/lib/stream-pool";
import { db } from "@/db";
import { adminSettings, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

const initSchema = z.object({
  count: z.number().int().min(1).max(20)
});

/**
 * Initialize stream pool by creating YouTube live streams
 * POST /api/admin/stream-pool/init
 */
export async function POST(request: Request) {
  // Validate admin session
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = initSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { count } = validation.data;

    // Check OAuth status
    const settings = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, 1))
      .limit(1);

    if (!settings[0] || settings[0].oauthStatus !== "connected") {
      return NextResponse.json(
        { error: "YouTube OAuth not connected" },
        { status: 400 }
      );
    }

    // Initialize stream pool
    const result = await initializeStreamPool(count);

    // Log to audit
    await db.insert(auditLog).values({
      action: "stream_pool_initialized",
      detail: {
        count,
        created: result.created,
        errors: result.errors.length
      }
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      errors: result.errors
    });
  } catch (error) {
    console.error("Stream pool initialization error:", error);

    return NextResponse.json(
      {
        error: "Failed to initialize stream pool",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
