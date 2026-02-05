import { isRateLimited, recordAttempt, getResetTime, clearAttempts } from './rate-limit';

describe('Rate Limiting', () => {
  const testIp = '192.168.1.1';

  beforeEach(() => {
    // Clear attempts for test IP before each test
    clearAttempts(testIp);
  });

  describe('recordAttempt', () => {
    it('should record a login attempt', () => {
      expect(isRateLimited(testIp)).toBe(false);

      recordAttempt(testIp);

      // Should not be rate limited after 1 attempt
      expect(isRateLimited(testIp)).toBe(false);
    });

    it('should track multiple attempts', () => {
      // Record 4 attempts (below limit)
      for (let i = 0; i < 4; i++) {
        recordAttempt(testIp);
        expect(isRateLimited(testIp)).toBe(false);
      }

      // 5th attempt should trigger rate limit
      recordAttempt(testIp);
      expect(isRateLimited(testIp)).toBe(true);
    });
  });

  describe('isRateLimited', () => {
    it('should return false for new IP', () => {
      const newIp = '10.0.0.1';
      expect(isRateLimited(newIp)).toBe(false);
    });

    it('should return true after max attempts', () => {
      // Record 5 attempts (at limit)
      for (let i = 0; i < 5; i++) {
        recordAttempt(testIp);
      }

      expect(isRateLimited(testIp)).toBe(true);
    });

    it('should handle different IPs independently', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // Max out ip1
      for (let i = 0; i < 5; i++) {
        recordAttempt(ip1);
      }

      expect(isRateLimited(ip1)).toBe(true);
      expect(isRateLimited(ip2)).toBe(false);
    });
  });

  describe('getResetTime', () => {
    it('should return 0 for IP with no attempts', () => {
      const newIp = '10.0.0.2';
      expect(getResetTime(newIp)).toBe(0);
    });

    it('should return time until reset', () => {
      recordAttempt(testIp);
      const resetTime = getResetTime(testIp);

      expect(resetTime).toBeGreaterThan(0);
      expect(resetTime).toBeLessThanOrEqual(15 * 60); // Max 15 minutes
    });

    it('should return 0 after window expires', () => {
      vi.useFakeTimers();

      recordAttempt(testIp);

      // Fast-forward 16 minutes (past the 15-minute window)
      vi.advanceTimersByTime(16 * 60 * 1000);

      expect(getResetTime(testIp)).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('clearAttempts', () => {
    it('should clear attempts for an IP', () => {
      // Max out attempts
      for (let i = 0; i < 5; i++) {
        recordAttempt(testIp);
      }

      expect(isRateLimited(testIp)).toBe(true);

      // Clear attempts
      clearAttempts(testIp);

      expect(isRateLimited(testIp)).toBe(false);
      expect(getResetTime(testIp)).toBe(0);
    });

    it('should not affect other IPs', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // Record attempts for both IPs
      for (let i = 0; i < 5; i++) {
        recordAttempt(ip1);
        recordAttempt(ip2);
      }

      expect(isRateLimited(ip1)).toBe(true);
      expect(isRateLimited(ip2)).toBe(true);

      // Clear only ip1
      clearAttempts(ip1);

      expect(isRateLimited(ip1)).toBe(false);
      expect(isRateLimited(ip2)).toBe(true);
    });
  });

  describe('Window reset behavior', () => {
    it('should reset after window expires', () => {
      vi.useFakeTimers();

      // Record 5 attempts
      for (let i = 0; i < 5; i++) {
        recordAttempt(testIp);
      }

      expect(isRateLimited(testIp)).toBe(true);

      // Fast-forward past the 15-minute window
      vi.advanceTimersByTime(16 * 60 * 1000);

      // Should no longer be rate limited
      expect(isRateLimited(testIp)).toBe(false);

      vi.useRealTimers();
    });

    it('should reset counter when recording attempt after window expires', () => {
      vi.useFakeTimers();

      // Record 3 attempts
      for (let i = 0; i < 3; i++) {
        recordAttempt(testIp);
      }

      // Fast-forward past the window
      vi.advanceTimersByTime(16 * 60 * 1000);

      // Record new attempt - should reset counter
      recordAttempt(testIp);

      // Should be at 1 attempt now, not 4
      expect(isRateLimited(testIp)).toBe(false);

      vi.useRealTimers();
    });
  });
});
