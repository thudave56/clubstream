"use client";

import { useState } from "react";

interface MatchActionsProps {
  matchId: string;
}

export default function MatchActions({ matchId }: MatchActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}/m/${matchId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/m/${matchId}/score`}
        className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
      >
        Open Scoring
      </a>
      <a
        href={`/m/${matchId}/overlay`}
        className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
      >
        Open Overlay
      </a>
      <button
        onClick={handleCopy}
        className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
      >
        {copied ? "Copied!" : "Copy Match Link"}
      </button>
    </div>
  );
}
