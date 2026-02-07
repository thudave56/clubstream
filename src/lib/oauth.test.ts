import {
  generateOAuthState,
  storeOAuthState,
  verifyOAuthState,
  deleteOAuthState
} from "./oauth";
import { db } from "@/db";
import { vi } from "vitest";

// Mock the database module so tests don't require a running PostgreSQL
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("@/db/schema", () => ({
  oauthStates: { state: "state" }
}));

describe("oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      const mockValues = vi.fn().mockResolvedValue(undefined);
      (db.insert as any).mockReturnValue({ values: mockValues });

      await storeOAuthState(state);

      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          state,
          expiresAt: expect.any(Date)
        })
      );

      // Verify the expiry is approximately 10 minutes from now
      const passedDate = mockValues.mock.calls[0][0].expiresAt as Date;
      const expectedExpiry = new Date(Date.now() + 10 * 60 * 1000);
      const timeDiff = Math.abs(passedDate.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(5000);
    });
  });

  describe("verifyOAuthState", () => {
    it("should return true for valid unexpired state", async () => {
      const state = generateOAuthState();
      const futureExpiry = new Date(Date.now() + 5 * 60 * 1000);

      const mockLimit = vi.fn().mockResolvedValue([
        { state, expiresAt: futureExpiry, createdAt: new Date() }
      ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const isValid = await verifyOAuthState(state);

      expect(isValid).toBe(true);
    });

    it("should return false for non-existent state", async () => {
      const state = generateOAuthState();

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const isValid = await verifyOAuthState(state);

      expect(isValid).toBe(false);
    });

    it("should return false and delete expired state", async () => {
      const state = generateOAuthState();
      const pastExpiry = new Date(Date.now() - 1000);

      const mockLimit = vi.fn().mockResolvedValue([
        { state, expiresAt: pastExpiry, createdAt: new Date() }
      ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      // Mock delete for cleanup of expired state
      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      (db.delete as any).mockReturnValue({ where: mockDeleteWhere });

      const isValid = await verifyOAuthState(state);

      expect(isValid).toBe(false);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("deleteOAuthState", () => {
    it("should delete state from database", async () => {
      const state = generateOAuthState();

      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      (db.delete as any).mockReturnValue({ where: mockDeleteWhere });

      await deleteOAuthState(state);

      expect(db.delete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("should not throw error if state doesn't exist", async () => {
      const state = generateOAuthState();

      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      (db.delete as any).mockReturnValue({ where: mockDeleteWhere });

      await expect(deleteOAuthState(state)).resolves.not.toThrow();
    });
  });
});
