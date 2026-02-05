import { randomBytes } from "crypto";
import { db } from "@/db";
import { oauthStates } from "@/db/schema";
import { eq } from "drizzle-orm";

const STATE_EXPIRY_MINUTES = 10;

/**
 * Generate a cryptographically secure OAuth state token
 * @returns 64-character hex string (32 bytes)
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Store OAuth state in database with 10-minute expiry
 * @param state - The OAuth state token to store
 */
export async function storeOAuthState(state: string): Promise<void> {
  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(oauthStates).values({
    state,
    expiresAt
  });
}

/**
 * Verify that an OAuth state token exists and is not expired
 * @param state - The OAuth state token to verify
 * @returns true if state is valid and not expired, false otherwise
 */
export async function verifyOAuthState(state: string): Promise<boolean> {
  const result = await db
    .select()
    .from(oauthStates)
    .where(eq(oauthStates.state, state))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  const stateRecord = result[0];

  // Check if state is expired
  if (stateRecord.expiresAt < new Date()) {
    // Clean up expired state
    await db.delete(oauthStates).where(eq(oauthStates.state, state));
    return false;
  }

  return true;
}

/**
 * Delete an OAuth state token from the database
 * @param state - The OAuth state token to delete
 */
export async function deleteOAuthState(state: string): Promise<void> {
  await db.delete(oauthStates).where(eq(oauthStates.state, state));
}
