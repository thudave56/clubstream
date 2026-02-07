"use client";

import { useState, useEffect } from "react";
import { MatchStreamStatus } from "./MatchStreamStatus";
import MatchSharePanel from "./MatchSharePanel";

interface Team {
  id: string;
  displayName: string;
}

interface Tournament {
  id: string;
  name: string;
}

interface FormData {
  teamId: string;
  opponentName: string;
  tournamentId?: string;
  tournamentName?: string;
  scheduledStart?: string;
  courtLabel?: string;
  create_pin?: string;
}

interface CreatedMatch {
  id: string;
  opponentName: string;
  youtubeWatchUrl: string | null;
  larixUrl: string;
  matchTitle: string;
}

export default function MatchCreationForm() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [requirePin, setRequirePin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [createdMatch, setCreatedMatch] = useState<CreatedMatch | null>(null);
  const [formData, setFormData] = useState<FormData>({
    teamId: "",
    opponentName: ""
  });
  const [copied, setCopied] = useState(false);
  const [tournamentSelection, setTournamentSelection] = useState("");

  useEffect(() => {
    // Load teams, tournaments, and PIN requirement in parallel
    Promise.all([
      fetch("/api/teams", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/tournaments", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/settings/public", { cache: "no-store" }).then((r) => r.json())
    ]).then(([teamsData, tournamentsData, settingsData]) => {
      setTeams(teamsData.teams || []);
      setTournaments(tournamentsData.tournaments || []);
      setRequirePin(settingsData.requireCreatePin || false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const body: Record<string, string | undefined> = {
        teamId: formData.teamId,
        opponentName: formData.opponentName
      };

      if (formData.tournamentId) body.tournamentId = formData.tournamentId;
      if (formData.tournamentName) body.tournamentName = formData.tournamentName;
      if (formData.courtLabel) body.courtLabel = formData.courtLabel;
      if (formData.scheduledStart) {
        body.scheduledStart = new Date(formData.scheduledStart).toISOString();
      }
      if (formData.create_pin) body.create_pin = formData.create_pin;

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.message || data.error || "Failed to create match"
        });
        return;
      }

      // Find team name for display
      const team = teams.find((t) => t.id === formData.teamId);
      const matchTitle = `${team?.displayName || "Team"} vs ${formData.opponentName}`;

      setCreatedMatch({
        id: data.match.id,
        opponentName: formData.opponentName,
        youtubeWatchUrl: data.match.youtubeWatchUrl,
        larixUrl: data.larixUrl,
        matchTitle
      });

      setMessage({ type: "success", text: "Match created successfully!" });

      // Reset form
      setFormData({ teamId: "", opponentName: "" });
      setTournamentSelection("");
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWatchUrl = async () => {
    if (!createdMatch?.youtubeWatchUrl) return;
    try {
      await navigator.clipboard.writeText(createdMatch.youtubeWatchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore
    }
  };

  // Show success panel after match creation
  if (createdMatch) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 rounded-lg border border-green-900 bg-green-900/20 p-3 text-sm text-green-400">
          Match created successfully!
        </div>

        <h2 className="text-lg font-semibold">{createdMatch.matchTitle}</h2>

        <div className="mt-4 space-y-4">
          <MatchStreamStatus matchId={createdMatch.id} />

          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-slate-200">Next steps</h3>
            <ol className="mt-2 space-y-2 text-sm text-slate-300">
              <li>
                <span className="font-medium text-slate-200">Streamer phone:</span>{" "}
                open the Larix launcher and press start.
              </li>
              <li>
                <span className="font-medium text-slate-200">Scorer device:</span>{" "}
                open scoring and keep it open during the match.
              </li>
              <li>
                <span className="font-medium text-slate-200">Share:</span> copy the
                match link for parents, and optionally share the overlay link if
                you are using a scoreboard overlay.
              </li>
            </ol>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={`/m/${createdMatch.id}/stream`}
              className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
            >
              Open Larix Launcher
            </a>

            <a
              href={`/m/${createdMatch.id}/score`}
              className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Open Scoring
            </a>

            {createdMatch.youtubeWatchUrl && (
              <button
                onClick={handleCopyWatchUrl}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                {copied ? "Copied!" : "Copy YouTube Watch Link"}
              </button>
            )}
          </div>

          <MatchSharePanel
            matchId={createdMatch.id}
            youtubeWatchUrl={createdMatch.youtubeWatchUrl}
            includeLarixLauncher={false}
            title="Links to Share"
            description="Copy links for parents, your scorer, and (optionally) the overlay."
          />

          <button
            onClick={() => setCreatedMatch(null)}
            className="mt-2 text-sm text-slate-400 hover:text-slate-300"
          >
            Create another match
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold">Create Match</h2>
      <p className="mt-1 text-sm text-slate-400">
        Fill in the details to set up the YouTube broadcast and Larix streaming link.
      </p>
      {requirePin && (
        <div className="mt-4 rounded-lg border border-amber-900 bg-amber-900/20 p-3 text-sm text-amber-300">
          Match creation is protected. Ask your admin for the creation PIN.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="teamId" className="mb-2 block text-sm font-medium">
            Team *
          </label>
          <select
            id="teamId"
            value={formData.teamId}
            onChange={(e) =>
              setFormData({ ...formData, teamId: e.target.value })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            required
            disabled={loading}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="opponentName"
            className="mb-2 block text-sm font-medium"
          >
            Opponent Name *
          </label>
          <input
            id="opponentName"
            type="text"
            value={formData.opponentName}
            onChange={(e) =>
              setFormData({ ...formData, opponentName: e.target.value })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            required
            disabled={loading}
            maxLength={100}
            placeholder="e.g. XYZ Volleyball"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="tournamentId"
              className="mb-2 block text-sm font-medium"
            >
              Tournament
            </label>
            <select
              id="tournamentId"
              value={tournamentSelection}
              onChange={(e) => {
                const value = e.target.value;
                setTournamentSelection(value);
                if (value === "other" || value === "") {
                  setFormData({
                    ...formData,
                    tournamentId: undefined,
                    tournamentName: value === "other" ? "" : undefined
                  });
                } else {
                  setFormData({
                    ...formData,
                    tournamentId: value,
                    tournamentName: undefined
                  });
                }
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
              disabled={loading}
            >
              <option value="">None</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="other">Other (type name)</option>
            </select>
          </div>

          {tournamentSelection === "other" && (
            <div>
              <label
                htmlFor="tournamentName"
                className="mb-2 block text-sm font-medium"
              >
                Tournament Name
              </label>
              <input
                id="tournamentName"
                type="text"
                value={formData.tournamentName || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tournamentName: e.target.value || undefined
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                disabled={loading}
                required={tournamentSelection === "other"}
                maxLength={120}
                placeholder="e.g. NEQ Boston"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="courtLabel"
              className="mb-2 block text-sm font-medium"
            >
              Court Label
            </label>
            <input
              id="courtLabel"
              type="text"
              value={formData.courtLabel || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  courtLabel: e.target.value || undefined
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
              disabled={loading}
              maxLength={20}
              placeholder="e.g. Court 4"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="scheduledStart"
            className="mb-2 block text-sm font-medium"
          >
            Scheduled Start
          </label>
          <input
            id="scheduledStart"
            type="datetime-local"
            value={formData.scheduledStart || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                scheduledStart: e.target.value || undefined
              })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            disabled={loading}
          />
        </div>

        {requirePin && (
          <div>
            <label
              htmlFor="create_pin"
              className="mb-2 block text-sm font-medium"
            >
              Match Creation PIN *
            </label>
            <input
              id="create_pin"
              type="password"
              value={formData.create_pin || ""}
              onChange={(e) =>
                setFormData({ ...formData, create_pin: e.target.value })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
              required
              disabled={loading}
              maxLength={20}
              placeholder="Enter PIN"
            />
          </div>
        )}

        {message && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              message.type === "success"
                ? "border-green-900 bg-green-900/20 text-green-400"
                : "border-red-900 bg-red-900/20 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Match"}
        </button>
      </form>
    </section>
  );
}
