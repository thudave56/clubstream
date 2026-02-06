"use client";

import { useState, useEffect, useRef } from "react";

interface MatchStreamStatusProps {
  matchId: string;
  onLive?: () => void;
}

export function MatchStreamStatus({ matchId, onLive }: MatchStreamStatusProps) {
  const [status, setStatus] = useState<string>("waiting");
  const [streamStatus, setStreamStatus] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/auto-live`, {
          method: "POST"
        });
        const data = await res.json();

        if (data.status === "live") {
          setStatus("live");
          setStreamStatus("Stream is live!");
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onLive?.();
        } else if (data.status === "already_live") {
          setStatus("live");
          setStreamStatus("Stream is live!");
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (data.status === "ended" || data.status === "canceled") {
          setStatus(data.status);
          setStreamStatus(`Match ${data.status}`);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (data.status === "waiting") {
          setStatus("waiting");
          if (data.streamStatus === "active") {
            setStreamStatus("Stream detected, going live...");
          } else if (data.streamStatus === "inactive") {
            setStreamStatus("Waiting for Larix to start streaming...");
          } else if (data.streamStatus === "throttled") {
            // Don't update display on throttle
          } else {
            setStreamStatus("Waiting for stream connection...");
          }
        } else if (data.status === "transition_failed") {
          setStreamStatus("Go-live transition failed. Retrying...");
        }
      } catch {
        // Silently retry on network errors
      }
    };

    // Start polling
    poll();
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [matchId, onLive]);

  const statusColors: Record<string, string> = {
    waiting: "border-yellow-900 bg-yellow-900/20 text-yellow-400",
    live: "border-green-900 bg-green-900/20 text-green-400",
    ended: "border-slate-700 bg-slate-800 text-slate-400",
    canceled: "border-red-900 bg-red-900/20 text-red-400"
  };

  const colorClass = statusColors[status] || statusColors.waiting;

  return (
    <div className={`rounded-lg border p-3 text-center text-sm ${colorClass}`}>
      {status === "live" && (
        <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
      )}
      {status === "waiting" && (
        <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
      )}
      {streamStatus || "Checking stream status..."}
    </div>
  );
}
