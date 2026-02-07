"use client";

import { useMemo, useState } from "react";

type ShareItem = {
  key: string;
  label: string;
  href: string;
  copyLabel: string;
  openInNewTab?: boolean;
};

function buildAbsoluteUrl(pathname: string) {
  if (typeof window === "undefined") return pathname;
  return `${window.location.origin}${pathname}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / permissions quirks.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "true");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

export default function MatchSharePanel({
  matchId,
  youtubeWatchUrl,
  includeLarixLauncher = false,
  title = "Share & Tools",
  description = "Open the tools you need and copy links to share with others."
}: {
  matchId: string;
  youtubeWatchUrl?: string | null;
  includeLarixLauncher?: boolean;
  title?: string;
  description?: string;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const items = useMemo<ShareItem[]>(() => {
    const base: ShareItem[] = [
      {
        key: "match",
        label: "Match page",
        href: `/m/${matchId}`,
        copyLabel: "Copy match link"
      },
      {
        key: "score",
        label: "Scoring",
        href: `/m/${matchId}/score`,
        copyLabel: "Copy scoring link"
      },
      {
        key: "overlay",
        label: "Overlay",
        href: `/m/${matchId}/overlay`,
        copyLabel: "Copy overlay link"
      }
    ];

    if (includeLarixLauncher) {
      base.unshift({
        key: "larix",
        label: "Larix launcher",
        href: `/m/${matchId}/stream`,
        copyLabel: "Copy Larix link"
      });
    }

    if (youtubeWatchUrl) {
      base.push({
        key: "youtube",
        label: "YouTube watch",
        href: youtubeWatchUrl,
        copyLabel: "Copy YouTube link",
        openInNewTab: true
      });
    }

    return base;
  }, [includeLarixLauncher, matchId, youtubeWatchUrl]);

  const handleCopy = async (item: ShareItem) => {
    const url =
      item.href.startsWith("/") ? buildAbsoluteUrl(item.href) : item.href;
    const ok = await copyText(url);
    if (!ok) return;
    setCopiedKey(item.key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-200">
                {item.label}
              </div>
              <div className="truncate text-xs text-slate-500">{item.href}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={item.href}
                target={item.openInNewTab ? "_blank" : undefined}
                rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                Open
              </a>
              <button
                type="button"
                onClick={() => handleCopy(item)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                {copiedKey === item.key ? "Copied" : item.copyLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

