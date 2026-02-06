"use client";

import { useState } from "react";
import { MatchStreamStatus } from "../../components/MatchStreamStatus";

interface MatchDetailClientProps {
  matchId: string;
  status: string;
  youtubeWatchUrl: string | null;
  isPreLive: boolean;
}

export default function MatchDetailClient({
  matchId,
  status,
  youtubeWatchUrl,
  isPreLive
}: MatchDetailClientProps) {
  const [copied, setCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const handleCopy = async () => {
    if (!youtubeWatchUrl) return;
    try {
      await navigator.clipboard.writeText(youtubeWatchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleEndMatch = async () => {
    if (!confirm("Are you sure you want to end this match?")) return;
    try {
      const res = await fetch(`/api/matches/${matchId}/end`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to end match");
      setCurrentStatus("ended");
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Stream status polling for pre-live matches */}
      {isPreLive && currentStatus !== "ended" && (
        <MatchStreamStatus matchId={matchId} onLive={() => setCurrentStatus("live")} />
      )}

      {/* End match button for live matches */}
      {currentStatus === "live" && (
        <button
          onClick={handleEndMatch}
          className="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700"
        >
          End Match
        </button>
      )}

      {currentStatus === "ended" && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center text-sm text-slate-400">
          Match ended
        </div>
      )}

      {/* Copy watch URL button */}
      {youtubeWatchUrl && (
        <button
          onClick={handleCopy}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          {copied ? "Copied!" : "Copy YouTube Watch Link"}
        </button>
      )}
    </div>
  );
}
