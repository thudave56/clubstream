import { hashPin, verifyPin, generateSessionToken } from './auth';

describe('Auth Utilities', () => {
  describe('hashPin', () => {
    it('should hash a PIN', () => {
      const pin = '1234';
      const hash = hashPin(pin);

      expect(hash).toBeTruthy();
      expect(hash).toContain(':');
      expect(hash.split(':').length).toBe(2);
    });

    it('should generate different hashes for the same PIN', () => {
      const pin = '1234';
      const hash1 = hashPin(pin);
      const hash2 = hashPin(pin);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle different PIN lengths', () => {
      const pins = ['1', '12', '1234', '123456789'];

      pins.forEach(pin => {
        const hash = hashPin(pin);
        expect(hash).toBeTruthy();
        expect(hash).toContain(':');
      });
    });
  });

  describe('verifyPin', () => {
    it('should verify correct PIN', () => {
      const pin = '1234';
      const hash = hashPin(pin);

      expect(verifyPin(pin, hash)).toBe(true);
    });

    it('should reject incorrect PIN', () => {
      const correctPin = '1234';
      const incorrectPin = '5678';
      const hash = hashPin(correctPin);

      expect(verifyPin(incorrectPin, hash)).toBe(false);
    });

    it('should handle case sensitivity', () => {
      const pin = 'AbCd';
      const hash = hashPin(pin);

      expect(verifyPin(pin, hash)).toBe(true);
      expect(verifyPin('ABCD', hash)).toBe(false);
      expect(verifyPin('abcd', hash)).toBe(false);
    });

    it('should reject empty strings', () => {
      const pin = '1234';
      const hash = hashPin(pin);

      expect(verifyPin('', hash)).toBe(false);
    });
  });

  describe('generateSessionToken', () => {
    it('should generate a session token', () => {
      const token = generateSessionToken();

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate hex strings', () => {
      const token = generateSessionToken();
      const hexRegex = /^[0-9a-f]+$/;

      expect(hexRegex.test(token)).toBe(true);
    });
  });
});
