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

export default function AdminDashboard() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
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
    } catch (err) {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
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
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Status</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  settings.oauthStatus === "connected"
                    ? "bg-green-900/40 text-green-400"
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
              <button
                disabled
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-500"
              >
                Connect YouTube (Coming in PR #3)
              </button>
            </div>
          </div>
        </section>

        {/* Stream Pool Status */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Stream Pool Status</h2>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="rounded-lg border border-slate-800 p-4">
                <div className="text-2xl font-bold text-green-400">0</div>
                <div className="mt-1 text-sm text-slate-400">Available</div>
              </div>
              <div className="rounded-lg border border-slate-800 p-4">
                <div className="text-2xl font-bold text-yellow-400">0</div>
                <div className="mt-1 text-sm text-slate-400">Reserved</div>
              </div>
              <div className="rounded-lg border border-slate-800 p-4">
                <div className="text-2xl font-bold text-blue-400">0</div>
                <div className="mt-1 text-sm text-slate-400">In Use</div>
              </div>
              <div className="rounded-lg border border-slate-800 p-4">
                <div className="text-2xl font-bold text-red-400">0</div>
                <div className="mt-1 text-sm text-slate-400">Stuck</div>
              </div>
            </div>
            <div className="pt-2">
              <button
                disabled
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-500"
              >
                Initialize Stream Pool (Coming in PR #4)
              </button>
            </div>
          </div>
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
