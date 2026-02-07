"use client";

import { useState, useEffect } from "react";
import { StatusBadge } from "./StatusBadge";

interface Match {
  id: string;
  teamId: string;
  opponentName: string;
  courtLabel: string | null;
  status: string;
  scheduledStart: string | null;
  youtubeWatchUrl: string | null;
  createdAt: string;
}

export default function TodayMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<string>("");
  const [copiedMatchId, setCopiedMatchId] = useState<string | null>(null);

  const loadMatches = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/matches?date=${today}`);
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // Silently fail — will retry
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOrigin(window.location.origin);
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  };

  const handleCopyMatchLink = async (matchId: string) => {
    if (!origin) return;
    try {
      await navigator.clipboard.writeText(`${origin}/m/${matchId}`);
      setCopiedMatchId(matchId);
      setTimeout(() => setCopiedMatchId(null), 2000);
    } catch {
      // Ignore
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold">Today&apos;s Matches</h2>
        <p className="mt-4 text-sm text-slate-400">Loading...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold">Today&apos;s Matches</h2>

      {matches.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No matches scheduled for today.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {matches.map((match) => {
            const isPreLive = ["draft", "scheduled", "ready"].includes(match.status);

            return (
              <div
                key={match.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 p-4 transition-colors hover:border-slate-700 hover:bg-slate-900/60"
              >
                <a href={`/m/${match.id}`} className="flex-1">
                  <div className="font-medium">{match.opponentName}</div>
                  <div className="text-sm text-slate-400">
                    {match.courtLabel && `Court: ${match.courtLabel}`}
                    {match.courtLabel && match.scheduledStart && " · "}
                    {match.scheduledStart && formatTime(match.scheduledStart)}
                  </div>
                </a>

                <div className="flex items-center gap-3">
                  {isPreLive && (
                    <a
                      href={`/m/${match.id}/stream`}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Start Streaming
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyMatchLink(match.id);
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-900"
                  >
                    {copiedMatchId === match.id ? "Link Copied" : "Copy Link"}
                  </button>
                  {match.status === "live" && (
                    <button
                      onClick={() => handleEndMatch(match.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      End Match
                    </button>
                  )}
                  <StatusBadge status={match.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
