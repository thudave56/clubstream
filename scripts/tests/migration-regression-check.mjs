import { Client } from "pg";

const REQUIRED_TABLES = [
  "teams",
  "tournaments",
  "stream_pool",
  "matches",
  "scores",
  "admin_settings",
  "audit_log",
  "sessions",
  "oauth_states"
];

const REQUIRED_MATCH_STATUSES = [
  "draft",
  "scheduled",
  "ready",
  "live",
  "ended",
  "canceled",
  "error"
];

function fail(message, details) {
  console.error(`Migration regression check failed: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail("DATABASE_URL is not set.");
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    const tablesResult = await client.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      `
    );
    const tableSet = new Set(tablesResult.rows.map((row) => row.table_name));

    for (const tableName of REQUIRED_TABLES) {
      if (!tableSet.has(tableName)) {
        fail(`required table '${tableName}' does not exist`);
      }
    }

    const migrationTableResult = await client.query(
      `
      SELECT table_schema
      FROM information_schema.tables
      WHERE table_name = '__drizzle_migrations'
      ORDER BY CASE WHEN table_schema = 'drizzle' THEN 0 ELSE 1 END, table_schema
      LIMIT 1
      `
    );
    const migrationSchema = migrationTableResult.rows[0]?.table_schema ?? "";
    if (!migrationSchema) {
      fail("expected __drizzle_migrations table to exist after migration-file apply");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(migrationSchema)) {
      fail(`unexpected migration schema name '${migrationSchema}'`);
    }

    const matchStatusEnum = await client.query(
      `
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'match_status'
      `
    );
    const enumValues = new Set(matchStatusEnum.rows.map((row) => row.enumlabel));

    for (const status of REQUIRED_MATCH_STATUSES) {
      if (!enumValues.has(status)) {
        fail(`required enum value '${status}' missing from match_status`);
      }
    }

    const teamCountResult = await client.query("SELECT COUNT(*)::int AS count FROM teams");
    const teamCount = teamCountResult.rows[0]?.count ?? 0;
    if (teamCount < 4) {
      fail(`expected at least 4 seeded teams, found ${teamCount}`);
    }

    const adminSettingsResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM admin_settings WHERE id = 1"
    );
    const adminSettingsCount = adminSettingsResult.rows[0]?.count ?? 0;
    if (adminSettingsCount !== 1) {
      fail(`expected admin_settings row with id=1, found ${adminSettingsCount}`);
    }

    const migrationRows = await client.query(
      `SELECT COUNT(*)::int AS count FROM "${migrationSchema}"."__drizzle_migrations"`
    );
    const migrationCount = migrationRows.rows[0]?.count ?? 0;
    if (migrationCount < 3) {
      fail(`expected at least 3 applied migrations, found ${migrationCount}`);
    }

    console.log("Migration regression check passed.");
  } catch (error) {
    fail("unexpected error", error instanceof Error ? error.stack : String(error));
  } finally {
    await client.end();
  }
}

main();
