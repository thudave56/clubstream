"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  winner?: "home" | "away";
}

interface MatchState {
  sets: SetResult[];
  currentSetNumber: number;
  homeSetsWon: number;
  awaySetsWon: number;
  matchComplete: boolean;
  winner?: "home" | "away";
  setsToWin: number;
}

interface ScoreResponse {
  match: MatchInfo;
  rules: MatchRules;
  state: MatchState;
}

interface ScoreClientProps {
  matchId: string;
}

export default function ScoreClient({ matchId }: ScoreClientProps) {
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideRules, setOverrideRules] = useState(false);

  const fetchScore = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/score`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load score");
      }
      const payload = (await res.json()) as ScoreResponse;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load score");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchScore();
    const interval = setInterval(fetchScore, 5000);
    return () => clearInterval(interval);
  }, [fetchScore]);

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

  const performAction = async (action: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, override: overrideRules })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Action failed");
      } else if (data) {
        setData({ ...data, state: payload.state, rules: payload.rules || data.rules });
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="space-y-4">
        <a className="text-sm text-slate-400 hover:text-slate-300" href={`/m/${matchId}`}>
          &larr; Back to match
        </a>
        <p className="text-slate-400">Loading score...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="space-y-4">
        <a className="text-sm text-slate-400 hover:text-slate-300" href={`/m/${matchId}`}>
          &larr; Back to match
        </a>
        <div className="rounded-lg border border-red-900 bg-red-900/20 p-4 text-sm text-red-400">
          {error || "Failed to load score"}
        </div>
      </main>
    );
  }

  const { match, rules, state } = data;
  const scoreboard = currentSet;

  return (
    <main className="space-y-6">
      <a className="text-sm text-slate-400 hover:text-slate-300" href={`/m/${matchId}`}>
        &larr; Back to match
      </a>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {match.teamDisplayName} vs {match.opponentName}
        </h1>
        <p className="text-sm text-slate-400">
          {match.tournamentName || "Clubstream"} • Set {state.currentSetNumber} of {rules.bestOf}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-sm uppercase tracking-widest text-slate-400">Home</div>
            <div className="mt-2 text-2xl font-semibold">{match.teamDisplayName}</div>
            <div className="mt-4 text-5xl font-bold text-blue-400">
              {scoreboard?.homeScore ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-sm uppercase tracking-widest text-slate-400">Away</div>
            <div className="mt-2 text-2xl font-semibold">{match.opponentName}</div>
            <div className="mt-4 text-5xl font-bold text-emerald-400">
              {scoreboard?.awayScore ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-400">
          Target {scoreboard?.targetPoints} • Win by {rules.winBy}
          {state.matchComplete && state.winner && (
            <span className="ml-2 text-green-400">
              {state.winner === "home" ? match.teamDisplayName : match.opponentName} won
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => performAction("home_plus")}
          disabled={busy || state.matchComplete}
          className="rounded-xl bg-blue-600 px-4 py-6 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Home +1
        </button>
        <button
          onClick={() => performAction("away_plus")}
          disabled={busy || state.matchComplete}
          className="rounded-xl bg-emerald-600 px-4 py-6 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Away +1
        </button>
        <button
          onClick={() => performAction("home_minus")}
          disabled={busy}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-base font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Home -1
        </button>
        <button
          onClick={() => performAction("away_minus")}
          disabled={busy}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-base font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Away -1
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => performAction("next_set")}
          disabled={busy}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Next Set
        </button>
        <button
          onClick={() => performAction("reset_set")}
          disabled={busy}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Reset Current Set
        </button>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Override Rules</div>
            <div className="text-xs text-slate-400">
              Allows scoring beyond normal set completion.
            </div>
          </div>
          <button
            onClick={() => setOverrideRules((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              overrideRules ? "bg-blue-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                overrideRules ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold">Set Summary</h2>
        <div className="mt-3 space-y-2">
          {state.sets.length === 0 && (
            <p className="text-sm text-slate-400">No sets recorded yet.</p>
          )}
          {state.sets.map((set) => (
            <div
              key={set.setNumber}
              className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-3 text-sm"
            >
              <div className="font-medium">Set {set.setNumber}</div>
              <div className="text-slate-300">
                {set.homeScore} - {set.awayScore}
              </div>
              <div className="text-xs text-slate-400">
                {set.complete
                  ? `${set.winner === "home" ? match.teamDisplayName : match.opponentName} won`
                  : `First to ${set.targetPoints}`}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-900/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}
    </main>
  );
}
