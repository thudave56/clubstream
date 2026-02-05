import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Hash a PIN using scrypt
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a PIN against a hash
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const suppliedHashBuffer = scryptSync(pin, salt, 64);
  return timingSafeEqual(hashBuffer, suppliedHashBuffer);
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}
