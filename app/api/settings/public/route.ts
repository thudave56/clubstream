import { db } from "@/db";
import { adminSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/public
 * Returns public-facing settings (whether PIN is required for match creation)
 */
export async function GET() {
  const settings = await db
    .select({ requireCreatePin: adminSettings.requireCreatePin })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);

  return Response.json({
    requireCreatePin: settings[0]?.requireCreatePin ?? false
  });
}
