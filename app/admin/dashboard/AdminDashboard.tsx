"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MatchManagement from "./MatchManagement";
import TeamManagement from "./TeamManagement";

interface Settings {
  requireCreatePin: boolean;
  oauthStatus: string;
  channelId: string | null;
  hasAdminPin: boolean;
  hasCreatePin: boolean;
}

interface PoolStatus {
  available: number;
  reserved: number;
  in_use: number;
  stuck: number;
  disabled: number;
  total: number;
}

interface AuditEntry {
  id: string;
  action: string;
  detail: unknown;
  createdAt: string;
}

interface StreamRecord {
  id: string;
  youtubeStreamId: string;
  status: string;
  reservedMatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolMessage, setPoolMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("all");
  const [auditTextFilter, setAuditTextFilter] = useState("");
  const [auditCopiedId, setAuditCopiedId] = useState<string | null>(null);

  const [streamToolsOpen, setStreamToolsOpen] = useState(false);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [stuckStreams, setStuckStreams] = useState<StreamRecord[]>([]);
  const [disabledStreams, setDisabledStreams] = useState<StreamRecord[]>([]);
  const [streamActionId, setStreamActionId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadAuditLog();

    // Check for OAuth result in URL
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get("oauth");

    if (oauthResult === "success") {
      setOauthMessage({
        type: "success",
        text: "YouTube connected successfully!"
      });
      loadSettings(); // Refresh settings to show connected state
      loadPoolStatus(); // Load pool status after OAuth success
    } else if (oauthResult === "denied") {
      setOauthMessage({
        type: "error",
        text: "YouTube connection was denied."
      });
    } else if (oauthResult === "error") {
      setOauthMessage({
        type: "error",
        text: "Failed to connect YouTube. Please try again."
      });
    }

    // Clear query params
    if (oauthResult) {
      window.history.replaceState({}, "", "/admin/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });

      if (response.status === 401) {
        router.push("/admin");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load settings");
      }

      const data = await response.json();
      setSettings(data);

      // Load pool status if OAuth is connected
      if (data.oauthStatus === "connected") {
        loadPoolStatus();
      }
    } catch (err) {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    setAuditLoading(true);
    setAuditError("");

    try {
      const response = await fetch("/api/admin/audit", { cache: "no-store" });

      if (response.status === 401) {
        router.push("/admin");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load audit log");
      }

      const data = await response.json();
      setAuditEntries(data.entries || []);
    } catch {
      setAuditError("Failed to load audit log");
    } finally {
      setAuditLoading(false);
    }
  };

  const loadPoolStatus = async () => {
    try {
      const response = await fetch("/api/admin/stream-pool/status", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load pool status");
      }

      const data = await response.json();
      setPoolStatus(data);
    } catch (err) {
      console.error("Pool status error:", err);
    }
  };

  const loadStreamTools = async () => {
    setStreamsLoading(true);

    try {
      const [stuckRes, disabledRes] = await Promise.all([
        fetch("/api/admin/stream-pool/streams?status=stuck"),
        fetch("/api/admin/stream-pool/streams?status=disabled")
      ]);

      if (stuckRes.ok) {
        const data = await stuckRes.json();
        setStuckStreams(data.streams || []);
      }

      if (disabledRes.ok) {
        const data = await disabledRes.json();
        setDisabledStreams(data.streams || []);
      }
    } catch {
      // Ignore; this tooling is optional.
    } finally {
      setStreamsLoading(false);
    }
  };

  const handleStreamAction = async (
    streamId: string,
    action: "reset" | "disable" | "enable"
  ) => {
    setStreamActionId(streamId);
    setPoolMessage(null);

    try {
      const res = await fetch(
        `/api/admin/stream-pool/streams/${streamId}/${action}`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Action failed");
      }

      setPoolMessage({
        type: "success",
        text:
          action === "reset"
            ? "Stream recovered to available"
            : action === "disable"
            ? "Stream disabled"
            : "Stream enabled"
      });

      await Promise.all([loadPoolStatus(), loadStreamTools(), loadAuditLog()]);
    } catch (err) {
      setPoolMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Action failed"
      });
    } finally {
      setStreamActionId(null);
    }
  };

  const auditActions = useMemo(() => {
    const actions = new Set<string>();
    for (const entry of auditEntries) actions.add(entry.action);
    return Array.from(actions).sort((a, b) => a.localeCompare(b));
  }, [auditEntries]);

  const filteredAuditEntries = useMemo(() => {
    const q = auditTextFilter.trim().toLowerCase();
    return auditEntries.filter((entry) => {
      if (auditActionFilter !== "all" && entry.action !== auditActionFilter) {
        return false;
      }
      if (!q) return true;

      const detailText =
        entry.detail && typeof entry.detail === "object"
          ? JSON.stringify(entry.detail)
          : entry.detail
          ? String(entry.detail)
          : "";

      const haystack = `${entry.action} ${detailText}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [auditActionFilter, auditEntries, auditTextFilter]);

  const copyAuditDetail = async (entry: AuditEntry) => {
    const detailText =
      entry.detail && typeof entry.detail === "object"
        ? JSON.stringify(entry.detail, null, 2)
        : entry.detail
        ? String(entry.detail)
        : "";

    if (!detailText) return;

    try {
      await navigator.clipboard.writeText(detailText);
      setAuditCopiedId(entry.id);
      setTimeout(() => setAuditCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failures.
    }
  };

  const handleInitializePool = async () => {
    const count = prompt("How many streams to create? (1-20)", "10");
    if (!count) return;

    const countNum = parseInt(count);
    if (isNaN(countNum) || countNum < 1 || countNum > 20) {
      setPoolMessage({
        type: "error",
        text: "Invalid count. Enter 1-20."
      });
      return;
    }

    setPoolLoading(true);
    setPoolMessage(null);

    try {
      const response = await fetch("/api/admin/stream-pool/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: countNum })
      });

      if (!response.ok) {
        throw new Error("Failed to initialize pool");
      }

      const data = await response.json();
      setPoolMessage({
        type: "success",
        text: `Created ${data.created} stream${data.created !== 1 ? "s" : ""}`
      });
      loadPoolStatus();
    } catch (err) {
      setPoolMessage({
        type: "error",
        text: "Failed to initialize pool"
      });
    } finally {
      setPoolLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleToggleCreatePin = async () => {
    if (!settings) return;

    setUpdating(true);
    setError("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requireCreatePin: !settings.requireCreatePin
        })
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      setSettings({
        ...settings,
        requireCreatePin: !settings.requireCreatePin
      });
    } catch (err) {
      setError("Failed to update settings");
    } finally {
      setUpdating(false);
    }
  };

  const handleConnectYouTube = async () => {
    setOauthLoading(true);
    setOauthMessage(null);

    try {
      const response = await fetch("/api/admin/oauth/connect");

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth");
      }

      const data = await response.json();

      // Open OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      window.open(
        data.authUrl,
        "YouTube OAuth",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for status changes
      const pollInterval = setInterval(async () => {
        const settings = await fetch("/api/admin/settings");
        const settingsData = await settings.json();

        if (settingsData.oauthStatus === "connected") {
          clearInterval(pollInterval);
          setOauthLoading(false);
          loadSettings();
          setOauthMessage({
            type: "success",
            text: "YouTube connected!"
          });
        } else if (settingsData.oauthStatus === "error") {
          clearInterval(pollInterval);
          setOauthLoading(false);
          setOauthMessage({
            type: "error",
            text: "Connection failed."
          });
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    } catch (err) {
      setOauthLoading(false);
      setOauthMessage({
        type: "error",
        text: "Failed to start connection."
      });
    }
  };

  const handleDisconnectYouTube = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect YouTube? This will remove all stored credentials."
      )
    ) {
      return;
    }

    setOauthLoading(true);

    try {
      const response = await fetch("/api/admin/oauth/disconnect", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      await loadSettings();
      setOauthMessage({
        type: "success",
        text: "YouTube disconnected."
      });
    } catch (err) {
      setOauthMessage({
        type: "error",
        text: "Failed to disconnect."
      });
    } finally {
      setOauthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-400">Failed to load dashboard</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-slate-400">
              Manage stream pool, OAuth settings, and security
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-800"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-900/20 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Start-of-day checklist */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Start-of-Day Checklist</h2>
          <p className="mt-1 text-sm text-slate-400">
            Quick health signals to reduce surprises during the first match.
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 p-4">
              <div>
                <div className="font-medium">YouTube connected</div>
                <div className="mt-1 text-sm text-slate-400">
                  Required to create streams and manage the pool.
                </div>
              </div>
              <a
                href="#oauth"
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                  settings.oauthStatus === "connected"
                    ? "bg-green-900/40 text-green-400"
                    : "bg-amber-900/30 text-amber-300"
                }`}
              >
                {settings.oauthStatus === "connected" ? "OK" : "Needs action"}
              </a>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 p-4">
              <div>
                <div className="font-medium">Stream pool ready</div>
                <div className="mt-1 text-sm text-slate-400">
                  You want at least 1 available stream and 0 stuck streams.
                </div>
              </div>
              <a
                href="#pool"
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                  settings.oauthStatus !== "connected"
                    ? "bg-slate-800 text-slate-400"
                    : poolStatus && poolStatus.available > 0 && poolStatus.stuck === 0
                    ? "bg-green-900/40 text-green-400"
                    : "bg-amber-900/30 text-amber-300"
                }`}
              >
                {settings.oauthStatus !== "connected"
                  ? "Connect first"
                  : poolStatus && poolStatus.available > 0 && poolStatus.stuck === 0
                  ? "OK"
                  : "Needs action"}
              </a>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 p-4">
              <div>
                <div className="font-medium">Match creation PIN (if required)</div>
                <div className="mt-1 text-sm text-slate-400">
                  If PIN is required, it must be configured or match creation will fail.
                </div>
              </div>
              <a
                href="#security"
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                  settings.requireCreatePin && !settings.hasCreatePin
                    ? "bg-amber-900/30 text-amber-300"
                    : "bg-green-900/40 text-green-400"
                }`}
              >
                {settings.requireCreatePin && !settings.hasCreatePin
                  ? "Needs action"
                  : "OK"}
              </a>
            </div>
          </div>
        </section>

        {/* OAuth Status */}
        <section id="oauth" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">YouTube OAuth Status</h2>

          {oauthMessage && (
            <div
              className={`mt-4 rounded-lg border p-3 text-sm ${
                oauthMessage.type === "success"
                  ? "border-green-900 bg-green-900/20 text-green-400"
                  : "border-red-900 bg-red-900/20 text-red-400"
              }`}
            >
              {oauthMessage.text}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Status</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  settings.oauthStatus === "connected"
                    ? "bg-green-900/40 text-green-400"
                    : settings.oauthStatus === "error"
                    ? "bg-red-900/40 text-red-400"
                    : settings.oauthStatus === "connecting"
                    ? "bg-yellow-900/40 text-yellow-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {settings.oauthStatus}
              </span>
            </div>
            {settings.channelId && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Channel ID</span>
                <code className="rounded bg-slate-800 px-2 py-1 text-sm">
                  {settings.channelId}
                </code>
              </div>
            )}
            <div className="pt-2">
              {settings.oauthStatus === "connected" ? (
                <button
                  onClick={handleDisconnectYouTube}
                  disabled={oauthLoading}
                  className="w-full rounded-lg border border-red-700 bg-red-900/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
                >
                  {oauthLoading ? "Disconnecting..." : "Disconnect YouTube"}
                </button>
              ) : (
                <button
                  onClick={handleConnectYouTube}
                  disabled={oauthLoading}
                  className="w-full rounded-lg border border-blue-700 bg-blue-900/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-900/40 disabled:opacity-50"
                >
                  {oauthLoading
                    ? "Connecting..."
                    : settings.oauthStatus === "error"
                    ? "Reconnect YouTube"
                    : "Connect YouTube"}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Stream Pool Status */}
        <section id="pool" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Stream Pool Status</h2>

          {settings.oauthStatus !== "connected" && (
            <div className="mt-4 rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
              Connect YouTube first to manage stream pool
            </div>
          )}

          {settings.oauthStatus === "connected" && (
            <div className="mt-4 space-y-4">
              {poolMessage && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    poolMessage.type === "success"
                      ? "border-green-900 bg-green-900/20 text-green-400"
                      : "border-red-900 bg-red-900/20 text-red-400"
                  }`}
                >
                  {poolMessage.text}
                </div>
              )}

              {poolStatus && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div className="rounded-lg border border-slate-800 p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {poolStatus.available}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">Available</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400">
                      {poolStatus.reserved}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">Reserved</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {poolStatus.in_use}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">In Use</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-4 text-center">
                    <div className="text-2xl font-bold text-red-400">
                      {poolStatus.stuck}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">Stuck</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-4 text-center">
                    <div className="text-2xl font-bold text-slate-300">
                      {poolStatus.total}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">Total</div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={loadPoolStatus}
                    disabled={poolLoading}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    Refresh Status
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !streamToolsOpen;
                      setStreamToolsOpen(next);
                      if (next) await loadStreamTools();
                    }}
                    disabled={streamsLoading}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    {streamToolsOpen ? "Hide Recovery Tools" : "Open Recovery Tools"}
                  </button>
                </div>

                <button
                  onClick={handleInitializePool}
                  disabled={poolLoading}
                  className="w-full rounded-lg border border-blue-700 bg-blue-900/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-900/40 disabled:opacity-50"
                >
                  {poolLoading ? "Creating..." : "Initialize Stream Pool"}
                </button>

                {poolStatus && poolStatus.total > 0 && (
                  <p className="text-xs text-slate-400">
                    Pool already has {poolStatus.total} stream{poolStatus.total !== 1 ? "s" : ""}. This will add more.
                  </p>
                )}

                {streamToolsOpen && (
                  <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">Recovery Tools</div>
                        <div className="mt-1 text-sm text-slate-400">
                          Reset stuck streams back to available or disable streams that should not be used.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={loadStreamTools}
                        disabled={streamsLoading}
                        className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                      >
                        {streamsLoading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-800 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-slate-200">Stuck Streams</div>
                          <div className="text-xs text-slate-500">{stuckStreams.length}</div>
                        </div>
                        {stuckStreams.length === 0 ? (
                          <div className="mt-2 text-sm text-slate-400">None</div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {stuckStreams.map((s) => (
                              <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-xs text-slate-500">
                                      {s.youtubeStreamId}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      Reserved match: {s.reservedMatchId || "none"}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Updated: {new Date(s.updatedAt).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-col gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleStreamAction(s.id, "reset")}
                                      disabled={streamActionId === s.id}
                                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {streamActionId === s.id ? "Working..." : "Reset"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStreamAction(s.id, "disable")}
                                      disabled={streamActionId === s.id}
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                                    >
                                      Disable
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-800 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-slate-200">Disabled Streams</div>
                          <div className="text-xs text-slate-500">{disabledStreams.length}</div>
                        </div>
                        {disabledStreams.length === 0 ? (
                          <div className="mt-2 text-sm text-slate-400">None</div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {disabledStreams.map((s) => (
                              <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-xs text-slate-500">
                                      {s.youtubeStreamId}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Updated: {new Date(s.updatedAt).toLocaleString()}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleStreamAction(s.id, "enable")}
                                    disabled={streamActionId === s.id}
                                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {streamActionId === s.id ? "Working..." : "Enable"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Security Settings */}
        <section id="security" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Security Settings</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 p-4">
              <div>
                <div className="font-medium">Require PIN for Match Creation</div>
                <div className="mt-1 text-sm text-slate-400">
                  When enabled, users must enter a PIN to create matches
                </div>
              </div>
              <button
                onClick={handleToggleCreatePin}
                disabled={updating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.requireCreatePin ? "bg-blue-600" : "bg-slate-700"
                } ${updating ? "opacity-50" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.requireCreatePin ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="rounded-lg border border-slate-800 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-400">Admin PIN</div>
                  <div className="mt-1 text-lg font-semibold">
                    {settings.hasAdminPin ? (
                      <span className="text-green-400">Configured</span>
                    ) : (
                      <span className="text-red-400">Not set</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Create PIN</div>
                  <div className="mt-1 text-lg font-semibold">
                    {settings.hasCreatePin ? (
                      <span className="text-green-400">Configured</span>
                    ) : (
                      <span className="text-slate-500">Not set</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <TeamManagement onChanged={loadAuditLog} />

        {/* Match Management */}
        {settings?.oauthStatus === "connected" && (
          <MatchManagement onPoolStatusChange={loadPoolStatus} />
        )}

        {/* Audit Log */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <div className="mt-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="text-xs text-slate-400">
                  Action
                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 sm:w-56"
                  >
                    <option value="all">All actions</option>
                    {auditActions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-slate-400">
                  Search
                  <input
                    value={auditTextFilter}
                    onChange={(e) => setAuditTextFilter(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 sm:w-64"
                    placeholder="matchId, stream_pool, oauth..."
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={loadAuditLog}
                disabled={auditLoading}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {auditLoading ? "Refreshing..." : "Refresh activity"}
              </button>
            </div>

            {auditLoading && (
              <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
                Loading recent activity...
              </div>
            )}
            {!auditLoading && auditError && (
              <div className="rounded-lg border border-red-900 bg-red-900/20 p-4 text-sm text-red-400">
                {auditError}
              </div>
            )}
            {!auditLoading && !auditError && auditEntries.length === 0 && (
              <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
                No recent activity yet.
              </div>
            )}
            {!auditLoading && !auditError && auditEntries.length > 0 && filteredAuditEntries.length === 0 && (
              <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
                No entries match your filters.
              </div>
            )}
            {!auditLoading && !auditError && filteredAuditEntries.length > 0 && (
              <div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                {filteredAuditEntries.map((entry) => {
                  const label = entry.action
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (m) => m.toUpperCase());
                  const detailText =
                    entry.detail && typeof entry.detail === "object"
                      ? JSON.stringify(entry.detail, null, 2)
                      : entry.detail
                      ? String(entry.detail)
                      : "";

                  return (
                    <div key={entry.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-200">
                          {label}
                        </div>
                        {detailText && (
                          <details className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                            <summary className="cursor-pointer text-xs font-medium text-slate-300">
                              Details
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
                              {detailText}
                            </pre>
                            <button
                              type="button"
                              onClick={() => copyAuditDetail(entry)}
                              className="mt-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                            >
                              {auditCopiedId === entry.id ? "Copied" : "Copy detail"}
                            </button>
                          </details>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
