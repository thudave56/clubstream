"use client";

import { useEffect, useMemo, useState } from "react";

type Team = {
  id: string;
  slug: string;
  displayName: string;
  enabled: boolean;
  createdAt: string;
};

export default function TeamManagement({
  onChanged
}: {
  onChanged?: () => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const enabledCount = useMemo(
    () => teams.filter((t) => t.enabled).length,
    [teams]
  );

  async function loadTeams() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load teams");
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load teams"
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeams();
  }, []);

  async function handleCreate() {
    setMessage(null);
    const displayName = newName.trim();
    const slug = newSlug.trim();
    if (!displayName) {
      setMessage({ type: "error", text: "Team name is required." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, slug: slug || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team");

      setNewName("");
      setNewSlug("");
      setMessage({ type: "success", text: "Team created." });
      await loadTeams();
      onChanged?.();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create team"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRename(teamId: string) {
    const displayName = editingName.trim();
    if (!displayName) {
      setMessage({ type: "error", text: "Team name must not be empty." });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update team");

      setEditingId(null);
      setEditingName("");
      setMessage({ type: "success", text: "Team updated." });
      await loadTeams();
      onChanged?.();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update team"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleEnabled(team: Team) {
    const nextEnabled = !team.enabled;
    const ok = confirm(
      nextEnabled
        ? `Enable "${team.displayName}"?`
        : `Disable "${team.displayName}"? Disabled teams will not appear in the match team dropdown.`
    );
    if (!ok) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update team");

      setMessage({
        type: "success",
        text: nextEnabled ? "Team enabled." : "Team disabled."
      });
      await loadTeams();
      onChanged?.();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update team"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Teams</h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage teams shown in the match creation dropdown. Disabled teams are
            hidden from the public team list.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Enabled: {enabledCount} / {teams.length}
          </p>
        </div>
        <button
          onClick={() => void loadTeams()}
          disabled={loading}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-green-900 bg-green-900/20 text-green-400"
              : "border-red-900 bg-red-900/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-sm text-slate-300" htmlFor="new-team-name">
            New team name
          </label>
          <input
            id="new-team-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            placeholder="e.g. Northside Lions"
          />
        </div>
        <div>
          <label className="text-sm text-slate-300" htmlFor="new-team-slug">
            Slug (optional)
          </label>
          <input
            id="new-team-slug"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            placeholder="northside-lions"
          />
        </div>
        <div className="md:col-span-3">
          <button
            onClick={() => void handleCreate()}
            disabled={loading}
            className="w-full rounded-lg border border-blue-700 bg-blue-900/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-900/40 disabled:opacity-50"
          >
            Add team
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-800">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-400">
          <div className="col-span-5">Name</div>
          <div className="col-span-4">Slug</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-slate-800">
          {teams.map((t) => {
            const isEditing = editingId === t.id;
            return (
              <div
                key={t.id}
                className="grid grid-cols-12 gap-3 px-4 py-3 text-sm"
                data-team-id={t.id}
              >
                <div className="col-span-5">
                  {isEditing ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950/40 px-2 py-1 text-sm text-slate-100"
                      aria-label={`Edit team name for ${t.displayName}`}
                    />
                  ) : (
                    <div className="font-medium text-slate-200">
                      {t.displayName}
                    </div>
                  )}
                </div>
                <div className="col-span-4">
                  <code className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">
                    {t.slug}
                  </code>
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      t.enabled
                        ? "bg-green-900/30 text-green-300"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {t.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => void handleSaveRename(t.id)}
                        disabled={loading}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                        disabled={loading}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(t.id);
                          setEditingName(t.displayName);
                        }}
                        disabled={loading}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleToggleEnabled(t)}
                        disabled={loading}
                        className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                          t.enabled
                            ? "border-red-800 bg-red-900/10 text-red-300 hover:bg-red-900/20"
                            : "border-green-800 bg-green-900/10 text-green-300 hover:bg-green-900/20"
                        }`}
                      >
                        {t.enabled ? "Disable" : "Enable"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {teams.length === 0 && !loading && (
            <div className="px-4 py-6 text-sm text-slate-400">
              No teams yet.
            </div>
          )}

          {loading && teams.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400">Loading...</div>
          )}
        </div>
      </div>
    </section>
  );
}

