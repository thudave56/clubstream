import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, teams } from "@/db/schema";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return s || "team";
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  // Try a bounded number of candidates to avoid infinite loops under concurrency.
  let candidate = baseSlug;
  for (let i = 0; i < 50; i++) {
    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${baseSlug}-${i + 2}`;
  }
  throw new Error("Failed to generate a unique slug");
}

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(teams)
      .orderBy(asc(teams.displayName));

    return NextResponse.json({ teams: rows });
  } catch (error) {
    console.error("Admin teams GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";
    const slugInput = typeof body.slug === "string" ? body.slug.trim() : "";

    if (!displayName) {
      return NextResponse.json(
        { error: "displayName is required" },
        { status: 400 }
      );
    }

    const baseSlug = slugify(slugInput || displayName);
    if (!isValidSlug(baseSlug)) {
      return NextResponse.json(
        { error: "slug must be lowercase and hyphenated (a-z, 0-9, -)" },
        { status: 400 }
      );
    }

    const slug = await ensureUniqueSlug(baseSlug);

    const inserted = await db
      .insert(teams)
      .values({ displayName, slug, enabled: true })
      .returning();

    const team = inserted[0];
    if (!team) throw new Error("Insert did not return a team row");

    await db.insert(auditLog).values({
      action: "team_created",
      detail: { teamId: team.id, slug: team.slug, displayName: team.displayName }
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error("Admin teams POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

