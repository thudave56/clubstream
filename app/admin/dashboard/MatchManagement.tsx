"use client";

import { useState, useEffect } from "react";
import { LarixQRCode } from "@/components/LarixQRCode";

interface Team {
  id: string;
  displayName: string;
}

interface Tournament {
  id: string;
  name: string;
}

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

interface FormData {
  teamId: string;
  opponentName: string;
  tournamentId?: string;
  scheduledStart?: string;
  courtLabel?: string;
  privacyStatus: "public" | "unlisted";
}

export default function MatchManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [larixData, setLarixData] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    teamId: "",
    opponentName: "",
    privacyStatus: "unlisted"
  });

  // Load teams, tournaments, and matches on mount
  useEffect(() => {
    loadTeams();
    loadTournaments();
    loadMatches();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await fetch("/api/teams");
      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error("Failed to load teams:", error);
    }
  };

  const loadTournaments = async () => {
    try {
      const response = await fetch("/api/tournaments");
      const data = await response.json();
      setTournaments(data.tournaments || []);
    } catch (error) {
      console.error("Failed to load tournaments:", error);
    }
  };

  const loadMatches = async () => {
    try {
      const response = await fetch("/api/matches");
      const data = await response.json();
      setMatches(data.matches || []);
    } catch (error) {
      console.error("Failed to load matches:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setLarixData(null);

    try {
      const response = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create match");
      }

      const data = await response.json();

      setMessage({
        type: "success",
        text: "Match created successfully!"
      });

      setLarixData({
        url: data.larixUrl,
        title: `${formData.opponentName} Match`
      });

      // Reset form
      setFormData({
        teamId: "",
        opponentName: "",
        privacyStatus: "unlisted"
      });

      // Reload matches
      loadMatches();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create match"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (matchId: string) => {
    if (!confirm("Are you sure you want to cancel this match?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/matches/${matchId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to cancel match");
      }

      setMessage({ type: "success", text: "Match canceled" });
      loadMatches();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel match"
      });
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-slate-800 text-slate-400";
      case "scheduled":
        return "bg-yellow-900/40 text-yellow-400";
      case "ready":
        return "bg-blue-900/40 text-blue-400";
      case "live":
        return "bg-green-900/40 text-green-400";
      case "ended":
        return "bg-slate-800 text-slate-400";
      case "canceled":
        return "bg-red-900/40 text-red-400";
      default:
        return "bg-slate-800 text-slate-400";
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="mb-6 text-xl font-semibold">Match Management</h2>

      {/* Create Match Form */}
      <div className="mb-8 rounded-lg border border-slate-800 p-4">
        <h3 className="mb-4 text-lg font-medium">Create New Match</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="teamId" className="block text-sm font-medium mb-2">
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
            <label htmlFor="opponentName" className="block text-sm font-medium mb-2">
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
            />
          </div>

          <div>
            <label htmlFor="tournamentId" className="block text-sm font-medium mb-2">
              Tournament (Optional)
            </label>
            <select
              id="tournamentId"
              value={formData.tournamentId || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tournamentId: e.target.value || undefined
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
              disabled={loading}
            >
              <option value="">None</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="courtLabel" className="block text-sm font-medium mb-2">
              Court Label (Optional)
            </label>
            <input
              id="courtLabel"
              type="text"
              value={formData.courtLabel || ""}
              onChange={(e) =>
                setFormData({ ...formData, courtLabel: e.target.value || undefined })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
              disabled={loading}
              maxLength={20}
            />
          </div>

          <div>
            <label htmlFor="scheduledStart" className="block text-sm font-medium mb-2">
              Scheduled Start (Optional)
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

          <div>
            <label className="block text-sm font-medium mb-2">Privacy Status</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="unlisted"
                  checked={formData.privacyStatus === "unlisted"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      privacyStatus: e.target.value as "unlisted"
                    })
                  }
                  className="mr-2"
                  disabled={loading}
                />
                <span>Unlisted</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="public"
                  checked={formData.privacyStatus === "public"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      privacyStatus: e.target.value as "public"
                    })
                  }
                  className="mr-2"
                  disabled={loading}
                />
                <span>Public</span>
              </label>
            </div>
          </div>

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

        {larixData && (
          <div className="mt-6">
            <LarixQRCode larixUrl={larixData.url} matchTitle={larixData.title} />
          </div>
        )}
      </div>

      {/* Match List */}
      <div>
        <h3 className="mb-4 text-lg font-medium">Recent Matches</h3>

        {matches.length === 0 ? (
          <p className="text-slate-400 text-sm">No matches created yet</p>
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 10).map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 p-4"
              >
                <div className="flex-1">
                  <div className="font-medium">{match.opponentName}</div>
                  <div className="text-sm text-slate-400">
                    {match.courtLabel && `Court: ${match.courtLabel} • `}
                    {new Date(match.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusBadgeClass(
                      match.status
                    )}`}
                  >
                    {match.status}
                  </span>

                  {match.status === "draft" && (
                    <button
                      onClick={() => handleCancel(match.id)}
                      className="rounded px-3 py-1 text-sm text-red-400 hover:bg-red-900/20"
                    >
                      Cancel
                    </button>
                  )}

                  {match.youtubeWatchUrl && (
                    <a
                      href={match.youtubeWatchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded px-3 py-1 text-sm text-blue-400 hover:bg-blue-900/20"
                    >
                      View Stream
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
