import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { teams } from "@/db/schema";

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db.select().from(teams).where(eq(teams.enabled, true)).orderBy(asc(teams.displayName));

  return Response.json({ teams: rows });
}
