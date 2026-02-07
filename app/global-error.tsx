"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center p-6">
          <section className="w-full max-w-md rounded-xl border border-red-900 bg-red-950/20 p-6 text-center">
            <h1 className="text-2xl font-semibold text-red-300">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              The error has been captured. You can retry this action.
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
