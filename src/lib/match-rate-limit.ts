import { createRateLimiter } from "./rate-limit";

/** Rate limiter for public match creation: 10 matches per hour per IP */
export const matchCreationLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000
});

/** Rate limiter for PIN verification attempts: 5 per 15 minutes per IP */
export const pinAttemptLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000
});
