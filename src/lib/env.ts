let validated = false;

export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const errors: string[] = [];
  const warnings: string[] = [];

  const isProduction = process.env.NODE_ENV === "production";

  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required");
  }

  if (!process.env.ENCRYPTION_KEY) {
    errors.push("ENCRYPTION_KEY is required");
  } else if (!/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
    errors.push("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }

  if (!process.env.APP_BASE_URL) {
    warnings.push("APP_BASE_URL is not set — defaulting to localhost");
  } else if (isProduction && process.env.APP_BASE_URL.includes("localhost")) {
    warnings.push("APP_BASE_URL contains 'localhost' in production");
  }

  if (isProduction && process.env.DEFAULT_ADMIN_PIN === "1234") {
    warnings.push("DEFAULT_ADMIN_PIN is still '1234' in production — change it");
  }

  for (const w of warnings) {
    console.warn(`[env] WARNING: ${w}`);
  }

  if (errors.length > 0) {
    const msg = errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(`Missing or invalid environment variables:\n${msg}`);
  }
}
