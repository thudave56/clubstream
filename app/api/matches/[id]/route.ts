import { db } from "@/db";
import { matches, teams, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getYouTubeClient } from "@/lib/youtube-auth";
import { buildYouTubeDescription, buildYouTubeTitle } from "@/lib/youtube-title";
import { validateRules } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/**
 * GET /api/matches/:id
 * Returns public match details (no sensitive fields)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;

  const rows = await db
    .select({
      id: matches.id,
      teamId: matches.teamId,
      teamDisplayName: teams.displayName,
      opponentName: matches.opponentName,
      tournamentId: matches.tournamentId,
      tournamentName: matches.tournamentName,
      tournamentDisplayName: tournaments.name,
      scheduledStart: matches.scheduledStart,
      courtLabel: matches.courtLabel,
      status: matches.status,
      youtubeWatchUrl: matches.youtubeWatchUrl,
      youtubeTitleOverride: matches.youtubeTitleOverride,
      youtubeDescriptionOverride: matches.youtubeDescriptionOverride,
      createdAt: matches.createdAt
    })
    .from(matches)
    .innerJoin(teams, eq(matches.teamId, teams.id))
    .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  return Response.json({ match: rows[0] });
}

const updateMetadataSchema = z.object({
  youtubeTitleOverride: z.string().max(140).nullable().optional(),
  youtubeDescriptionOverride: z.string().max(5000).nullable().optional(),
  rulesBestOf: z.number().int().min(1).max(7).optional(),
  rulesPointsToWin: z.number().int().min(1).max(99).optional(),
  rulesFinalSetPoints: z.number().int().min(1).max(99).optional(),
  rulesWinBy: z.number().int().min(1).max(10).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;
  const body = await request.json();
  const parsed = updateMetadataSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.errors },
      { status: 400 }
    );
  }

  const {
    youtubeTitleOverride,
    youtubeDescriptionOverride,
    rulesBestOf,
    rulesPointsToWin,
    rulesFinalSetPoints,
    rulesWinBy
  } = parsed.data;

  const matchRows = await db
    .select({
      id: matches.id,
      teamDisplayName: teams.displayName,
      opponentName: matches.opponentName,
      tournamentName: matches.tournamentName,
      tournamentDisplayName: tournaments.name,
      scheduledStart: matches.scheduledStart,
      createdAt: matches.createdAt,
      courtLabel: matches.courtLabel,
      youtubeBroadcastId: matches.youtubeBroadcastId,
      rulesBestOf: matches.rulesBestOf,
      rulesPointsToWin: matches.rulesPointsToWin,
      rulesFinalSetPoints: matches.rulesFinalSetPoints,
      rulesWinBy: matches.rulesWinBy
    })
    .from(matches)
    .innerJoin(teams, eq(matches.teamId, teams.id))
    .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (matchRows.length === 0) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  const match = matchRows[0];
  const tournamentName = match.tournamentDisplayName || match.tournamentName;
  const matchDate = match.scheduledStart ?? match.createdAt;

  const normalizedTitle =
    typeof youtubeTitleOverride === "string"
      ? youtubeTitleOverride.trim().length > 0
        ? youtubeTitleOverride.trim()
        : null
      : undefined;
  const normalizedDescription =
    typeof youtubeDescriptionOverride === "string"
      ? youtubeDescriptionOverride.trim().length > 0
        ? youtubeDescriptionOverride.trim()
        : null
      : undefined;

  const nextRules = {
    bestOf: rulesBestOf ?? match.rulesBestOf,
    pointsToWin: rulesPointsToWin ?? match.rulesPointsToWin,
    finalSetPoints: rulesFinalSetPoints ?? match.rulesFinalSetPoints,
    winBy: rulesWinBy ?? match.rulesWinBy
  };
  const rulesError = validateRules(nextRules);
  if (rulesError) {
    return Response.json({ error: rulesError }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {
    rulesBestOf: nextRules.bestOf,
    rulesPointsToWin: nextRules.pointsToWin,
    rulesFinalSetPoints: nextRules.finalSetPoints,
    rulesWinBy: nextRules.winBy,
    updatedAt: new Date()
  };

  if (normalizedTitle !== undefined) {
    updatePayload.youtubeTitleOverride = normalizedTitle;
  }
  if (normalizedDescription !== undefined) {
    updatePayload.youtubeDescriptionOverride = normalizedDescription;
  }

  await db.update(matches).set(updatePayload).where(eq(matches.id, matchId));

  let youtubeUpdated = false;
  let youtubeError: string | undefined;

  const shouldUpdateYouTube =
    normalizedTitle !== undefined || normalizedDescription !== undefined;

  if (match.youtubeBroadcastId && shouldUpdateYouTube) {
    try {
      const youtube = await getYouTubeClient();
      const titleToUse =
        normalizedTitle !== undefined && normalizedTitle
          ? normalizedTitle
          : buildYouTubeTitle({
              tournamentName,
              teamName: match.teamDisplayName,
              opponentName: match.opponentName,
              matchDate
            });
      const descriptionToUse = buildYouTubeDescription(
        match.courtLabel,
        normalizedDescription ?? null
      );

      await youtube.liveBroadcasts.update({
        part: ["snippet"],
        requestBody: {
          id: match.youtubeBroadcastId,
          snippet: {
            title: titleToUse,
            description: descriptionToUse || ""
          }
        }
      });

      youtubeUpdated = true;
    } catch (error) {
      console.error("Failed to update YouTube metadata:", error);
      youtubeError =
        error instanceof Error ? error.message : "Failed to update YouTube";
    }
  }

  return Response.json({
    success: true,
    youtubeUpdated,
    youtubeError
  });
}
