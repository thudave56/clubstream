// Vitest setup file
// Load environment variables for tests
import { config } from 'dotenv';
import '@testing-library/jest-dom/vitest';

// Load from .env file (use actual local database for tests)
config({ path: '.env' });

// Fallback to defaults if not set
if (!process.env.APP_BASE_URL) {
  process.env.APP_BASE_URL = 'http://localhost:3000';
}

if (!process.env.ENCRYPTION_KEY) {
  // Test encryption key (64 hex characters / 32 bytes)
  process.env.ENCRYPTION_KEY = '0a273d28974c80e4cc96700c766ec8c1dcd1a6b643e0e824f1d86d4efc8f9832';
}
