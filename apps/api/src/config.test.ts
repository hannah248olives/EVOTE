import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const valid = {
  DATABASE_URL: "postgres://evote_app:secret@localhost:5432/evote",
  JWT_SECRET: "a".repeat(40),
  JWT_REFRESH_SECRET: "b".repeat(40),
  TENANT_BASE_DOMAIN: "evote.app",
};

describe("loadConfig", () => {
  it("accepts a complete environment and applies the defaults", () => {
    const config = loadConfig(valid);
    expect(config).toMatchObject({
      port: 3001,
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604_800,
      bcryptCost: 12,
      authRateLimitPerMinute: 10,
      tenantBaseDomain: "evote.app",
    });
  });

  it("is immutable", () => {
    expect(Object.isFrozen(loadConfig(valid))).toBe(true);
  });

  it("lists every missing variable at once", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL is required[\s\S]*JWT_SECRET is required/);
  });

  it("rejects short secrets without echoing them", () => {
    const secret = "short-secret-value";
    try {
      loadConfig({ ...valid, JWT_SECRET: secret });
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("JWT_SECRET must be at least 32 characters");
      expect(message).not.toContain(secret);
    }
  });

  it("rejects identical access and refresh secrets", () => {
    expect(() => loadConfig({ ...valid, JWT_REFRESH_SECRET: valid.JWT_SECRET })).toThrow(
      "must be different",
    );
  });

  it.each(["https://evote.app", "evote.app:3001", ".evote.app", "evote app"])(
    "rejects the malformed base domain %j",
    (domain) => {
      expect(() => loadConfig({ ...valid, TENANT_BASE_DOMAIN: domain })).toThrow(
        "TENANT_BASE_DOMAIN",
      );
    },
  );

  it("lower-cases the base domain", () => {
    expect(loadConfig({ ...valid, TENANT_BASE_DOMAIN: "Evote.App" }).tenantBaseDomain).toBe(
      "evote.app",
    );
  });

  it("refuses a bcrypt cost that is too cheap outside tests, but allows it in tests", () => {
    expect(() => loadConfig({ ...valid, BCRYPT_COST: "4" })).toThrow("BCRYPT_COST");
    expect(loadConfig({ ...valid, NODE_ENV: "test", BCRYPT_COST: "4" }).bcryptCost).toBe(4);
  });

  it.each([
    ["PORT", "0"],
    ["PORT", "abc"],
    ["ACCESS_TOKEN_TTL_SECONDS", "5"],
    ["AUTH_RATE_LIMIT_PER_MINUTE", "-1"],
  ])("rejects %s=%s", (name, value) => {
    expect(() => loadConfig({ ...valid, [name]: value })).toThrow(name);
  });
});
