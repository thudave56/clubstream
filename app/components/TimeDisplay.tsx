"use client";

import React, { useMemo } from "react";
import { useCurrentTime } from "../contexts/TimeUpdateContext";

interface TimeDisplayProps {
  scheduledStart: string;
  status: string;
}

/**
 * Displays human-readable time information with countdown for upcoming matches.
 * Uses shared TimeUpdateContext to avoid creating individual timers.
 */
export default function TimeDisplay({ scheduledStart, status }: TimeDisplayProps) {
  const now = useCurrentTime();

  const timeText = useMemo(() => {
    const start = new Date(scheduledStart);
    const diffMs = start.getTime() - now;

    // For live or ended matches, just show the time
    if (status === 'live' || status === 'ended') {
      return start.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    // Match has already started
    if (diffMs < 0) {
      return 'Started';
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    // Less than 1 minute
    if (diffMins < 1) {
      return 'Starting now';
    }

    // Less than 1 hour - show minutes
    if (diffMins < 60) {
      return `Starts in ${diffMins} min`;
    }

    // Less than 24 hours - show hours and minutes
    if (diffHours < 24) {
      const remainingMins = diffMins % 60;
      return `Starts in ${diffHours}h ${remainingMins}m`;
    }

    // More than 24 hours - show full date/time
    return start.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }, [now, scheduledStart, status]);

  return <>{timeText}</>;
}
