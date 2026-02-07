import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EnhancedMatchCard from './EnhancedMatchCard';
import { TimeUpdateProvider } from '../contexts/TimeUpdateContext';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});

const renderWithContext = (component: React.ReactElement) => {
  return render(<TimeUpdateProvider>{component}</TimeUpdateProvider>);
};

const mockMatch = {
  id: 'match-123',
  teamDisplayName: '16U Black',
  opponentName: 'ACME Volleyball',
  tournamentName: 'NEQ Boston',
  courtLabel: 'Court 4',
  status: 'scheduled',
  scheduledStart: new Date(Date.now() + 30 * 60000).toISOString(), // 30 min from now
  youtubeWatchUrl: 'https://youtube.com/watch?v=test123',
  createdAt: new Date().toISOString()
};

describe('EnhancedMatchCard', () => {
  it('renders basic match information', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard match={mockMatch} onEndMatch={onEndMatch} />
    );

    expect(screen.getByText('16U Black')).toBeInTheDocument();
    expect(screen.getByText('ACME Volleyball')).toBeInTheDocument();
    expect(screen.getByText('NEQ Boston')).toBeInTheDocument();
    expect(screen.getByText('Court 4')).toBeInTheDocument();
  });

  it('shows tournament badge when tournament is assigned', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard match={mockMatch} onEndMatch={onEndMatch} />
    );

    expect(screen.getByText('NEQ Boston')).toBeInTheDocument();
    expect(screen.getByText('NEQ Boston').closest('span')).toHaveClass('bg-blue-900/30');
  });

  it('does not show tournament badge when no tournament', () => {
    const matchWithoutTournament = { ...mockMatch, tournamentName: null };
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard match={matchWithoutTournament} onEndMatch={onEndMatch} />
    );

    const tournamentBadge = screen.queryByText('NEQ Boston');
    expect(tournamentBadge).not.toBeInTheDocument();
  });

  it('shows "Start Streaming" button for pre-live matches', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard match={{ ...mockMatch, status: 'draft' }} onEndMatch={onEndMatch} />
    );

    expect(screen.getByText('Start Streaming')).toBeInTheDocument();
    expect(screen.getByText('Start Streaming').closest('a')).toHaveAttribute(
      'href',
      '/m/match-123/stream'
    );
  });

  it('shows "Watch Live" button for live matches', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard
        match={{ ...mockMatch, status: 'live' }}
        onEndMatch={onEndMatch}
      />
    );

    expect(screen.getByText('Watch Live')).toBeInTheDocument();
    expect(screen.getByText('Watch Live').closest('a')).toHaveAttribute(
      'href',
      'https://youtube.com/watch?v=test123'
    );
  });

  it('shows "Watch Recording" button for ended matches', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard
        match={{ ...mockMatch, status: 'ended' }}
        onEndMatch={onEndMatch}
      />
    );

    expect(screen.getByText('Watch Recording')).toBeInTheDocument();
  });

  it('shows live indicator with pulsing animation for live matches', () => {
    const onEndMatch = vi.fn();

    const { container } = renderWithContext(
      <EnhancedMatchCard
        match={{ ...mockMatch, status: 'live' }}
        onEndMatch={onEndMatch}
      />
    );

    expect(screen.getByText('Live')).toBeInTheDocument();
    // Check for pulsing animation class
    const pulsingElement = container.querySelector('.animate-ping');
    expect(pulsingElement).toBeInTheDocument();
  });

  it('shows score preview for live matches with score data', () => {
    const matchWithScore = {
      ...mockMatch,
      status: 'live',
      currentSetNumber: 2,
      currentSetHomeScore: 15,
      currentSetAwayScore: 12
    };
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard match={matchWithScore} onEndMatch={onEndMatch} />
    );

    expect(screen.getByText('Set 2')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('live score')).toBeInTheDocument();
  });

  it('shows score preview for ended matches with score data', () => {
    const matchWithScore = {
      ...mockMatch,
      status: 'ended',
      currentSetNumber: 3,
      currentSetHomeScore: 25,
      currentSetAwayScore: 23
    };
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard match={matchWithScore} onEndMatch={onEndMatch} />
    );

    expect(screen.getByText('Set 3')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    // Should NOT show "live score" for ended matches
    expect(screen.queryByText('live score')).not.toBeInTheDocument();
  });

  it('copies match link to clipboard when Copy Link is clicked', async () => {
    const onEndMatch = vi.fn();
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true
    });

    renderWithContext(
      <EnhancedMatchCard match={mockMatch} onEndMatch={onEndMatch} />
    );

    const copyButton = screen.getByText('Copy Link');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3000/m/match-123'
      );
    });

    // Should show "Copied!" text
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('shows End Match button for live matches', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard
        match={{ ...mockMatch, status: 'live' }}
        onEndMatch={onEndMatch}
      />
    );

    expect(screen.getByText('End Match')).toBeInTheDocument();
  });

  it('calls onEndMatch when End Match is clicked', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard
        match={{ ...mockMatch, status: 'live' }}
        onEndMatch={onEndMatch}
      />
    );

    const endButton = screen.getByText('End Match');
    fireEvent.click(endButton);

    expect(onEndMatch).toHaveBeenCalledWith('match-123');
  });

  it('does not show End Match button for pre-live matches', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard
        match={{ ...mockMatch, status: 'draft' }}
        onEndMatch={onEndMatch}
      />
    );

    expect(screen.queryByText('End Match')).not.toBeInTheDocument();
  });

  it('links to match detail page when card header is clicked', () => {
    const onEndMatch = vi.fn();

    renderWithContext(
      <EnhancedMatchCard match={mockMatch} onEndMatch={onEndMatch} />
    );

    const matchLink = screen.getByText('16U Black').closest('a');
    expect(matchLink).toHaveAttribute('href', '/m/match-123');
  });
});
