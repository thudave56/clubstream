"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Shared time update context to avoid multiple setInterval timers.
 * All components that need current time for countdown calculations
 * should use this single source of truth.
 */

const TimeUpdateContext = createContext<number>(Date.now());

interface TimeUpdateProviderProps {
  children: ReactNode;
}

export function TimeUpdateProvider({ children }: TimeUpdateProviderProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Single interval for entire app - updates every 60 seconds
    // This prevents multiple components from creating their own intervals
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // Every 60 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <TimeUpdateContext.Provider value={now}>
      {children}
    </TimeUpdateContext.Provider>
  );
}

export function useCurrentTime(): number {
  return useContext(TimeUpdateContext);
}
