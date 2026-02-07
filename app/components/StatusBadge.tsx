import React from "react";

interface StatusBadgeProps {
  status: string;
}

const statusLabels: Record<string, string> = {
  draft: "Upcoming",
  scheduled: "Scheduled",
  ready: "Ready",
  live: "Live",
  ended: "Final",
  canceled: "Canceled",
  error: "Needs Attention"
};

const statusStyles: Record<string, string> = {
  draft: "bg-yellow-900/40 text-yellow-400",
  scheduled: "bg-yellow-900/40 text-yellow-400",
  ready: "bg-blue-900/40 text-blue-400",
  live: "bg-green-900/40 text-green-400",
  ended: "bg-slate-800 text-slate-400",
  canceled: "bg-red-900/40 text-red-400",
  error: "bg-red-900/40 text-red-400"
};

function formatStatus(status: string) {
  const label = statusLabels[status];
  if (label) return label;
  const cleaned = status.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return "Unknown";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const className = statusStyles[status] || statusStyles.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${className}`}>
      {status === "live" && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
      )}
      {formatStatus(status)}
    </span>
  );
}
