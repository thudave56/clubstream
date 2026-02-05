import { encryptToken, decryptToken } from "./crypto";

describe("crypto", () => {
  describe("encryptToken and decryptToken", () => {
    it("should encrypt and decrypt a token correctly", () => {
      const originalToken = "test-access-token-12345";

      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it("should produce different encrypted values for same input", () => {
      const token = "test-token";

      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // Encrypted values should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same value
      expect(decryptToken(encrypted1)).toBe(token);
      expect(decryptToken(encrypted2)).toBe(token);
    });

    it("should handle special characters and Unicode", () => {
      const token = "token-with-special-chars!@#$%^&*()_+{}[]|\\:;\"'<>,.?/~`éñ中";

      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });

    it("should throw error for invalid encrypted token format", () => {
      expect(() => decryptToken("invalid-format")).toThrow(
        "Invalid encrypted token format"
      );
    });

    it("should throw error for corrupted encrypted token", () => {
      const encrypted = encryptToken("test-token");
      const corrupted = encrypted.replace(/[0-9a-f]/, "x");

      expect(() => decryptToken(corrupted)).toThrow();
    });
  });

  describe("getEncryptionKey errors", () => {
    it("should throw error if ENCRYPTION_KEY not set", () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encryptToken("test")).toThrow(
        "ENCRYPTION_KEY environment variable not set"
      );

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it("should throw error if ENCRYPTION_KEY is wrong length", () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = "short";

      expect(() => encryptToken("test")).toThrow(
        "ENCRYPTION_KEY must be 64 hex characters (32 bytes)"
      );

      process.env.ENCRYPTION_KEY = originalKey;
    });
  });
});
