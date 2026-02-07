"use client";

import React, { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import TimeDisplay from "./TimeDisplay";

interface EnhancedMatchCardProps {
  match: {
    id: string;
    teamDisplayName: string;
    opponentName: string;
    tournamentName: string | null;
    courtLabel: string | null;
    status: string;
    scheduledStart: string | null;
    youtubeWatchUrl: string | null;
    createdAt: string;
    // Score data (optional - for live/ended matches)
    currentSetNumber?: number;
    currentSetHomeScore?: number;
    currentSetAwayScore?: number;
  };
  onEndMatch: (matchId: string) => void;
}

/**
 * Enhanced match card with better visual hierarchy and information density.
 * Optimized for performance - no API calls, uses shared timer context.
 */
export default function EnhancedMatchCard({ match, onEndMatch }: EnhancedMatchCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const isPreLive = ['draft', 'scheduled', 'ready'].includes(match.status);
  const isLive = match.status === 'live';
  const isEnded = match.status === 'ended';
  const hasScore = match.currentSetNumber && (match.currentSetHomeScore !== undefined || match.currentSetAwayScore !== undefined);

  const handleCopyMatchLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const origin = window.location.origin;
      await navigator.clipboard.writeText(`${origin}/m/${match.id}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleEndMatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onEndMatch(match.id);
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all hover:border-slate-700 hover:bg-slate-900/60 hover:shadow-lg">
      {/* Header Row: Tournament + Status */}
      <div className="mb-3 flex items-center justify-between">
        {/* Tournament badge */}
        {match.tournamentName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-400">
            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
              <path d="M10 3L12.5 8.5L18 9L14 13L15 18.5L10 16L5 18.5L6 13L2 9L7.5 8.5L10 3Z" />
            </svg>
            {match.tournamentName}
          </span>
        )}

        {/* Live indicator with pulsing animation */}
        {isLive && (
          <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-red-400">
              Live
            </span>
          </div>
        )}

        {/* Status badge for non-live matches */}
        {!isLive && <StatusBadge status={match.status} />}
      </div>

      {/* Main Content: Team Matchup */}
      <a href={`/m/${match.id}`} className="block">
        <h3 className="mb-2 text-lg font-semibold leading-tight">
          <span className="text-blue-400">{match.teamDisplayName}</span>
          <span className="text-slate-500"> vs </span>
          <span className="text-slate-200">{match.opponentName}</span>
        </h3>
      </a>

      {/* Metadata Row: Court + Time */}
      {(match.courtLabel || match.scheduledStart) && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          {/* Court label */}
          {match.courtLabel && (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M10 2C6.13 2 3 5.13 3 9C3 13.17 10 20 10 20C10 20 17 13.17 17 9C17 5.13 13.87 2 10 2ZM10 11.5C8.62 11.5 7.5 10.38 7.5 9C7.5 7.62 8.62 6.5 10 6.5C11.38 6.5 12.5 7.62 12.5 9C12.5 10.38 11.38 11.5 10 11.5Z" />
              </svg>
              {match.courtLabel}
            </span>
          )}

          {/* Time display with countdown */}
          {match.scheduledStart && (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2ZM10 16C6.69 16 4 13.31 4 10C4 6.69 6.69 4 10 4C13.31 4 16 6.69 16 10C16 13.31 13.31 16 10 16ZM10.5 6H9V11L13.25 13.52L14 12.27L10.5 10.25V6Z" />
              </svg>
              <TimeDisplay
                scheduledStart={match.scheduledStart}
                status={match.status}
              />
            </span>
          )}
        </div>
      )}

      {/* Score Preview (Live/Ended matches only) */}
      {(isLive || isEnded) && hasScore && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-950/70 p-3">
          <span className="text-xs font-medium text-slate-400">
            Set {match.currentSetNumber}
          </span>
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span className="text-blue-400">{match.currentSetHomeScore || 0}</span>
            <span className="text-slate-600">-</span>
            <span className="text-emerald-400">{match.currentSetAwayScore || 0}</span>
          </div>
          {isLive && (
            <span className="ml-auto text-xs text-slate-500">live score</span>
          )}
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Primary action button (context-aware) */}
        {isPreLive && (
          <a
            href={`/m/${match.id}/stream`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M4 4C2.89 4 2 4.89 2 6V14C2 15.11 2.89 16 4 16H16C17.11 16 18 15.11 18 14V6C18 4.89 17.11 4 16 4H4ZM13 10L8 7V13L13 10Z" />
            </svg>
            Open Larix
          </a>
        )}

        {isLive && match.youtubeWatchUrl && (
          <a
            href={match.youtubeWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M8 5V15L15 10L8 5Z" />
            </svg>
            Watch Live
          </a>
        )}

        {isEnded && match.youtubeWatchUrl && (
          <a
            href={match.youtubeWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M8 5V15L15 10L8 5Z" />
            </svg>
            Watch Recording
          </a>
        )}

        {/* Copy link button */}
        <button
          onClick={handleCopyMatchLink}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            {copiedLink ? (
              <path d="M8 12L4 8L2.5 9.5L8 15L18 5L16.5 3.5L8 12Z" />
            ) : (
              <path d="M10 0C9.73 0 9.48 0.11 9.29 0.29L7.29 2.29C6.91 2.67 6.91 3.29 7.29 3.67L8.67 5.05L4.05 9.67L2.67 8.29C2.29 7.91 1.67 7.91 1.29 8.29L0.29 9.29C-0.09 9.67 -0.09 10.29 0.29 10.67L9.29 19.67C9.67 20.05 10.29 20.05 10.67 19.67L19.67 10.67C20.05 10.29 20.05 9.67 19.67 9.29L18.67 8.29C18.29 7.91 17.67 7.91 17.29 8.29L15.91 9.67L11.29 5.05L12.67 3.67C13.05 3.29 13.05 2.67 12.67 2.29L10.67 0.29C10.48 0.11 10.23 0 9.96 0H10Z" />
            )}
          </svg>
          {copiedLink ? 'Copied!' : 'Copy Link'}
        </button>

        <a
          href={`/m/${match.id}/score`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M3 3H17V5H3V3ZM3 8H11V10H3V8ZM3 13H17V15H3V13Z" />
          </svg>
          Open Scoring
        </a>

        {/* End match button (live only) */}
        {isLive && (
          <button
            onClick={handleEndMatch}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-red-600/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/20"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5 5H15V15H5V5Z" />
            </svg>
            End Match
          </button>
        )}
      </div>
    </div>
  );
}
