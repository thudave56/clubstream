"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    loadSettings();

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
      const response = await fetch("/api/admin/settings");

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

  const loadPoolStatus = async () => {
    try {
      const response = await fetch("/api/admin/stream-pool/status");

      if (!response.ok) {
        throw new Error("Failed to load pool status");
      }

      const data = await response.json();
      setPoolStatus(data);
    } catch (err) {
      console.error("Pool status error:", err);
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

        {/* OAuth Status */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
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
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
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

              <div>
                <button
                  onClick={handleInitializePool}
                  disabled={poolLoading}
                  className="w-full rounded-lg border border-blue-700 bg-blue-900/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-900/40 disabled:opacity-50"
                >
                  {poolLoading ? "Creating..." : "Initialize Stream Pool"}
                </button>

                {poolStatus && poolStatus.total > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    Pool already has {poolStatus.total} stream{poolStatus.total !== 1 ? "s" : ""}. This will add more.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Security Settings */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
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
                      <span className="text-green-400">✓ Configured</span>
                    ) : (
                      <span className="text-red-400">✗ Not Set</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Create PIN</div>
                  <div className="mt-1 text-lg font-semibold">
                    {settings.hasCreatePin ? (
                      <span className="text-green-400">✓ Configured</span>
                    ) : (
                      <span className="text-slate-500">Not Set</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Audit Log */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <div className="mt-4">
            <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-400">
              Audit log viewer coming soon
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
