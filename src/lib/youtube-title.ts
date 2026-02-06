const NYC_TIMEZONE = "America/New_York";

export interface YouTubeTitleContext {
  tournamentName?: string | null;
  teamName: string;
  opponentName: string;
  matchDate: Date;
}

export function formatMatchDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NYC_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function buildYouTubeTitle(context: YouTubeTitleContext): string {
  const tournament = context.tournamentName?.trim() || "Clubstream";
  const matchup = `${context.teamName} vs ${context.opponentName}`;
  const dateLabel = formatMatchDate(context.matchDate);
  return `${tournament}, ${matchup}, ${dateLabel}`;
}

export function buildYouTubeDescription(
  courtLabel?: string | null,
  customDescription?: string | null
): string | undefined {
  if (customDescription && customDescription.trim().length > 0) {
    return customDescription.trim();
  }
  if (courtLabel) {
    return `Court: ${courtLabel}`;
  }
  return undefined;
}
