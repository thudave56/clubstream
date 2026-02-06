"use client";

import { useState, useEffect, useRef } from "react";
import { LarixQRCode } from "../../components/LarixQRCode";
import { StatusBadge } from "../../components/StatusBadge";

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
  tournamentName?: string;
  scheduledStart?: string;
  courtLabel?: string;
  privacyStatus: "public" | "unlisted";
}

interface MatchManagementProps {
  onPoolStatusChange?: () => void;
}

export default function MatchManagement({ onPoolStatusChange }: MatchManagementProps) {
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
    matchId: string;
  } | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState<FormData>({
    teamId: "",
    opponentName: "",
    privacyStatus: "unlisted"
  });
  const [tournamentSelection, setTournamentSelection] = useState("");

  // Load teams, tournaments, and matches on mount
  useEffect(() => {
    loadTeams();
    loadTournaments();
    loadMatches();
    return () => stopPolling();
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startAutoLivePolling = (matchId: string) => {
    stopPolling();
    setStreamStatus("Waiting for stream...");

    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/matches/${matchId}/auto-live`, {
          method: "POST"
        });
        const data = await response.json();

        if (data.status === "live") {
          stopPolling();
          setStreamStatus(null);
          setLarixData(null);
          setMessage({ type: "success", text: "Match is now LIVE!" });
          loadMatches();
          onPoolStatusChange?.();
        } else if (data.status === "already_live") {
          stopPolling();
          setStreamStatus(null);
        } else if (["ended", "canceled"].includes(data.status)) {
          stopPolling();
          setStreamStatus(null);
        } else if (data.status === "transition_failed") {
          setStreamStatus(`Transition failed: ${data.error}`);
        } else {
          // Still waiting
          const statusLabel = data.streamStatus === "ready"
            ? "Stream ready, waiting for Larix data..."
            : data.streamStatus === "inactive"
            ? "Waiting for Larix to connect..."
            : `Stream: ${data.streamStatus}`;
          setStreamStatus(statusLabel);
        }
      } catch {
        setStreamStatus("Checking stream...");
      }
    }, 5000);
  };

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
        body: JSON.stringify({
          ...formData,
          scheduledStart: formData.scheduledStart
            ? new Date(formData.scheduledStart).toISOString()
            : undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create match");
      }

      const data = await response.json();

      setMessage({
        type: "success",
        text: "Match created! Scan the QR code to start streaming. It will go live automatically."
      });

      const ua = navigator.userAgent;
      const platform =
        /iPhone|iPad|iPod/i.test(ua)
          ? "ios"
          : /Android/i.test(ua)
          ? "android"
          : "";
      const larixQuery = platform ? `?platform=${platform}` : "";
      const larixResponse = await fetch(
        `/api/matches/${data.match.id}/larix${larixQuery}`
      );
      const larixPayload = larixResponse.ok
        ? await larixResponse.json()
        : { larixUrl: data.larixUrl };

      setLarixData({
        url: larixPayload.larixUrl || data.larixUrl,
        title: `${teams.find((team) => team.id === formData.teamId)?.displayName || "Team"} vs ${formData.opponentName}`,
        matchId: data.match.id
      });

      // Start polling for auto-live transition
      startAutoLivePolling(data.match.id);

      // Reset form
      setFormData({
        teamId: "",
        opponentName: "",
        privacyStatus: "unlisted"
      });
      setTournamentSelection("");

      // Reload matches and update pool status
      loadMatches();
      onPoolStatusChange?.();
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
      onPoolStatusChange?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel match"
      });
    }
  };

  const handleStatusTransition = async (matchId: string, newStatus: string) => {
    const labels: Record<string, string> = {
      live: "go live",
      ended: "end this match"
    };

    if (!confirm(`Are you sure you want to ${labels[newStatus] || newStatus}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/matches/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Failed to transition to ${newStatus}`);
      }

      setMessage({
        type: "success",
        text: newStatus === "live" ? "Match is now LIVE!" : "Match ended"
      });
      loadMatches();
      onPoolStatusChange?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : `Failed to ${newStatus}`
      });
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
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
              <option value="other">Other (type name)</option>
            </select>
          </div>

          {tournamentSelection === "other" && (
            <div>
              <label htmlFor="tournamentName" className="block text-sm font-medium mb-2">
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
            {streamStatus && (
              <div className="mt-3 rounded-lg border border-yellow-900 bg-yellow-900/20 p-3 text-center text-sm text-yellow-400">
                {streamStatus}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Match List */}
      <div>
        <h3 className="mb-4 text-lg font-medium">Recent Matches</h3>

        {message && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              message.type === "success"
                ? "border-green-900 bg-green-900/20 text-green-400"
                : "border-red-900 bg-red-900/20 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

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
                  <StatusBadge status={match.status} />

                  {["draft", "scheduled", "ready"].includes(match.status) && (
                    <button
                      onClick={() => handleStatusTransition(match.id, "live")}
                      className="rounded bg-green-700 px-3 py-1 text-sm font-medium text-white hover:bg-green-600"
                    >
                      Go Live
                    </button>
                  )}

                  {match.status === "live" && (
                    <button
                      onClick={() => handleStatusTransition(match.id, "ended")}
                      className="rounded bg-slate-700 px-3 py-1 text-sm font-medium text-white hover:bg-slate-600"
                    >
                      End
                    </button>
                  )}

                  {!["live", "ended", "canceled"].includes(match.status) && (
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
                      Watch
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
