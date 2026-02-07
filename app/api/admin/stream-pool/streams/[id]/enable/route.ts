import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, streamPool } from "@/db/schema";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().uuid()
});

/**
 * POST /api/admin/stream-pool/streams/:id/enable
 * Marks a stream as available (from disabled) and clears reservedMatchId.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid stream id" },
      { status: 400 }
    );
  }

  const streamId = parse.data.id;

  const existing = await db
    .select({
      id: streamPool.id,
      status: streamPool.status,
      reservedMatchId: streamPool.reservedMatchId
    })
    .from(streamPool)
    .where(eq(streamPool.id, streamId))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const prev = existing[0];

  await db
    .update(streamPool)
    .set({
      status: "available",
      reservedMatchId: null,
      updatedAt: new Date()
    })
    .where(eq(streamPool.id, streamId));

  await db.insert(auditLog).values({
    action: "stream_pool_enabled",
    detail: {
      streamPoolId: streamId,
      previousStatus: prev.status,
      previousReservedMatchId: prev.reservedMatchId
    }
  });

  return NextResponse.json({ success: true });
}

