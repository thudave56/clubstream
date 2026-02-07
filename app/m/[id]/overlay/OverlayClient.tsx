"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface MatchInfo {
  id: string;
  teamDisplayName: string;
  opponentName: string;
  tournamentName: string | null;
  status: string;
}

interface MatchRules {
  bestOf: number;
  pointsToWin: number;
  finalSetPoints: number;
  winBy: number;
}

interface SetResult {
  setNumber: number;
  homeScore: number;
  awayScore: number;
  targetPoints: number;
  complete: boolean;
}

interface MatchState {
  sets: SetResult[];
  currentSetNumber: number;
  homeSetsWon: number;
  awaySetsWon: number;
  matchComplete: boolean;
}

interface ScoreResponse {
  match: MatchInfo;
  rules: MatchRules;
  state: MatchState;
}

interface OverlayClientProps {
  matchId: string;
  transparent?: boolean;
  autoLive?: boolean;
}

const PRE_LIVE_STATUSES = ["draft", "scheduled", "ready"];

export default function OverlayClient({
  matchId,
  transparent = false,
  autoLive = false
}: OverlayClientProps) {
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoLiveTriggered = useRef(false);

  useEffect(() => {
    const original = document.body.style.backgroundColor;
    if (transparent) {
      document.body.style.backgroundColor = "transparent";
    }
    return () => {
      document.body.style.backgroundColor = original;
    };
  }, [transparent]);

  const fetchScore = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/score`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load");
      }
      const payload = (await res.json()) as ScoreResponse;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [matchId]);

  // TODO: Replace polling with Server-Sent Events (SSE) or WebSockets.
  // The overlay polls every 2s which is the most latency-sensitive consumer
  // (viewers see stale scores on the stream). An SSE connection would deliver
  // sub-second updates. Also stop polling when matchComplete is true, since
  // the overlay continues fetching indefinitely after the match ends.
  useEffect(() => {
    fetchScore();
    const interval = setInterval(fetchScore, 2000);
    return () => clearInterval(interval);
  }, [fetchScore]);

  // When running inside Larix (autoLive=true), poll the auto-live endpoint
  // to transition the broadcast to live once YouTube detects the RTMP stream.
  // This avoids relying on the browser tab (which iOS suspends in background).
  // Polling stops permanently once the match goes live.
  useEffect(() => {
    if (!autoLive || autoLiveTriggered.current) return;

    const matchStatus = data?.match?.status;
    if (!matchStatus) return;

    // Already live or finished — nothing to do
    if (!PRE_LIVE_STATUSES.includes(matchStatus)) {
      autoLiveTriggered.current = true;
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/auto-live`, {
          method: "POST"
        });
        const result = await res.json();
        if (result.status === "live" || result.status === "already_live") {
          autoLiveTriggered.current = true;
        }
      } catch {
        // Silently retry on network errors
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [autoLive, matchId, data?.match?.status]);

  const currentSet = useMemo(() => {
    if (!data) return null;
    return (
      data.state.sets.find((set) => set.setNumber === data.state.currentSetNumber) || {
        setNumber: data.state.currentSetNumber,
        homeScore: 0,
        awayScore: 0,
        targetPoints:
          data.state.currentSetNumber === data.rules.bestOf
            ? data.rules.finalSetPoints
            : data.rules.pointsToWin,
        complete: false
      }
    );
  }, [data]);

  if (!data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
          {error || "Loading overlay..."}
        </div>
      </div>
    );
  }

  const { match, rules, state } = data;
  const set = currentSet;

  return (
    <div className="fixed inset-0 flex items-start justify-start p-4">
      <div
        className={`rounded-2xl border border-white/10 px-4 py-3 text-white shadow-xl ${
          transparent ? "bg-black/70" : "bg-slate-900/95"
        }`}
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-200">
          <span>{match.tournamentName || "Clubstream"}</span>
          <span>
            Set {state.currentSetNumber} / {rules.bestOf}
          </span>
        </div>

        <div className="mt-3 grid gap-2">
          <div className="flex items-center justify-between gap-6 text-lg font-semibold">
            <span className="truncate">{match.teamDisplayName}</span>
            <span className="text-2xl text-blue-300">{set?.homeScore ?? 0}</span>
          </div>
          <div className="flex items-center justify-between gap-6 text-lg font-semibold">
            <span className="truncate">{match.opponentName}</span>
            <span className="text-2xl text-emerald-300">{set?.awayScore ?? 0}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
          <span>
            First to {set?.targetPoints} • Win by {rules.winBy}
          </span>
          {state.matchComplete && (
            <span className="text-green-300">Final</span>
          )}
        </div>
      </div>
    </div>
  );
}
