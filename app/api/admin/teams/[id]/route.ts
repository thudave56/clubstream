import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, teams } from "@/db/schema";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = params.id;
    const existing = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const current = existing[0];
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const displayNameRaw =
      typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const enabledRaw = typeof body.enabled === "boolean" ? body.enabled : undefined;

    if (displayNameRaw !== undefined && !displayNameRaw) {
      return NextResponse.json(
        { error: "displayName must not be empty" },
        { status: 400 }
      );
    }

    if (displayNameRaw === undefined && enabledRaw === undefined) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const nextDisplayName = displayNameRaw ?? current.displayName;
    const nextEnabled = enabledRaw ?? current.enabled;

    const updated = await db
      .update(teams)
      .set({ displayName: nextDisplayName, enabled: nextEnabled })
      .where(eq(teams.id, teamId))
      .returning();

    const team = updated[0];
    if (!team) throw new Error("Update did not return a team row");

    let action = "team_updated";
    if (current.enabled !== team.enabled) {
      action = team.enabled ? "team_enabled" : "team_disabled";
    }

    await db.insert(auditLog).values({
      action,
      detail: {
        teamId: team.id,
        slug: team.slug,
        before: { displayName: current.displayName, enabled: current.enabled },
        after: { displayName: team.displayName, enabled: team.enabled }
      }
    });

    return NextResponse.json({ team });
  } catch (error) {
    console.error("Admin teams PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

