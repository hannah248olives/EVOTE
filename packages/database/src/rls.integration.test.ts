import { randomBytes, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import * as schema from "./schema/index.js";
import { positions } from "./schema/index.js";
import { resolveTenantBySubdomain, withTenant } from "./tenant-context.js";

/**
 * EVT-104: proves tenant isolation against a real PostgreSQL. Set TEST_DATABASE_URL to a
 * connection string whose user may create databases. Each run uses a temporary database.
 *
 * The connection is a superuser (so it can seed data), but every assertion runs after
 * `set local role evote_app`, the non-owner role the API uses, inside a transaction that is always
 * rolled back.
 */
const adminUrl = process.env.TEST_DATABASE_URL;

/** The column that links each table to its school. */
const TENANT_COLUMN = {
  tenants: "id",
  users: "tenant_id",
  positions: "tenant_id",
  candidates: "tenant_id",
} as const;
const TABLES = Object.keys(TENANT_COLUMN) as (keyof typeof TENANT_COLUMN)[];

function urlFor(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
}

describe.skipIf(!adminUrl)("EVT-104 row-level security (real PostgreSQL)", () => {
  const dbName = `evote_rls_${randomBytes(6).toString("hex")}`;
  let admin: pg.Pool;
  let owner: pg.Pool;
  let testUrl: string;
  const id = {} as Record<"a" | "b" | "off" | "posA" | "posB" | "candA" | "candB", string>;

  /** Runs `fn` as evote_app with the given tenant (null = no tenant set). Always rolls back. */
  async function asApp<T>(
    tenantId: string | null,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await owner.connect();
    try {
      await client.query("begin");
      await client.query("set local role evote_app");
      if (tenantId !== null) {
        await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
      }
      return await fn(client);
    } finally {
      await client.query("rollback").catch(() => undefined);
      client.release();
    }
  }

  async function one(sql: string, params: unknown[]): Promise<string> {
    return (await owner.query<{ id: string }>(sql, params)).rows[0]!.id;
  }

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: adminUrl });
    await admin.query(`create database "${dbName}"`);
    testUrl = urlFor(adminUrl!, dbName);
    await runMigrations(testUrl);
    owner = new pg.Pool({ connectionString: testUrl });

    const tenant = (sub: string, active = true) =>
      one(
        "insert into tenants (subdomain, school_name, is_active) values ($1, $2, $3) returning id",
        [sub, `School ${sub}`, active],
      );
    id.a = await tenant("rls-a");
    id.b = await tenant("rls-b");
    id.off = await tenant("rls-off", false);
    for (const [key, tenantId] of [
      ["A", id.a],
      ["B", id.b],
    ] as const) {
      await owner.query(
        "insert into users (tenant_id, email, password_hash, full_name) values ($1, $2, 'h', 'n')",
        [tenantId, `user-${key.toLowerCase()}@example.test`],
      );
      id[`pos${key}`] = await one(
        "insert into positions (tenant_id, title, eligible_classes) values ($1, 'Head Prefect', '{S5}') returning id",
        [tenantId],
      );
      id[`cand${key}`] = await one(
        "insert into candidates (tenant_id, position_id, name, class) values ($1, $2, 'Candidate', 'S5') returning id",
        [tenantId, id[`pos${key}`]],
      );
    }
  });

  afterAll(async () => {
    await owner?.end();
    if (admin) {
      await admin.query(`drop database if exists "${dbName}" with (force)`);
      await admin.end();
    }
  });

  it("seeded data exists for an unrestricted role (sanity check)", async () => {
    const res = await owner.query("select count(*)::int as n from tenants");
    expect(res.rows[0].n).toBe(3);
  });

  describe("guard rails", () => {
    it("enables AND forces RLS on tenants and on every table that has a tenant_id", async () => {
      const res = await owner.query<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `select c.relname, c.relrowsecurity, c.relforcerowsecurity
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
            and (c.relname = 'tenants' or exists (
                  select 1 from pg_attribute a
                   where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped))`,
      );
      expect(res.rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
      for (const row of res.rows) {
        expect(row.relrowsecurity, `${row.relname} must enable RLS`).toBe(true);
        expect(row.relforcerowsecurity, `${row.relname} must force RLS`).toBe(true);
      }
    });

    it("has an isolation policy on every table", async () => {
      const res = await owner.query<{ tablename: string }>(
        "select tablename from pg_policies where schemaname = 'public' and policyname = 'tenant_isolation'",
      );
      expect(res.rows.map((r) => r.tablename).sort()).toEqual([...TABLES].sort());
    });

    it("keeps the application roles free of dangerous privileges", async () => {
      // Login and password are provisioned per environment, so rolcanlogin is not asserted.
      const res = await owner.query(
        "select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole from pg_roles where rolname in ('evote_app', 'evote_lookup')",
      );
      expect(res.rows).toHaveLength(2);
      for (const role of res.rows) {
        expect(role).toMatchObject({
          rolsuper: false,
          rolbypassrls: false,
          rolcreatedb: false,
          rolcreaterole: false,
        });
      }
    });
  });

  describe.each(TABLES)("%s", (table) => {
    const column = TENANT_COLUMN[table];
    const visible = (tenantId: string | null) =>
      asApp(tenantId, async (c) =>
        (await c.query<{ t: string }>(`select ${column} as t from ${table}`)).rows.map((r) => r.t),
      );

    it("shows school A only its own rows", async () => {
      const rows = await visible(id.a);
      expect(rows).toEqual([id.a]);
    });

    it("shows school B only its own rows", async () => {
      expect(await visible(id.b)).toEqual([id.b]);
    });

    it("shows nothing when no school is set (fails closed)", async () => {
      expect(await visible(null)).toEqual([]);
    });

    it("shows nothing when the school setting is empty", async () => {
      expect(await visible("")).toEqual([]);
    });

    it("shows nothing for a school that does not exist", async () => {
      expect(await visible(randomUUID())).toEqual([]);
    });
  });

  describe("writes", () => {
    it("blocks inserting a row for another school", async () => {
      const code = await sqlState(
        asApp(id.a, (c) =>
          c.query(
            "insert into positions (tenant_id, title, eligible_classes) values ($1, 'Injected', '{S1}')",
            [id.b],
          ),
        ),
      );
      expect(code).toBe("42501");
    });

    it("allows inserting a row for its own school", async () => {
      const res = await asApp(id.a, (c) =>
        c.query(
          "insert into positions (tenant_id, title, eligible_classes) values ($1, 'Mine', '{S1}')",
          [id.a],
        ),
      );
      expect(res.rowCount).toBe(1);
    });

    it("cannot update another school's rows, and leaves them unchanged", async () => {
      const res = await asApp(id.a, (c) =>
        c.query("update positions set title = 'Hacked' where tenant_id = $1", [id.b]),
      );
      expect(res.rowCount).toBe(0);
      const check = await owner.query("select title from positions where id = $1", [id.posB]);
      expect(check.rows[0].title).toBe("Head Prefect");
    });

    it("cannot move its own row to another school", async () => {
      const code = await sqlState(
        asApp(id.a, (c) =>
          c.query("update positions set tenant_id = $1 where id = $2", [id.b, id.posA]),
        ),
      );
      expect(code).toBe("42501");
    });

    it("cannot delete another school's rows, and leaves them in place", async () => {
      const res = await asApp(id.a, (c) =>
        c.query("delete from candidates where tenant_id = $1", [id.b]),
      );
      expect(res.rowCount).toBe(0);
      const check = await owner.query(
        "select count(*)::int as n from candidates where tenant_id = $1",
        [id.b],
      );
      expect(check.rows[0].n).toBe(1);
    });

    it("cannot read across schools through a join", async () => {
      const rows = await asApp(
        id.a,
        async (c) =>
          (
            await c.query<{ tenant_id: string }>(
              "select p.tenant_id from candidates c join positions p on p.id = c.position_id",
            )
          ).rows,
      );
      expect(rows.map((r) => r.tenant_id)).toEqual([id.a]);
    });

    it("creates a school only when the tenant is set to the new school's own id", async () => {
      const fresh = randomUUID();
      const insert = (c: pg.PoolClient, rowId: string) =>
        c.query("insert into tenants (id, subdomain, school_name) values ($1, $2, 'New')", [
          rowId,
          `new-${rowId.slice(0, 8)}`,
        ]);
      expect((await asApp(fresh, (c) => insert(c, fresh))).rowCount).toBe(1);
      expect(await sqlState(asApp(id.a, (c) => insert(c, fresh)))).toBe("42501");
      expect(await sqlState(asApp(null, (c) => insert(c, fresh)))).toBe("42501");
    });
  });

  describe("privileges of the application role", () => {
    it("cannot create tables", async () => {
      const code = await sqlState(asApp(id.a, (c) => c.query("create table sneaky (id int)")));
      expect(code).toBe("42501");
    });

    it("cannot switch row-level security off", async () => {
      const code = await sqlState(
        asApp(id.a, (c) => c.query("alter table users disable row level security")),
      );
      expect(code).toBe("42501");
    });

    it("cannot weaken a policy", async () => {
      const code = await sqlState(
        asApp(id.a, (c) => c.query("drop policy tenant_isolation on positions")),
      );
      expect(code).toBe("42501");
    });
  });

  describe("subdomain lookup without a tenant", () => {
    const resolve = (sub: string) =>
      asApp(
        null,
        async (c) =>
          (
            await c.query<{ id: string | null }>("select resolve_tenant_by_subdomain($1) as id", [
              sub,
            ])
          ).rows[0]!.id,
      );

    it("returns the id of an active school", async () => {
      expect(await resolve("rls-a")).toBe(id.a);
    });

    it("returns null for an unknown subdomain", async () => {
      expect(await resolve("does-not-exist")).toBeNull();
    });

    it("returns null for an inactive school", async () => {
      expect(await resolve("rls-off")).toBeNull();
    });

    it("treats an injection attempt as an ordinary unknown name", async () => {
      expect(await resolve("rls-a' or '1'='1")).toBeNull();
    });

    it("does not let the lookup role read school names, and sees only active schools", async () => {
      const code = await sqlState(
        asApp(null, async (c) => {
          await c.query("set local role evote_lookup");
          await c.query("select school_name from tenants");
        }),
      );
      expect(code).toBe("42501");

      const subs = await asApp(null, async (c) => {
        await c.query("set local role evote_lookup");
        return (await c.query<{ subdomain: string }>("select subdomain from tenants")).rows.map(
          (r) => r.subdomain,
        );
      });
      expect(subs.sort()).toEqual(["rls-a", "rls-b"]);
    });
  });

  describe("withTenant helper (through Drizzle, as the API will use it)", () => {
    let pool: pg.Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;

    beforeAll(() => {
      // One connection, so a leaked tenant setting would be visible to the next query.
      pool = new pg.Pool({ connectionString: testUrl, options: "-c role=evote_app", max: 1 });
      db = drizzle(pool, { schema });
    });
    afterAll(async () => {
      await pool.end();
    });

    it("scopes queries to the given school", async () => {
      const rows = await withTenant(db, id.a, (tx) => tx.select().from(positions));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.tenantId === id.a)).toBe(true);
    });

    it("does not leak the tenant to the next use of the same connection", async () => {
      await withTenant(db, id.a, (tx) => tx.select().from(positions));
      expect(await db.select().from(positions)).toEqual([]);
    });

    it("rejects a tenant id that is not a UUID before touching the database", async () => {
      await expect(withTenant(db, "x'; drop table users; --", async () => "ran")).rejects.toThrow(
        "Invalid tenant id",
      );
    });

    it("resolves a subdomain to a school id", async () => {
      expect(await resolveTenantBySubdomain(db, "rls-b")).toBe(id.b);
      expect(await resolveTenantBySubdomain(db, "nope")).toBeNull();
    });
  });
});
