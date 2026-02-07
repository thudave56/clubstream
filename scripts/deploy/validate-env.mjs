const REQUIRED = ["DATABASE_URL", "ENCRYPTION_KEY", "APP_BASE_URL"];
const hasApi = Boolean(process.env.RENDER_API_KEY) && Boolean(process.env.RENDER_SERVICE_ID);
const errors = [];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    errors.push(`Missing ${key}`);
  }
}

if (!hasApi) {
  errors.push("Missing Render API credentials: provide RENDER_API_KEY and RENDER_SERVICE_ID");
}

if (process.env.RUN_DISCORD_NOTIFY === "true" && !process.env.DISCORD_WEBHOOK_URL) {
  errors.push("RUN_DISCORD_NOTIFY is true but DISCORD_WEBHOOK_URL is missing");
}

if (errors.length > 0) {
  for (const err of errors) {
    console.error(`[deploy:validate-env] ${err}`);
  }
  process.exit(1);
}

console.log("[deploy:validate-env] Environment configuration is valid.");
