"use client";

import { useState, useEffect } from "react";
import EnhancedMatchCard from "./EnhancedMatchCard";
import { TimeUpdateProvider } from "../contexts/TimeUpdateContext";

interface Match {
  id: string;
  teamId: string;
  teamDisplayName: string;
  opponentName: string;
  tournamentName: string | null;
  courtLabel: string | null;
  status: string;
  scheduledStart: string | null;
  youtubeWatchUrl: string | null;
  createdAt: string;
  currentSetNumber?: number;
  currentSetHomeScore?: number;
  currentSetAwayScore?: number;
}

export default function TodayMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "upcoming" | "ended">("all");

  const loadMatches = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/matches?date=${today}`);
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // Silently fail; retry on the next poll cycle.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
    const interval = setInterval(loadMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleEndMatch = async (matchId: string) => {
    if (!confirm("Are you sure you want to end this match?")) return;
    try {
      const res = await fetch(`/api/matches/${matchId}/end`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to end match");
      loadMatches();
    } catch {
      // Retry on next poll
    }
  };

  const filteredMatches = matches.filter((match) => {
    if (filter === "all") return true;
    if (filter === "live") return match.status === "live";
    if (filter === "ended") return match.status === "ended";
    return ["draft", "scheduled", "ready"].includes(match.status);
  });

  return (
    <TimeUpdateProvider>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Today&apos;s Matches</h2>
            {!loading && (
              <p className="mt-1 text-xs text-slate-500">
                Showing {filteredMatches.length} of {matches.length}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All" },
              { key: "live", label: "Live" },
              { key: "upcoming", label: "Upcoming" },
              { key: "ended", label: "Ended" }
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as typeof filter)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === key
                    ? "border-blue-600 bg-blue-600/20 text-blue-300"
                    : "border-slate-700 text-slate-400 hover:bg-slate-900/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading...</p>
        ) : filteredMatches.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No matches found for this filter.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredMatches.map((match) => (
              <EnhancedMatchCard
                key={match.id}
                match={match}
                onEndMatch={handleEndMatch}
              />
            ))}
          </div>
        )}
      </section>
    </TimeUpdateProvider>
  );
}
