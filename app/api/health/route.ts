import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus = "ok";

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "error";
  }

  const healthy = dbStatus === "ok";

  return Response.json(
    {
      ok: healthy,
      db: dbStatus,
      version: "0.2.0"
    },
    { status: healthy ? 200 : 503 }
  );
}
