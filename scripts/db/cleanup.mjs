import { Client } from "pg";

const DEFAULT_RETENTION_DAYS = 7;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const retentionDays = Number(process.env.RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);

  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error("RETENTION_DAYS must be a positive number");
  }

  const client = new Client({
    connectionString: databaseUrl,
    application_name: "clubstream-db-cleanup",
    statement_timeout: 10000,
    query_timeout: 10000
  });

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  await client.connect();

  try {
    const sessionsResult = await client.query(
      "DELETE FROM sessions WHERE expires_at < NOW()"
    );

    const oauthResult = await client.query(
      "DELETE FROM oauth_states WHERE expires_at < NOW()"
    );

    const auditResult = await client.query(
      "DELETE FROM audit_log WHERE created_at < $1",
      [cutoff.toISOString()]
    );

    const matchesResult = await client.query(
      "DELETE FROM matches WHERE created_at < $1",
      [cutoff.toISOString()]
    );

    const tournamentsResult = await client.query(
      "DELETE FROM tournaments WHERE created_at < $1 AND id NOT IN (SELECT DISTINCT tournament_id FROM matches WHERE tournament_id IS NOT NULL)",
      [cutoff.toISOString()]
    );

    const streamPoolResult = await client.query(
      "DELETE FROM stream_pool WHERE created_at < $1 AND status IN ('available', 'disabled', 'stuck')",
      [cutoff.toISOString()]
    );

    console.log("[db:cleanup] retention_days=", retentionDays);
    console.log("[db:cleanup] sessions_deleted=", sessionsResult.rowCount ?? 0);
    console.log("[db:cleanup] oauth_states_cleanup=done");
    console.log("[db:cleanup] audit_log_deleted=", auditResult.rowCount ?? 0);
    console.log("[db:cleanup] matches_deleted=", matchesResult.rowCount ?? 0);
    console.log("[db:cleanup] tournaments_deleted=", tournamentsResult.rowCount ?? 0);
    console.log("[db:cleanup] stream_pool_deleted=", streamPoolResult.rowCount ?? 0);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db:cleanup] failed:", error);
  process.exit(1);
});
