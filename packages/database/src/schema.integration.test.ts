import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import { candidates, positions, tenants, users } from "./schema/index.js";

/**
 * Runs against a real PostgreSQL. Set TEST_DATABASE_URL to a connection string whose user may
 * create databases, for example postgres://evote:evote_dev_password@localhost:5432/postgres.
 * Each run migrates a fresh, temporary database and drops it afterwards.
 */
const adminUrl = process.env.TEST_DATABASE_URL;

function urlFor(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Returns the PostgreSQL error code, for example 23505 (unique) or 23514 (check). */
async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
}

describe.skipIf(!adminUrl)("EVT-101 core schema (real PostgreSQL)", () => {
  const dbName = `evote_test_${randomBytes(6).toString("hex")}`;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let testUrl: string;

  async function tenant(subdomain: string): Promise<string> {
    const res = await pool.query<{ id: string }>(
      "insert into tenants (subdomain, school_name) values ($1, $2) returning id",
      [subdomain, `School ${subdomain}`],
    );
    return res.rows[0]!.id;
  }

  async function position(tenantId: string, title = "Head Prefect"): Promise<string> {
    const res = await pool.query<{ id: string }>(
      "insert into positions (tenant_id, title, eligible_classes) values ($1, $2, $3) returning id",
      [tenantId, title, ["S4", "S5"]],
    );
    return res.rows[0]!.id;
  }

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: adminUrl });
    await admin.query(`create database "${dbName}"`);
    testUrl = urlFor(adminUrl!, dbName);
    await runMigrations(testUrl);
    pool = new pg.Pool({ connectionString: testUrl });
  });

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`drop database if exists "${dbName}" with (force)`);
      await admin.end();
    }
  });

  it("creates the four core tables", async () => {
    const res = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    const names = res.rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(["tenants", "users", "positions", "candidates"]));
  });

  it("is idempotent: running the migrations again changes nothing", async () => {
    await expect(runMigrations(testUrl)).resolves.toBeUndefined();
  });

  describe("tenants", () => {
    it("applies the charter defaults", async () => {
      const id = await tenant("defaults");
      const row = (await pool.query("select * from tenants where id = $1", [id])).rows[0];
      expect(row.primary_color).toBe("#1e40af");
      expect(row.secondary_color).toBe("#f59e0b");
      expect(row.is_active).toBe(true);
      expect(row.created_at).toBeInstanceOf(Date);
    });

    it("rejects a duplicate subdomain", async () => {
      await tenant("duplicate");
      expect(await sqlState(tenant("duplicate"))).toBe("23505");
    });

    it.each(["Upper", "-leading", "trailing-", "has space", "under_score", "", "a".repeat(64)])(
      "rejects the invalid subdomain %j",
      async (bad) => {
        const code = await sqlState(
          pool.query("insert into tenants (subdomain, school_name) values ($1, 'x')", [bad]),
        );
        expect(["23514", "22001"]).toContain(code);
      },
    );

    it.each(["a", "stmarys", "st-marys-2", "a".repeat(63)])(
      "accepts the valid subdomain %j",
      async (good) => {
        await expect(tenant(good)).resolves.toMatch(/^[0-9a-f-]{36}$/);
      },
    );

    it("rejects a colour that is not a hex code", async () => {
      const code = await sqlState(
        pool.query(
          "insert into tenants (subdomain, school_name, primary_color) values ('badcolour', 'x', 'blue')",
        ),
      );
      expect(code).toBe("23514");
    });
  });

  describe("users", () => {
    async function user(tenantId: string, email: string, role = "teacher") {
      return pool.query(
        "insert into users (tenant_id, email, password_hash, full_name, role) values ($1, $2, 'hash', 'Test Teacher', $3)",
        [tenantId, email, role],
      );
    }

    it("allows the same email in two schools but not twice in one school", async () => {
      const a = await tenant("users-a");
      const b = await tenant("users-b");
      await user(a, "teacher@example.test");
      await expect(user(b, "teacher@example.test")).resolves.toBeDefined();
      expect(await sqlState(user(a, "teacher@example.test"))).toBe("23505");
    });

    it("rejects uppercase emails so uniqueness cannot be bypassed by case", async () => {
      const a = await tenant("users-case");
      expect(await sqlState(user(a, "Teacher@Example.test"))).toBe("23514");
    });

    it("rejects an unknown role and defaults to teacher", async () => {
      const a = await tenant("users-role");
      expect(await sqlState(user(a, "x@example.test", "student"))).toBe("23514");
      const res = await pool.query(
        "insert into users (tenant_id, email, password_hash, full_name) values ($1, 'd@example.test', 'h', 'n') returning role",
        [a],
      );
      expect(res.rows[0].role).toBe("teacher");
    });

    it("rejects a user for a school that does not exist", async () => {
      const code = await sqlState(
        user("00000000-0000-0000-0000-000000000000", "ghost@example.test"),
      );
      expect(code).toBe("23503");
    });
  });

  describe("positions and candidates", () => {
    async function candidate(tenantId: string, positionId: string, scores = [10, 10, 10, 10]) {
      return pool.query(
        `insert into candidates
           (tenant_id, position_id, name, class, vetting_discipline, vetting_academic, vetting_character, vetting_interview)
         values ($1, $2, 'Candidate', 'S5', $3, $4, $5, $6) returning vetting_total`,
        [tenantId, positionId, ...scores],
      );
    }

    it("computes vetting_total from the four scores", async () => {
      const t = await tenant("cand-total");
      const p = await position(t);
      const res = await candidate(t, p, [25, 20, 15, 5]);
      expect(res.rows[0].vetting_total).toBe(65);
    });

    it.each([-1, 26])("rejects a vetting score of %i", async (bad) => {
      const t = await tenant(`cand-range${bad < 0 ? "n" : "p"}`);
      const p = await position(t);
      expect(await sqlState(candidate(t, p, [bad, 0, 0, 0]))).toBe("23514");
    });

    it("never lets a candidate point at a position of another school", async () => {
      const a = await tenant("iso-a");
      const b = await tenant("iso-b");
      const positionOfB = await position(b);
      // Tenant A tries to attach a candidate to tenant B's position.
      expect(await sqlState(candidate(a, positionOfB))).toBe("23503");
    });

    it("deletes positions, candidates and users with their school", async () => {
      const t = await tenant("cascade");
      const p = await position(t);
      await candidate(t, p);
      await pool.query(
        "insert into users (tenant_id, email, password_hash, full_name) values ($1, 'c@example.test', 'h', 'n')",
        [t],
      );
      await pool.query("delete from tenants where id = $1", [t]);
      for (const table of ["positions", "candidates", "users"]) {
        const res = await pool.query(
          `select count(*)::int as n from ${table} where tenant_id = $1`,
          [t],
        );
        expect(res.rows[0].n).toBe(0);
      }
    });
  });

  it("round-trips a row through the typed Drizzle client", async () => {
    const db = drizzle(pool);
    const [created] = await db
      .insert(tenants)
      .values({ subdomain: "drizzle", schoolName: "Drizzle School" })
      .returning();
    const [pos] = await db
      .insert(positions)
      .values({ tenantId: created!.id, title: "Games Captain", eligibleClasses: ["S3"] })
      .returning();
    await db.insert(candidates).values({
      tenantId: created!.id,
      positionId: pos!.id,
      name: "Test Candidate",
      className: "S3",
      vettingDiscipline: 20,
      vettingAcademic: 20,
      vettingCharacter: 20,
      vettingInterview: 20,
    });
    const [found] = await db.select().from(candidates).where(eq(candidates.tenantId, created!.id));
    expect(found?.vettingTotal).toBe(80);
    expect(found?.isApproved).toBe(false);
    await db.insert(users).values({
      tenantId: created!.id,
      email: "drizzle@example.test",
      passwordHash: "hash",
      fullName: "Drizzle Teacher",
    });
  });
});
