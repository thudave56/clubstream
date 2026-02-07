import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TimeDisplay from './TimeDisplay';
import { TimeUpdateProvider } from '../contexts/TimeUpdateContext';

const renderWithContext = (component: React.ReactElement) => {
  return render(<TimeUpdateProvider>{component}</TimeUpdateProvider>);
};

describe('TimeDisplay', () => {
  it('shows time for live matches', () => {
    const scheduledStart = new Date('2026-02-07T14:30:00Z').toISOString();

    renderWithContext(
      <TimeDisplay scheduledStart={scheduledStart} status="live" />
    );

    // Should show formatted time, not countdown
    expect(screen.getByText(/\d+:\d+/)).toBeInTheDocument();
  });

  it('shows time for ended matches', () => {
    const scheduledStart = new Date('2026-02-07T14:30:00Z').toISOString();

    renderWithContext(
      <TimeDisplay scheduledStart={scheduledStart} status="ended" />
    );

    // Should show formatted time, not countdown
    expect(screen.getByText(/\d+:\d+/)).toBeInTheDocument();
  });

  it('shows "Starting now" for matches starting in less than 1 minute', () => {
    // Set time to 30 seconds from now
    const scheduledStart = new Date(Date.now() + 30000).toISOString();

    renderWithContext(
      <TimeDisplay scheduledStart={scheduledStart} status="scheduled" />
    );

    expect(screen.getByText('Starting now')).toBeInTheDocument();
  });

  it('shows minutes countdown for matches starting soon', () => {
    // Set time to 15 minutes from now
    const scheduledStart = new Date(Date.now() + 15 * 60000).toISOString();

    renderWithContext(
      <TimeDisplay scheduledStart={scheduledStart} status="scheduled" />
    );

    expect(screen.getByText(/Starts in \d+ min/)).toBeInTheDocument();
  });

  it('shows hours and minutes for matches starting in a few hours', () => {
    // Set time to 2 hours from now
    const scheduledStart = new Date(Date.now() + 2 * 3600000).toISOString();

    renderWithContext(
      <TimeDisplay scheduledStart={scheduledStart} status="scheduled" />
    );

    expect(screen.getByText(/Starts in \d+h \d+m/)).toBeInTheDocument();
  });

  it('shows full date for matches more than 24 hours away', () => {
    // Set time to 2 days from now
    const scheduledStart = new Date(Date.now() + 48 * 3600000).toISOString();

    renderWithContext(
      <TimeDisplay scheduledStart={scheduledStart} status="scheduled" />
    );

    // Should show month and day
    // Locale can render this as word-based (e.g. "Feb 9") or numeric (e.g. "2/9/2026")
    expect(
      screen.getByText(/(\w+ \d+|\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?)/)
    ).toBeInTheDocument();
  });

  it('shows "Started" for past scheduled times', () => {
    // Set time to 10 minutes ago
    const scheduledStart = new Date(Date.now() - 10 * 60000).toISOString();

    renderWithContext(
      <TimeDisplay scheduledStart={scheduledStart} status="scheduled" />
    );

    expect(screen.getByText('Started')).toBeInTheDocument();
  });
});
