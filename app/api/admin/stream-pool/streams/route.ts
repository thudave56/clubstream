import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { streamPool } from "@/db/schema";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z
    .enum(["available", "reserved", "in_use", "stuck", "disabled"])
    .optional()
});

/**
 * GET /api/admin/stream-pool/streams
 * Optional query: ?status=stuck|disabled|...
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parse = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined
  });

  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const status = parse.data.status;

  const baseQuery = db
    .select({
      id: streamPool.id,
      youtubeStreamId: streamPool.youtubeStreamId,
      status: streamPool.status,
      reservedMatchId: streamPool.reservedMatchId,
      createdAt: streamPool.createdAt,
      updatedAt: streamPool.updatedAt
    })
    .from(streamPool);

  const rows = status
    ? await baseQuery
        .where(eq(streamPool.status, status))
        .orderBy(desc(streamPool.updatedAt))
    : await baseQuery.orderBy(desc(streamPool.updatedAt));

  return NextResponse.json({ streams: rows });
}
