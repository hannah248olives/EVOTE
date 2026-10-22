import { randomUUID } from "node:crypto";
import { USER_ROLES, assertTenantId, type UserRole } from "@evote/database";
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "evote-api";
const ACCESS_AUDIENCE = "evote-api";
const REFRESH_AUDIENCE = "evote-api-refresh";
const ALGORITHM = "HS256";

type TokenUse = "access" | "refresh";

/** What a verified token says about its holder. The tenant and role come from the database. */
export interface TokenSubject {
  userId: string;
  tenantId: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  /** Lifetime of the access token, in seconds. */
  expiresIn: number;
}

export interface TokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

/** Raised for any token that is malformed, expired, forged, or of the wrong kind. */
export class InvalidTokenError extends Error {
  constructor() {
    super("Invalid or expired token");
    this.name = "InvalidTokenError";
  }
}

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);

/**
 * Issues and verifies signed tokens (HS256). The algorithm is pinned on verification, and access
 * and refresh tokens use different secrets, audiences and a `use` claim, so one kind can never be
 * accepted as the other.
 */
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(private readonly options: TokenServiceOptions) {
    const encoder = new TextEncoder();
    this.accessKey = encoder.encode(options.accessSecret);
    this.refreshKey = encoder.encode(options.refreshSecret);
  }

  async issuePair(subject: TokenSubject): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.sign(subject, "access", this.options.accessTtlSeconds),
      this.sign(subject, "refresh", this.options.refreshTtlSeconds),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.options.accessTtlSeconds,
    };
  }

  verifyAccessToken(token: string, now?: Date): Promise<TokenSubject> {
    return this.verify(token, "access", now);
  }

  verifyRefreshToken(token: string, now?: Date): Promise<TokenSubject> {
    return this.verify(token, "refresh", now);
  }

  private sign(subject: TokenSubject, use: TokenUse, ttlSeconds: number): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);
    return new SignJWT({ tid: subject.tenantId, role: subject.role, use })
      .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
      .setSubject(subject.userId)
      .setIssuer(ISSUER)
      .setAudience(use === "access" ? ACCESS_AUDIENCE : REFRESH_AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ttlSeconds)
      .sign(use === "access" ? this.accessKey : this.refreshKey);
  }

  private async verify(token: string, use: TokenUse, now?: Date): Promise<TokenSubject> {
    try {
      const { payload } = await jwtVerify(
        token,
        use === "access" ? this.accessKey : this.refreshKey,
        {
          algorithms: [ALGORITHM],
          issuer: ISSUER,
          audience: use === "access" ? ACCESS_AUDIENCE : REFRESH_AUDIENCE,
          requiredClaims: ["sub", "exp", "iat", "jti"],
          ...(now ? { currentDate: now } : {}),
        },
      );
      if (payload.use !== use || typeof payload.sub !== "string") throw new InvalidTokenError();
      if (typeof payload.tid !== "string" || !isUserRole(payload.role))
        throw new InvalidTokenError();
      return {
        userId: assertTenantId(payload.sub),
        tenantId: assertTenantId(payload.tid),
        role: payload.role,
      };
    } catch {
      // Hide the reason: callers and clients must not learn why a token was refused.
      throw new InvalidTokenError();
    }
  }
}
