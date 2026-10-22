import { runMigrations } from "./migrate.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required, for example postgres://user:pass@localhost:5432/evote");
  process.exit(1);
}

try {
  await runMigrations(url);
  process.stdout.write("Migrations applied.\n");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
