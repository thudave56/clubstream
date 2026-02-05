import { describe, it, expect, beforeEach } from "vitest";
import {
  generateOAuthState,
  storeOAuthState,
  verifyOAuthState,
  deleteOAuthState
} from "./oauth";
import { db } from "@/db";
import { oauthStates } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("oauth", () => {
  // Clean up before each test
  beforeEach(async () => {
    await db.delete(oauthStates);
  });

  describe("generateOAuthState", () => {
    it("should generate a 64-character hex string", () => {
      const state = generateOAuthState();

      expect(state).toHaveLength(64);
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should generate unique states", () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();

      expect(state1).not.toBe(state2);
    });
  });

  describe("storeOAuthState", () => {
    it("should store state in database with 10-minute expiry", async () => {
      const state = generateOAuthState();

      await storeOAuthState(state);

      const result = await db
        .select()
        .from(oauthStates)
        .where(eq(oauthStates.state, state));

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe(state);

      // Check expiry is approximately 10 minutes from now (within 5 seconds)
      const expectedExpiry = new Date(Date.now() + 10 * 60 * 1000);
      const actualExpiry = result[0].expiresAt;
      const timeDiff = Math.abs(
        actualExpiry.getTime() - expectedExpiry.getTime()
      );

      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });
  });

  describe("verifyOAuthState", () => {
    it("should return true for valid unexpired state", async () => {
      const state = generateOAuthState();
      await storeOAuthState(state);

      const isValid = await verifyOAuthState(state);

      expect(isValid).toBe(true);
    });

    it("should return false for non-existent state", async () => {
      const state = generateOAuthState();

      const isValid = await verifyOAuthState(state);

      expect(isValid).toBe(false);
    });

    it("should return false and delete expired state", async () => {
      const state = generateOAuthState();

      // Insert expired state directly
      await db.insert(oauthStates).values({
        state,
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      });

      const isValid = await verifyOAuthState(state);

      expect(isValid).toBe(false);

      // Verify state was deleted
      const result = await db
        .select()
        .from(oauthStates)
        .where(eq(oauthStates.state, state));

      expect(result).toHaveLength(0);
    });
  });

  describe("deleteOAuthState", () => {
    it("should delete state from database", async () => {
      const state = generateOAuthState();
      await storeOAuthState(state);

      // Verify it exists
      let result = await db
        .select()
        .from(oauthStates)
        .where(eq(oauthStates.state, state));
      expect(result).toHaveLength(1);

      // Delete it
      await deleteOAuthState(state);

      // Verify it's gone
      result = await db
        .select()
        .from(oauthStates)
        .where(eq(oauthStates.state, state));
      expect(result).toHaveLength(0);
    });

    it("should not throw error if state doesn't exist", async () => {
      const state = generateOAuthState();

      await expect(deleteOAuthState(state)).resolves.not.toThrow();
    });
  });
});
