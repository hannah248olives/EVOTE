import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A Drizzle transaction, as passed to the callback of `db.transaction`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Throws unless the value is a UUID, so a bad tenant id can never reach the database. */
export function assertTenantId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error("Invalid tenant id: expected a UUID");
  }
  return value;
}

/**
 * Runs `fn` in a transaction in which every query sees only the given school's rows.
 *
 * The tenant is set with `set_config(..., true)`, which is local to the transaction, so it cannot
 * leak to the next request that reuses the pooled connection. The id comes from the verified
 * subdomain or token, never from client input. The database connection must use the non-owner
 * role `evote_app`; owners and superusers bypass Row-Level Security.
 */
export async function withTenant<T>(
  db: Database,
  tenantId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const id = assertTenantId(tenantId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${id}, true)`);
    return fn(tx);
  });
}

/**
 * Maps a subdomain to the id of an active school, or null when it is unknown or inactive. Works
 * without a tenant context: it calls a narrow SECURITY DEFINER function (see migration 0001).
 */
export async function resolveTenantBySubdomain(
  db: Database,
  subdomain: string,
): Promise<string | null> {
  const result = await db.execute<{ id: string | null }>(
    sql`select resolve_tenant_by_subdomain(${subdomain}) as id`,
  );
  return result.rows[0]?.id ?? null;
}
