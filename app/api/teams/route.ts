import { asc } from "drizzle-orm";

import { db } from "@/db";
import { teams } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(teams).orderBy(asc(teams.name));

  return Response.json({ teams: rows });
}
