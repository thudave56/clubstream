// Vitest setup file
// Load environment variables for tests
import { config } from 'dotenv';

config({ path: '.env.test' });

// Set test environment variables if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/clubstream_test';
}

if (!process.env.APP_BASE_URL) {
  process.env.APP_BASE_URL = 'http://localhost:3000';
}
