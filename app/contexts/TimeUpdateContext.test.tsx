import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeUpdateProvider, useCurrentTime } from '../contexts/TimeUpdateContext';

describe('TimeUpdateContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('provides initial timestamp', () => {
    const { result } = renderHook(() => useCurrentTime(), {
      wrapper: TimeUpdateProvider
    });

    expect(typeof result.current).toBe('number');
    expect(result.current).toBeGreaterThan(0);
  });

  it('updates timestamp every 60 seconds', async () => {
    const { result } = renderHook(() => useCurrentTime(), {
      wrapper: TimeUpdateProvider
    });

    const initialTime = result.current;

    // Fast forward 59 seconds - should not update yet
    act(() => {
      vi.advanceTimersByTime(59000);
    });
    expect(result.current).toBe(initialTime);

    // Fast forward 1 more second (total 60s) - should update now
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeGreaterThan(initialTime);
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useCurrentTime(), {
      wrapper: TimeUpdateProvider
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
