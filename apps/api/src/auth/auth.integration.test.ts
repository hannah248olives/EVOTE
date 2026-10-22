import { randomBytes } from "node:crypto";
import { createDatabase, runMigrations } from "@evote/database";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { BcryptPasswordHasher, type PasswordHasher } from "./password.js";
import { resolveTenantFromHost } from "./tenant-host.js";
import { TokenService } from "./tokens.js";

/**
 * EVT-103 end to end, against a real PostgreSQL. Set TEST_DATABASE_URL to a connection string whose
 * user may create databases. Each run migrates a temporary database and drops it afterwards. The API
 * under test connects as the restricted role evote_app, so row-level security is in force.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const BASE_DOMAIN = "evote.test";
const PASSWORD = "correct-horse-battery";

const tokens = new TokenService({
  accessSecret: "access-secret-0123456789-0123456789-abcdef",
  refreshSecret: "refresh-secret-0123456789-0123456789-abcdef",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604_800,
});

function urlFor(base: string, database: string, role?: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  if (role) url.searchParams.set("options", `-c role=${role}`);
  return url.toString();
}

describe.skipIf(!adminUrl)("EVT-103 admin sign-up and login (real PostgreSQL)", () => {
  const dbName = `evote_auth_${randomBytes(6).toString("hex")}`;
  const admin = adminUrl ? createDatabase(adminUrl) : undefined;
  let owner: ReturnType<typeof createDatabase>;
  let appDb: ReturnType<typeof createDatabase>;
  let schoolCount = 0;

  const query = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
    owner.db.execute<T>(statement).then((r) => r.rows);

  function buildTestApp(
    rateLimitPerMinute = 1000,
    hasher: PasswordHasher = new BcryptPasswordHasher(4),
  ) {
    return buildApp({
      auth: {
        db: appDb.db,
        tokens,
        hasher,
        resolveTenant: (host) => resolveTenantFromHost(appDb.db, host, BASE_DOMAIN),
        rateLimitPerMinute,
      },
    });
  }

  let app: ReturnType<typeof buildTestApp>;

  /** Creates a school and returns its id and the Host header that reaches it. */
  async function school(active = true) {
    const subdomain = `school${++schoolCount}`;
    const [row] = await query<{ id: string }>(
      sql`insert into tenants (subdomain, school_name, is_active)
          values (${subdomain}, ${`School ${subdomain}`}, ${active}) returning id`,
    );
    return { id: row!.id, host: `${subdomain}.${BASE_DOMAIN}` };
  }

  const post = (
    url: string,
    host: string,
    payload: unknown,
    instance: ReturnType<typeof buildTestApp> = app,
  ) => instance.inject({ method: "POST", url, headers: { host }, payload: payload as object });

  const signup = (host: string, email = "admin@example.test", password = PASSWORD) =>
    post("/api/auth/signup", host, { email, password, fullName: "Test Admin" });
  const login = (host: string, email = "admin@example.test", password = PASSWORD) =>
    post("/api/auth/login", host, { email, password });

  const countUsers = async (tenantId: string) =>
    (
      await query<{ n: number }>(
        sql`select count(*)::int as n from users where tenant_id = ${tenantId}`,
      )
    )[0]!.n;

  beforeAll(async () => {
    await admin!.db.execute(sql.raw(`create database "${dbName}"`));
    await runMigrations(urlFor(adminUrl!, dbName));
    owner = createDatabase(urlFor(adminUrl!, dbName));
    appDb = createDatabase(urlFor(adminUrl!, dbName, "evote_app"));
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await appDb?.pool.end();
    await owner?.pool.end();
    if (admin) {
      await admin.db.execute(sql.raw(`drop database if exists "${dbName}" with (force)`));
      await admin.pool.end();
    }
  });

  describe("sign-up", () => {
    it("creates the first administrator and returns access and refresh tokens", async () => {
      const { id, host } = await school();
      const res = await signup(host);
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toMatchObject({
        tokenType: "Bearer",
        expiresIn: 900,
        user: { email: "admin@example.test", fullName: "Test Admin", role: "admin" },
      });
      const access = await tokens.verifyAccessToken(body.accessToken);
      expect(access).toEqual({ userId: body.user.id, tenantId: id, role: "admin" });
      const refresh = await tokens.verifyRefreshToken(body.refreshToken);
      expect(refresh).toEqual(access);
    });

    it("stores only a bcrypt hash and never returns the password or the hash", async () => {
      const { id, host } = await school();
      const res = await signup(host);
      expect(res.body).not.toContain(PASSWORD);
      expect(res.body).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
      const [row] = await query<{ password_hash: string; has_login_time: boolean }>(
        sql`select password_hash, last_login is not null as has_login_time
              from users where tenant_id = ${id}`,
      );
      expect(row!.password_hash).toMatch(/^\$2[aby]\$04\$/);
      expect(row!.password_hash).not.toContain(PASSWORD);
      expect(row!.has_login_time).toBe(true);
    });

    it("refuses a second sign-up for a school that already has an administrator", async () => {
      const { id, host } = await school();
      expect((await signup(host)).statusCode).toBe(201);
      const second = await signup(host, "other@example.test");
      expect(second.statusCode).toBe(409);
      expect(second.json().error).toBe("signup_closed");
      expect(await countUsers(id)).toBe(1);
    });

    it("lets only one of several simultaneous sign-ups become the first administrator", async () => {
      // Make the race deterministic: hold every "Racer" insert open for 300 ms. Without the
      // per-school lock, all requests pass the "is there an admin yet?" check before any insert
      // finishes, and several administrators are created.
      await query(
        sql.raw(`create or replace function slow_racer_insert() returns trigger language plpgsql as $$
                 begin
                   if new.full_name = 'Racer' then perform pg_sleep(0.3); end if;
                   return new;
                 end $$`),
      );
      await query(
        sql.raw(`create trigger slow_racer before insert on users
                 for each row execute function slow_racer_insert()`),
      );
      const instant: PasswordHasher = {
        hash: async () => "$2b$04$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234",
        verify: async () => true,
      };
      const racing = buildTestApp(1000, instant);
      await racing.ready();
      try {
        const { id, host } = await school();
        const attempts = 8;
        const results = await Promise.all(
          Array.from({ length: attempts }, (_, i) =>
            post(
              "/api/auth/signup",
              host,
              { email: `admin${i}@example.test`, password: PASSWORD, fullName: "Racer" },
              racing,
            ),
          ),
        );
        const codes = results.map((r) => r.statusCode).sort();
        expect(codes).toEqual([201, ...Array<number>(attempts - 1).fill(409)]);
        expect(await countUsers(id)).toBe(1);
      } finally {
        await racing.close();
        await query(sql.raw("drop trigger if exists slow_racer on users"));
        await query(sql.raw("drop function if exists slow_racer_insert()"));
      }
    });

    it("allows the same email to be the first administrator of two different schools", async () => {
      const a = await school();
      const b = await school();
      expect((await signup(a.host)).statusCode).toBe(201);
      expect((await signup(b.host)).statusCode).toBe(201);
    });

    it("stores the email in lower case", async () => {
      const { id, host } = await school();
      const res = await signup(host, "Admin@Example.TEST");
      expect(res.statusCode).toBe(201);
      expect(res.json().user.email).toBe("admin@example.test");
      const [row] = await query<{ email: string }>(
        sql`select email from users where tenant_id = ${id}`,
      );
      expect(row!.email).toBe("admin@example.test");
    });

    it("ignores any school named in the body and uses the host", async () => {
      const a = await school();
      const b = await school();
      const res = await post("/api/auth/signup", a.host, {
        email: "admin@example.test",
        password: PASSWORD,
        fullName: "Test Admin",
        tenantId: b.id,
      });
      expect(res.statusCode).toBe(400); // unknown field refused
      expect(await countUsers(b.id)).toBe(0);
    });

    it("returns 404 for an unknown, inactive, bare-domain or foreign host", async () => {
      const inactive = await school(false);
      for (const host of [
        `nosuchschool.${BASE_DOMAIN}`,
        inactive.host,
        BASE_DOMAIN,
        "school1.example.com",
        "a.b.evote.test",
      ]) {
        const res = await signup(host);
        expect(res.statusCode, host).toBe(404);
      }
      expect(await countUsers(inactive.id)).toBe(0);
    });

    it.each([
      ["too short", "short"],
      ["longer than 72 bytes", "a".repeat(73)],
      ["containing NUL", "valid-prefix\u0000-hidden"],
    ])("rejects a password that is %s", async (_label, password) => {
      const { id, host } = await school();
      const res = await signup(host, "admin@example.test", password);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("invalid_password");
      expect(await countUsers(id)).toBe(0);
    });

    it.each([
      ["no body fields", {}],
      ["a missing name", { email: "a@example.test", password: PASSWORD }],
      ["an invalid email", { email: "not-an-email", password: PASSWORD, fullName: "X" }],
      ["a numeric password", { email: "a@example.test", password: 1234567890123, fullName: "X" }],
      [
        "an unknown role field",
        { email: "a@example.test", password: PASSWORD, fullName: "X", role: "super_admin" },
      ],
    ])("rejects a body with %s", async (_label, body) => {
      const { id, host } = await school();
      const res = await post("/api/auth/signup", host, body);
      expect(res.statusCode).toBe(400);
      expect(await countUsers(id)).toBe(0);
    });
  });

  describe("login", () => {
    it("returns tokens for correct credentials and records the login time", async () => {
      const { id, host } = await school();
      await signup(host);
      await query(sql`update users set last_login = '2000-01-01' where tenant_id = ${id}`);
      const res = await login(host);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(await tokens.verifyAccessToken(body.accessToken)).toEqual({
        userId: body.user.id,
        tenantId: id,
        role: "admin",
      });
      const [row] = await query<{ year: number }>(
        sql`select extract(year from last_login)::int as year from users where tenant_id = ${id}`,
      );
      expect(row!.year).toBeGreaterThan(2000);
    });

    it("treats the email case-insensitively", async () => {
      const { host } = await school();
      await signup(host, "admin@example.test");
      expect((await login(host, "ADMIN@Example.Test")).statusCode).toBe(200);
    });

    it("answers a wrong password, an unknown email and an inactive user identically", async () => {
      const { id, host } = await school();
      await signup(host);
      const wrongPassword = await login(host, "admin@example.test", "wrong-password-123");
      const unknownEmail = await login(host, "nobody@example.test");
      await query(sql`update users set is_active = false where tenant_id = ${id}`);
      const inactive = await login(host);
      for (const res of [wrongPassword, unknownEmail, inactive]) {
        expect(res.statusCode).toBe(401);
      }
      expect(unknownEmail.body).toBe(wrongPassword.body);
      expect(inactive.body).toBe(wrongPassword.body);
      expect(wrongPassword.json().error).toBe("invalid_credentials");
    });

    it("returns 401, not 404, for a school that has no users yet", async () => {
      const { host } = await school();
      expect((await login(host)).statusCode).toBe(401);
    });

    it("never accepts one school's credentials on another school's host", async () => {
      const a = await school();
      const b = await school();
      await signup(a.host, "admin@example.test", PASSWORD);
      await signup(b.host, "admin@example.test", "a-different-password");
      expect((await login(b.host, "admin@example.test", PASSWORD)).statusCode).toBe(401);
      expect((await login(a.host, "admin@example.test", "a-different-password")).statusCode).toBe(
        401,
      );
      expect((await login(a.host)).statusCode).toBe(200);
      expect((await login(b.host, "admin@example.test", "a-different-password")).statusCode).toBe(
        200,
      );
    });

    it("refuses a password longer than the bcrypt limit instead of truncating it", async () => {
      const { host } = await school();
      const stored = "a".repeat(72);
      await signup(host, "admin@example.test", stored);
      expect((await login(host, "admin@example.test", stored)).statusCode).toBe(200);
      expect((await login(host, "admin@example.test", `${stored}-extra`)).statusCode).toBe(401);
    });

    it("takes the role from the database, not from anything the client sends", async () => {
      const { id, host } = await school();
      await signup(host);
      await query(sql`update users set role = 'teacher' where tenant_id = ${id}`);
      const body = (await login(host)).json();
      expect(body.user.role).toBe("teacher");
      expect((await tokens.verifyAccessToken(body.accessToken)).role).toBe("teacher");
    });

    it("returns 404 for an unknown school and 400 for unexpected fields", async () => {
      expect((await login(`nosuchschool.${BASE_DOMAIN}`)).statusCode).toBe(404);
      const { host } = await school();
      const res = await post("/api/auth/login", host, {
        email: "a@example.test",
        password: PASSWORD,
        role: "super_admin",
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("brute-force protection", () => {
    it("answers 429 once a client exceeds the allowed attempts per minute", async () => {
      const limited = buildTestApp(3);
      await limited.ready();
      try {
        const { host } = await school();
        const codes: number[] = [];
        for (let i = 0; i < 5; i++) {
          codes.push(
            (
              await post(
                "/api/auth/login",
                host,
                { email: "a@example.test", password: "x" },
                limited,
              )
            ).statusCode,
          );
        }
        expect(codes).toEqual([401, 401, 401, 429, 429]);
      } finally {
        await limited.close();
      }
    });
  });
});
