"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include"
      });

      const data = await response.json();

      if (response.ok) {
        // Use window.location for full page reload to ensure cookie is set
        window.location.href = "/admin/dashboard";
      } else if (response.status === 429) {
        setError(`Too many attempts. Please try again in ${data.retryAfter} seconds.`);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Admin Login</h1>
          <p className="mt-2 text-slate-400">
            Enter your admin PIN to access the control panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="pin" className="block text-sm font-medium">
              Admin PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter PIN"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-900 bg-red-900/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center text-sm text-slate-500">
          <p>The admin PIN is configured during initial setup.</p>
          <p className="mt-1">
            Contact your system administrator if you need assistance.
          </p>
        </div>
      </div>
    </main>
  );
}
