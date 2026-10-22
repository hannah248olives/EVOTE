import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

/**
 * Refuses to continue when the connection's role can bypass Row-Level Security.
 *
 * Superusers and roles with BYPASSRLS ignore every policy, so an API connected as one would
 * silently lose tenant isolation. Call this once at startup and let the process exit on failure.
 */
export async function assertApplicationRole(db: Database): Promise<void> {
  const result = await db.execute<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
    sql`select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
  );
  const role = result.rows[0];
  if (!role) {
    throw new Error("Could not determine the database role of this connection");
  }
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `Database role "${role.rolname}" bypasses Row-Level Security. ` +
        "Connect as the application role (evote_app) so tenant isolation is enforced.",
    );
  }
}
