import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS ?? "180000"); // 3 minutes
const baseDelayMs = Number(process.env.DB_WAIT_BASE_DELAY_MS ?? "1000");

function fail(message) {
  console.error(`[db:wait] ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnect() {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function main() {
  if (!databaseUrl) fail("DATABASE_URL is required.");

  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    if (await canConnect()) {
      console.log(`[db:wait] Database is reachable (attempt ${attempt}).`);
      return;
    }

    const jitter = Math.floor(Math.random() * 250);
    const delay = Math.min(baseDelayMs * Math.pow(1.5, attempt - 1), 10000) + jitter;
    console.log(`[db:wait] Database not reachable yet (attempt ${attempt}); sleeping ${delay}ms.`);
    await sleep(delay);
  }

  fail(`Timed out after ${timeoutMs}ms waiting for DATABASE_URL to become reachable.`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));

