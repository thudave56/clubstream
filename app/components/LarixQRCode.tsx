"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface LarixQRCodeProps {
  larixUrl: string;
  matchTitle: string;
}

export function LarixQRCode({ larixUrl, matchTitle }: LarixQRCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(larixUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-lg font-semibold text-slate-100">{matchTitle}</h3>

      <div className="rounded-lg bg-white p-4">
        <QRCodeSVG value={larixUrl} size={200} level="M" />
      </div>

      <p className="text-center text-sm text-slate-400">
        Scan with phone camera to open Larix and start streaming
      </p>

      <div className="w-full space-y-2">
        <div className="rounded border border-slate-700 bg-slate-950 p-3">
          <p className="break-all font-mono text-xs text-slate-400">{larixUrl}</p>
        </div>

        <button
          onClick={handleCopy}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          {copied ? "Copied!" : "Copy Larix URL"}
        </button>
      </div>
    </div>
  );
}
