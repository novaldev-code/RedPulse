import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getConnectionString() {
  return process.env.DATABASE_URL;
}

function ensureDb() {
  if (db) {
    return db;
  }

  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  pool = new Pool({
    connectionString
  });

  db = drizzle(pool, { schema });

  return db;
}

export function getDb() {
  return ensureDb();
}

export { db, pool };
