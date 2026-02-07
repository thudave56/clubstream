import { notFound } from "next/navigation";
import { db } from "@/db";
import { matches, teams, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { StatusBadge } from "../../components/StatusBadge";
import MatchDetailClient from "./MatchDetailClient";
import { buildYouTubeDescription, buildYouTubeTitle } from "@/lib/youtube-title";

interface MatchPageProps {
  params: { id: string };
}

async function getMatch(id: string) {
  const rows = await db
    .select({
      id: matches.id,
      teamDisplayName: teams.displayName,
      opponentName: matches.opponentName,
      tournamentName: matches.tournamentName,
      tournamentDisplayName: tournaments.name,
      scheduledStart: matches.scheduledStart,
      courtLabel: matches.courtLabel,
      status: matches.status,
      youtubeWatchUrl: matches.youtubeWatchUrl,
      youtubeTitleOverride: matches.youtubeTitleOverride,
      youtubeDescriptionOverride: matches.youtubeDescriptionOverride,
      rulesBestOf: matches.rulesBestOf,
      rulesPointsToWin: matches.rulesPointsToWin,
      rulesFinalSetPoints: matches.rulesFinalSetPoints,
      rulesWinBy: matches.rulesWinBy,
      createdAt: matches.createdAt
    })
    .from(matches)
    .innerJoin(teams, eq(matches.teamId, teams.id))
    .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(eq(matches.id, id))
    .limit(1);

  return rows[0] || null;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const match = await getMatch(params.id);

  if (!match) {
    notFound();
  }

  const tournamentName = match.tournamentDisplayName || match.tournamentName || null;
  const matchTitle = `${match.teamDisplayName} vs ${match.opponentName}`;
  const matchDate = match.scheduledStart ?? match.createdAt;
  const defaultTitle = buildYouTubeTitle({
    tournamentName,
    teamName: match.teamDisplayName,
    opponentName: match.opponentName,
    matchDate
  });
  const defaultDescription = buildYouTubeDescription(match.courtLabel);
  const isPreLive = ["draft", "scheduled", "ready"].includes(match.status);

  return (
    <main className="space-y-6">
      <a className="text-sm text-slate-400 hover:text-slate-300" href="/">
        &larr; Back to matches
      </a>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{matchTitle}</h1>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          {match.courtLabel && <span>Court: {match.courtLabel}</span>}
          {match.scheduledStart && (
            <span>
              {new Date(match.scheduledStart).toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric"
              })}{" "}
              at{" "}
              {new Date(match.scheduledStart).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
              })}
            </span>
          )}
          <StatusBadge status={match.status} />
        </div>
      </div>

      <MatchDetailClient
        matchId={match.id}
        status={match.status}
        youtubeWatchUrl={match.youtubeWatchUrl}
        isPreLive={isPreLive}
        tournamentName={tournamentName}
        defaultTitle={defaultTitle}
        defaultDescription={defaultDescription || ""}
        youtubeTitleOverride={match.youtubeTitleOverride || ""}
        youtubeDescriptionOverride={match.youtubeDescriptionOverride || ""}
        rules={{
          bestOf: match.rulesBestOf,
          pointsToWin: match.rulesPointsToWin,
          finalSetPoints: match.rulesFinalSetPoints,
          winBy: match.rulesWinBy
        }}
      />

      {/* Action buttons */}
      <div className="grid gap-3 sm:grid-cols-2">
        {isPreLive && (
          <a
            href={`/m/${match.id}/stream`}
            className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            Open Larix Launcher
          </a>
        )}

        {match.youtubeWatchUrl && (
          <a
            href={match.youtubeWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Watch on YouTube
          </a>
        )}
      </div>

    </main>
  );
}
