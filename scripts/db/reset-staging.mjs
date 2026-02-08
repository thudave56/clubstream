import { Client } from "pg";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const confirm = process.env.CONFIRM_STAGING_RESET;

  if (confirm !== "true") {
    throw new Error("Refusing to reset DB without CONFIRM_STAGING_RESET=true");
  }

  const renderEnv = process.env.RENDER_ENV;
  if (renderEnv !== "staging" && !/staging/i.test(databaseUrl)) {
    throw new Error("Refusing to reset non-staging DATABASE_URL (set RENDER_ENV=staging)");
  }

  const client = new Client({
    connectionString: databaseUrl,
    application_name: "clubstream-db-reset",
    statement_timeout: 10000,
    query_timeout: 10000
  });

  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "TRUNCATE TABLE scores, matches, stream_pool, tournaments, teams, admin_settings, audit_log, sessions, oauth_states RESTART IDENTITY CASCADE"
    );
    await client.query("COMMIT");
    console.log("[db:reset-staging] Done");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db:reset-staging] failed:", error);
  process.exit(1);
});
