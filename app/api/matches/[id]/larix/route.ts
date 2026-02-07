import { db } from "@/db";
import { matches, teams, streamPool } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateLarixUrl } from "@/lib/match-creation";

export const dynamic = "force-dynamic";

/**
 * GET /api/matches/:id/larix
 * Returns the Larix deep link URL for a match
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;
  const url = new URL(request.url);
  const platformParam = url.searchParams.get("platform");
  const platform =
    platformParam === "ios" || platformParam === "android"
      ? platformParam
      : undefined;
  const requestBaseUrl = `${url.protocol}//${url.host}`;
  const envBaseUrl = process.env.APP_BASE_URL;
  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  const baseUrl = isLocalhost && envBaseUrl ? envBaseUrl : requestBaseUrl;

  // Load match with team info
  const matchRows = await db
    .select({
      id: matches.id,
      status: matches.status,
      streamPoolId: matches.streamPoolId,
      opponentName: matches.opponentName,
      teamDisplayName: teams.displayName
    })
    .from(matches)
    .innerJoin(teams, eq(matches.teamId, teams.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (matchRows.length === 0) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  const match = matchRows[0];

  // Stream has been released for ended/canceled matches
  if (["ended", "canceled"].includes(match.status)) {
    return Response.json(
      { error: "Match has ended, stream is no longer available" },
      { status: 410 }
    );
  }

  if (!match.streamPoolId) {
    return Response.json(
      { error: "No stream assigned to this match" },
      { status: 404 }
    );
  }

  // Get stream pool record
  const streamRows = await db
    .select()
    .from(streamPool)
    .where(eq(streamPool.id, match.streamPoolId))
    .limit(1);

  if (streamRows.length === 0) {
    return Response.json(
      { error: "Stream not found" },
      { status: 404 }
    );
  }

  const stream = streamRows[0];
  const matchTitle = `${match.teamDisplayName} vs ${match.opponentName}`;
  const overlayUrl = `${baseUrl}/m/${matchId}/overlay?mode=larix`;
  const larixUrl = generateLarixUrl(
    stream.ingestAddress,
    stream.streamName,
    matchTitle,
    overlayUrl,
    platform
  );

  return Response.json({ larixUrl, matchTitle });
}
