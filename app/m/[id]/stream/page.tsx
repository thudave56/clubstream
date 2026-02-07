"use client";

import { useState, useEffect } from "react";
import { LarixQRCode } from "../../../components/LarixQRCode";
import { MatchStreamStatus } from "../../../components/MatchStreamStatus";

interface StreamPageProps {
  params: { id: string };
}

export default function StreamPage({ params }: StreamPageProps) {
  const [larixUrl, setLarixUrl] = useState<string | null>(null);
  const [matchTitle, setMatchTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Detect desktop browser
    const ua = navigator.userAgent;
    const mobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    setIsDesktop(!mobile);

    const platform =
      /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "";

    // Fetch Larix URL
    const query = platform ? `?platform=${platform}` : "";
    fetch(`/api/matches/${params.id}/larix${query}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => {
        setLarixUrl(data.larixUrl);
        setMatchTitle(data.matchTitle);
      })
      .catch(() => {
        setError(
          "Could not load stream information. The match may have ended or been canceled."
        );
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleOpenLarix = () => {
    if (!larixUrl) return;
    window.location.href = larixUrl;

    // After 1 second, if still visible, show install prompt
    setTimeout(() => {
      setShowInstallPrompt(true);
    }, 1000);
  };

  if (loading) {
    return (
      <main className="space-y-6">
        <a
          className="text-sm text-slate-400 hover:text-slate-300"
          href={`/m/${params.id}`}
        >
          &larr; Back to match
        </a>
        <p className="text-slate-400">Loading stream information...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-6">
        <a
          className="text-sm text-slate-400 hover:text-slate-300"
          href={`/m/${params.id}`}
        >
          &larr; Back to match
        </a>
        <div className="rounded-lg border border-red-900 bg-red-900/20 p-4 text-sm text-red-400">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <a
        className="text-sm text-slate-400 hover:text-slate-300"
        href={`/m/${params.id}`}
      >
        &larr; Back to match
      </a>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Start Streaming</h1>
        <p className="text-slate-400">{matchTitle}</p>
      </div>

      {/* Stream status */}
      <MatchStreamStatus matchId={params.id} />

      {/* Desktop: show QR code prominently */}
      {isDesktop && larixUrl && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="mb-4 text-center text-sm text-slate-400">
              Scan this QR code from your phone to open Larix Broadcaster
            </p>
            <LarixQRCode larixUrl={larixUrl} matchTitle={matchTitle} />
          </div>
        </div>
      )}

      {/* Mobile: show Open Larix button */}
      {!isDesktop && (
        <div className="space-y-4">
          <button
            onClick={handleOpenLarix}
            className="w-full rounded-lg bg-blue-600 px-4 py-4 text-lg font-medium text-white hover:bg-blue-700"
          >
            Open Larix Broadcaster
          </button>

          {/* Install prompt (shown after failed deep link attempt) */}
          {showInstallPrompt && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center">
              <p className="mb-4 text-sm font-medium text-slate-200">
                Don&apos;t have Larix Broadcaster?
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href="https://apps.apple.com/app/larix-broadcaster/id1042474385"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Download for iOS
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.softvelum.larixbroadcaster"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Download for Android
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Install Larix Broadcaster, then come back and tap &ldquo;Open Larix
                Broadcaster&rdquo; again.
              </p>
            </div>
          )}

          {/* Also show QR code on mobile for convenience */}
          {larixUrl && (
            <LarixQRCode larixUrl={larixUrl} matchTitle={matchTitle} />
          )}
        </div>
      )}
    </main>
  );
}
