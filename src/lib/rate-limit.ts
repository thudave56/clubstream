/**
 * Simple in-memory rate limiter for admin login attempts
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if an IP is rate limited
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) {
    return false;
  }

  // Reset if window expired
  if (now > entry.resetAt) {
    attempts.delete(ip);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

/**
 * Record a login attempt
 */
export function recordAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS
    });
  } else {
    entry.count++;
  }
}

/**
 * Get time until rate limit resets (in seconds)
 */
export function getResetTime(ip: string): number {
  const entry = attempts.get(ip);
  if (!entry) {
    return 0;
  }

  const now = Date.now();
  if (now > entry.resetAt) {
    return 0;
  }

  return Math.ceil((entry.resetAt - now) / 1000);
}

/**
 * Clear attempts for an IP (e.g., after successful login)
 */
export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

/**
 * Reset all rate limit attempts (for testing only)
 */
export function resetAllAttempts(): void {
  attempts.clear();
}

/**
 * Factory function to create a rate limiter with custom configuration.
 * Each instance maintains its own independent state.
 */
export function createRateLimiter(options: {
  maxAttempts: number;
  windowMs: number;
}) {
  const store = new Map<string, RateLimitEntry>();

  return {
    isRateLimited(key: string): boolean {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry) return false;
      if (now > entry.resetAt) {
        store.delete(key);
        return false;
      }
      return entry.count >= options.maxAttempts;
    },

    recordAttempt(key: string): void {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + options.windowMs });
      } else {
        entry.count++;
      }
    },

    getResetTime(key: string): number {
      const entry = store.get(key);
      if (!entry) return 0;
      const now = Date.now();
      if (now > entry.resetAt) return 0;
      return Math.ceil((entry.resetAt - now) / 1000);
    },

    clearAttempts(key: string): void {
      store.delete(key);
    },

    resetAll(): void {
      store.clear();
    }
  };
}
