import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

let cachedDb: NodePgDatabase | null = null;
let pool: Pool | null = null;

function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  pool = new Pool({ connectionString: databaseUrl });
  cachedDb = drizzle(pool);

  return cachedDb;
}

// Export a proxy that lazily initializes the connection
export const db = new Proxy({} as NodePgDatabase, {
  get(target, prop) {
    const dbInstance = getDb();
    const value = (dbInstance as any)[prop];
    return typeof value === 'function' ? value.bind(dbInstance) : value;
  }
});
