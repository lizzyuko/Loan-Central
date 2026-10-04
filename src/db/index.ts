import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseConfig, isProduction } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// Reuse one client per server instance (and across dev hot reloads).
const globalForDb = globalThis as unknown as { __lcDb?: Database };

function createDb(): Database {
  const { DATABASE_URL } = databaseConfig();
  const client = postgres(DATABASE_URL, {
    // Neon's pooler (PgBouncer, transaction mode) does not support prepared statements.
    prepare: false,
    max: isProduction ? 5 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

/** Lazily-initialised database handle. */
export function getDb(): Database {
  if (!globalForDb.__lcDb) globalForDb.__lcDb = createDb();
  return globalForDb.__lcDb;
}

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

export { schema };
