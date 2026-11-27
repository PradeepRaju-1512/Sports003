import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/iiitt_sports";

const isLocalhost =
  databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("::1");

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle(pool, { schema });

export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch (err) {
    console.error("[DB] Connection verification failed:", (err as Error).message);
    if (process.env.NODE_ENV === "production") {
      console.error("[DB] Fatal: Exiting because NODE_ENV=production requires live PostgreSQL.");
      process.exit(1);
    }
    return false;
  }
}
