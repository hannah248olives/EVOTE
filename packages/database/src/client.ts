import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

/**
 * Opens a connection pool and a typed Drizzle client. The caller must end the pool.
 *
 * An idle connection can fail at any time (the server restarts, a failover, a network drop). The
 * pool reports that as an `error` event, and Node terminates the process if nobody listens. The
 * pool discards the broken connection and opens a new one on demand, so logging is enough.
 */
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  pool.on("error", (err) => {
    console.error("Idle database connection failed:", err.message);
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
