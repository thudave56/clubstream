"use client";

import { useRef, useState } from "react";
import { MatchStreamStatus } from "../../components/MatchStreamStatus";

interface MatchDetailClientProps {
  matchId: string;
  status: string;
  youtubeWatchUrl: string | null;
  isPreLive: boolean;
  tournamentName: string | null;
  defaultTitle: string;
  defaultDescription: string;
  youtubeTitleOverride: string;
  youtubeDescriptionOverride: string;
  rules: {
    bestOf: number;
    pointsToWin: number;
    finalSetPoints: number;
    winBy: number;
  };
}

export default function MatchDetailClient({
  matchId,
  status,
  youtubeWatchUrl,
  isPreLive,
  tournamentName,
  defaultTitle,
  defaultDescription,
  youtubeTitleOverride,
  youtubeDescriptionOverride,
  rules
}: MatchDetailClientProps) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [titleOverride, setTitleOverride] = useState(youtubeTitleOverride);
  const [descriptionOverride, setDescriptionOverride] = useState(
    youtubeDescriptionOverride
  );
  const initialTitleRef = useRef(youtubeTitleOverride);
  const initialDescriptionRef = useRef(youtubeDescriptionOverride);
  const [rulesDraft, setRulesDraft] = useState(rules);
  const [showRules, setShowRules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const handleCopyMatchLink = async () => {
    const link = `${window.location.origin}/m/${matchId}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
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

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const payload: Record<string, unknown> = {};
      const normalizedTitle = titleOverride.trim();
      const normalizedDescription = descriptionOverride.trim();

      if (normalizedTitle !== initialTitleRef.current.trim()) {
        payload.youtubeTitleOverride = normalizedTitle ? normalizedTitle : null;
      }
      if (normalizedDescription !== initialDescriptionRef.current.trim()) {
        payload.youtubeDescriptionOverride = normalizedDescription
          ? normalizedDescription
          : null;
      }

      if (showRules) {
        payload.rulesBestOf = rulesDraft.bestOf;
        payload.rulesPointsToWin = rulesDraft.pointsToWin;
        payload.rulesFinalSetPoints = rulesDraft.finalSetPoints;
        payload.rulesWinBy = rulesDraft.winBy;
      }

      if (Object.keys(payload).length === 0) {
        setSaveMessage({ type: "success", text: "No changes to save" });
        return;
      }

      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveMessage({
          type: "error",
          text: data.error || "Failed to save changes"
        });
        return;
      }

      if (payload.youtubeTitleOverride !== undefined) {
        initialTitleRef.current = titleOverride;
      }
      if (payload.youtubeDescriptionOverride !== undefined) {
        initialDescriptionRef.current = descriptionOverride;
      }

      const youTubeMessage = data.youtubeUpdated
        ? "YouTube updated"
        : data.youtubeError
        ? "Saved locally (YouTube update failed)"
        : "Saved";

      setSaveMessage({
        type: "success",
        text: youTubeMessage
      });
    } catch {
      setSaveMessage({ type: "error", text: "Failed to save changes" });
    } finally {
      setSaving(false);
    }
  };

  const resetRules = () => {
    setRulesDraft({
      bestOf: 3,
      pointsToWin: 25,
      finalSetPoints: 15,
      winBy: 2
    });
  };

  return (
    <div className="space-y-8">
      {/* Stream status polling — active during pre-live and live phases */}
      {currentStatus !== "ended" && currentStatus !== "canceled" && (
        <MatchStreamStatus
          matchId={matchId}
          onLive={() => setCurrentStatus("live")}
          onEnded={() => setCurrentStatus("ended")}
        />
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

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div>
          <h2 className="text-lg font-semibold">Match Links</h2>
          <p className="text-sm text-slate-400">
            Share this match link for scoring and overlay access.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={`/m/${matchId}/score`}
            className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            Open Scoring
          </a>
          <a
            href={`/m/${matchId}/overlay`}
            className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Open Overlay
          </a>
          <button
            onClick={handleCopyMatchLink}
            className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            {linkCopied ? "Match Link Copied" : "Copy Match Link"}
          </button>
          {youtubeWatchUrl && (
            <button
              onClick={handleCopy}
              className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              {copied ? "Copied!" : "Copy YouTube Watch Link"}
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">YouTube Metadata</h2>
          <p className="text-sm text-slate-400">
            Leave blank to use the default title and description.
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            Default title: <span className="text-slate-300">{defaultTitle}</span>
          </div>
          {tournamentName && (
            <div className="text-xs text-slate-500">
              Tournament: {tournamentName}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Title Override</label>
          <input
            type="text"
            value={titleOverride}
            onChange={(e) => setTitleOverride(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            placeholder={defaultTitle}
            maxLength={140}
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Description Override</label>
          <textarea
            value={descriptionOverride}
            onChange={(e) => setDescriptionOverride(e.target.value)}
            className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            placeholder={defaultDescription || "Court: Court 4"}
            maxLength={5000}
          />
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Scoring Rules</div>
              <div className="text-sm text-slate-400">
                Best of {rulesDraft.bestOf}, sets to {rulesDraft.pointsToWin},
                final set {rulesDraft.finalSetPoints}, win by {rulesDraft.winBy}
              </div>
            </div>
            <button
              onClick={() => setShowRules((prev) => !prev)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-900"
            >
              {showRules ? "Hide" : "Edit"}
            </button>
          </div>

          {showRules && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Best Of
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={rulesDraft.bestOf}
                  onChange={(e) =>
                    setRulesDraft({ ...rulesDraft, bestOf: Number(e.target.value) })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm">
                Points to Win
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={rulesDraft.pointsToWin}
                  onChange={(e) =>
                    setRulesDraft({ ...rulesDraft, pointsToWin: Number(e.target.value) })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm">
                Final Set Points
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={rulesDraft.finalSetPoints}
                  onChange={(e) =>
                    setRulesDraft({
                      ...rulesDraft,
                      finalSetPoints: Number(e.target.value)
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm">
                Win By
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={rulesDraft.winBy}
                  onChange={(e) =>
                    setRulesDraft({ ...rulesDraft, winBy: Number(e.target.value) })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                />
              </label>
              <button
                type="button"
                onClick={resetRules}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                Reset to Defaults
              </button>
            </div>
          )}
        </div>

        {saveMessage && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              saveMessage.type === "success"
                ? "border-green-900 bg-green-900/20 text-green-400"
                : "border-red-900 bg-red-900/20 text-red-400"
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </section>
    </div>
  );
}
