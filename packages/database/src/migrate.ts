import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/** Applies every pending migration. Safe to run repeatedly: applied migrations are skipped. */
export async function runMigrations(connectionString: string): Promise<void> {
  const { db, pool } = createDatabase(connectionString);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
