import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { InvalidTokenError, TokenService, type TokenSubject } from "./tokens.js";

const accessSecret = "access-secret-0123456789-0123456789-abcdef";
const refreshSecret = "refresh-secret-0123456789-0123456789-abcdef";
const options = { accessSecret, refreshSecret, accessTtlSeconds: 900, refreshTtlSeconds: 604_800 };
const service = new TokenService(options);
const key = (secret: string) => new TextEncoder().encode(secret);

const subject: TokenSubject = { userId: randomUUID(), tenantId: randomUUID(), role: "admin" };

/** Signs a token with chosen claims, to build forged and malformed ones. */
function forge(
  claims: Record<string, unknown>,
  secret = accessSecret,
  alg = "HS256",
  overrides: { iss?: string; aud?: string; exp?: number } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg })
    .setSubject(subject.userId)
    .setIssuer(overrides.iss ?? "evote-api")
    .setAudience(overrides.aud ?? "evote-api")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(overrides.exp ?? now + 600)
    .sign(key(secret));
}

const goodClaims = { tid: subject.tenantId, role: "admin", use: "access" };

describe("TokenService", () => {
  it("issues a pair and reports the access lifetime", async () => {
    const pair = await service.issuePair(subject);
    expect(pair.tokenType).toBe("Bearer");
    expect(pair.expiresIn).toBe(900);
    expect(pair.accessToken).not.toBe(pair.refreshToken);
  });

  it("round-trips the subject through both tokens", async () => {
    const pair = await service.issuePair(subject);
    expect(await service.verifyAccessToken(pair.accessToken)).toEqual(subject);
    expect(await service.verifyRefreshToken(pair.refreshToken)).toEqual(subject);
  });

  it("does not accept a refresh token as an access token, or the reverse", async () => {
    const pair = await service.issuePair(subject);
    await expect(service.verifyAccessToken(pair.refreshToken)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
    await expect(service.verifyRefreshToken(pair.accessToken)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("rejects a token signed with another secret", async () => {
    const token = await forge(goodClaims, "some-other-secret-0123456789-0123456789");
    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("pins the algorithm: a token signed with HS512 and the right secret is refused", async () => {
    const token = await forge(goodClaims, accessSecret, "HS512");
    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("refuses an unsigned token (alg none)", async () => {
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const header = b64({ alg: "none", typ: "JWT" });
    const payload = b64({
      ...goodClaims,
      sub: subject.userId,
      iss: "evote-api",
      aud: "evote-api",
      jti: randomUUID(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    await expect(service.verifyAccessToken(`${header}.${payload}.`)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("refuses a tampered payload", async () => {
    const { accessToken } = await service.issuePair(subject);
    const [header, , signature] = accessToken.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...goodClaims, role: "super_admin", sub: subject.userId }),
    ).toString("base64url");
    await expect(
      service.verifyAccessToken(`${header}.${forged}.${signature}`),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("refuses an expired token", async () => {
    const { accessToken } = await service.issuePair(subject);
    const later = new Date(Date.now() + (900 + 5) * 1000);
    await expect(service.verifyAccessToken(accessToken, later)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
    await expect(service.verifyAccessToken(accessToken)).resolves.toEqual(subject);
  });

  it("refuses the wrong issuer or audience", async () => {
    const wrongIssuer = await forge(goodClaims, accessSecret, "HS256", { iss: "someone-else" });
    const wrongAudience = await forge(goodClaims, accessSecret, "HS256", {
      aud: "evote-api-refresh",
    });
    await expect(service.verifyAccessToken(wrongIssuer)).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(service.verifyAccessToken(wrongAudience)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it.each([
    ["an unknown role", { ...goodClaims, role: "owner" }],
    ["a tenant that is not a UUID", { ...goodClaims, tid: "not-a-uuid" }],
    ["no tenant", { role: "admin", use: "access" }],
    ["the wrong use", { ...goodClaims, use: "refresh" }],
  ])("refuses a signed token with %s", async (_label, claims) => {
    await expect(service.verifyAccessToken(await forge(claims))).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it.each(["", "garbage", "a.b.c", "Bearer abc"])(
    "refuses the malformed token %j",
    async (token) => {
      await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidTokenError);
    },
  );

  it("gives every token a unique id", async () => {
    const [a, b] = await Promise.all([service.issuePair(subject), service.issuePair(subject)]);
    expect(a.accessToken).not.toBe(b.accessToken);
  });
});
