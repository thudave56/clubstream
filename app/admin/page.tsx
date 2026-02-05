"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (formData: FormData) => {
    setError("");

    startTransition(async () => {
      const result = await loginAction(formData);

      // If there's an error, display it
      // If successful, the server action will redirect
      if (result.error) {
        setError(result.error);
      }
    });
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

        <form action={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="pin" className="block text-sm font-medium">
              Admin PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter PIN"
              required
              disabled={isPending}
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
            disabled={isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
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
