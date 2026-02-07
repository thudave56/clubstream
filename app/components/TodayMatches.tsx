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

  return (
    <TimeUpdateProvider>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold">Today&apos;s Matches</h2>

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading...</p>
        ) : matches.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No matches scheduled for today.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {matches.map((match) => (
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
