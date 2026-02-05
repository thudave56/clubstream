import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateSessionToken } from "./auth";

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a new admin session
 */
export async function createSession(): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    sessionToken,
    expiresAt
  });

  return sessionToken;
}

/**
 * Get session token from cookie
 */
export function getSessionToken(): string | undefined {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token;
}

/**
 * Validate a session token
 */
export async function validateSession(token: string): Promise<boolean> {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionToken, token))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  const session = result[0];

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await db.delete(sessions).where(eq(sessions.sessionToken, token));
    return false;
  }

  return true;
}

/**
 * Check if current request has valid admin session
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = getSessionToken();

  // Debug: Log authentication check
  console.log("[isAuthenticated] Checking auth:", {
    hasToken: !!token,
    tokenLength: token?.length,
    env: process.env.NODE_ENV
  });

  if (!token) {
    console.log("[isAuthenticated] No token found in cookies");
    return false;
  }

  const isValid = await validateSession(token);
  console.log("[isAuthenticated] Validation result:", isValid);

  return isValid;
}

/**
 * Delete a session
 */
export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.sessionToken, token));
}

/**
 * Set session cookie
 */
export function setSessionCookie(token: string): void {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/"
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(): void {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
