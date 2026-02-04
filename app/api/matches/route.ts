import { and, gte, lt } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches } from "@/db/schema";

const querySchema = z
  .object({
    date: z.string().optional()
  })
  .refine(
    (data) => !data.date || /^\d{4}-\d{2}-\d{2}$/.test(data.date),
    "date must be YYYY-MM-DD"
  );

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parseResult = querySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined
  });

  if (!parseResult.success) {
    return Response.json({ error: "Invalid date format." }, { status: 400 });
  }

  if (parseResult.data.date) {
    const start = new Date(`${parseResult.data.date}T00:00:00.000Z`);
    const end = new Date(`${parseResult.data.date}T23:59:59.999Z`);
    const rows = await db
      .select()
      .from(matches)
      .where(and(gte(matches.scheduledAt, start), lt(matches.scheduledAt, end)));

    return Response.json({ matches: rows });
  }

  const rows = await db.select().from(matches);
  return Response.json({ matches: rows });
}
