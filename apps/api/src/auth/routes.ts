import { randomBytes } from "node:crypto";
import { USER_ROLES, users, withTenant, type Database, type UserRole } from "@evote/database";
import rateLimit from "@fastify/rate-limit";
import { eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { validatePassword, type PasswordHasher } from "./password.js";
import type { TokenService } from "./tokens.js";

export interface AuthRoutesOptions {
  db: Database;
  tokens: TokenService;
  hasher: PasswordHasher;
  /** Maps the Host header to a school id, or null when there is no such active school. */
  resolveTenant: (host: string | undefined) => Promise<string | null>;
  /** Attempts per minute per client address on the sign-up and login routes. */
  rateLimitPerMinute: number;
}

interface CredentialsBody {
  email: string;
  password: string;
}
interface SignupBody extends CredentialsBody {
  fullName: string;
}

const credentialsProperties = {
  email: { type: "string", format: "email", maxLength: 255 },
  // Only a size bound here; the password policy is applied on sign-up, not on login.
  password: { type: "string", minLength: 1, maxLength: 1024 },
} as const;

function toUserRole(value: string): UserRole {
  if (!(USER_ROLES as readonly string[]).includes(value)) {
    throw new Error("Stored role is not a known role");
  }
  return value as UserRole;
}

/**
 * Administrator sign-up and login (EVT-103).
 *
 * - The school comes from the Host header, never from the request body.
 * - Every database access runs inside `withTenant`, so row-level security applies.
 * - Login answers every failure the same way and always performs a password check, so neither the
 *   response nor its timing reveals whether an email exists.
 */
export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const { db, tokens, hasher, resolveTenant } = options;

  await app.register(rateLimit, { max: options.rateLimitPerMinute, timeWindow: "1 minute" });

  // Checked against when the email is unknown, so a miss costs the same as a hit.
  const dummyHash = await hasher.hash(randomBytes(16).toString("hex"));

  app.post<{ Body: SignupBody }>(
    "/api/auth/signup",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["email", "password", "fullName"],
          properties: {
            ...credentialsProperties,
            fullName: { type: "string", minLength: 1, maxLength: 255 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantId = await resolveTenant(request.headers.host);
      if (!tenantId) {
        return reply.code(404).send({ error: "unknown_school", message: "School not found" });
      }

      const passwordProblem = validatePassword(request.body.password);
      if (passwordProblem) {
        return reply.code(400).send({ error: "invalid_password", message: passwordProblem });
      }

      const email = request.body.email.toLowerCase();
      // Hash before the transaction so the slow, CPU-bound work does not hold a connection.
      const passwordHash = await hasher.hash(request.body.password);

      const created = await withTenant(db, tenantId, async (tx) => {
        // Serialise sign-ups for this school so two requests cannot both become first admin.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`);
        const existing = await tx.select({ id: users.id }).from(users).limit(1);
        if (existing.length > 0) return null;
        const [row] = await tx
          .insert(users)
          .values({
            tenantId,
            email,
            passwordHash,
            fullName: request.body.fullName,
            role: "admin",
            lastLogin: new Date(),
          })
          .returning({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            role: users.role,
          });
        return row ?? null;
      });

      if (!created) {
        return reply.code(409).send({
          error: "signup_closed",
          message: "This school already has an administrator. Ask them to invite you.",
        });
      }

      const role = toUserRole(created.role);
      const pair = await tokens.issuePair({ userId: created.id, tenantId, role });
      return reply.code(201).send({ ...pair, user: { ...created, role } });
    },
  );

  app.post<{ Body: CredentialsBody }>(
    "/api/auth/login",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["email", "password"],
          properties: credentialsProperties,
        },
      },
    },
    async (request, reply) => {
      const tenantId = await resolveTenant(request.headers.host);
      if (!tenantId) {
        return reply.code(404).send({ error: "unknown_school", message: "School not found" });
      }

      const email = request.body.email.toLowerCase();
      const [user] = await withTenant(db, tenantId, (tx) =>
        tx.select().from(users).where(eq(users.email, email)).limit(1),
      );

      // Always compare, against a dummy hash when there is no such user.
      const matches = await hasher.verify(request.body.password, user?.passwordHash ?? dummyHash);
      if (!user || !user.isActive || !matches) {
        return reply
          .code(401)
          .send({ error: "invalid_credentials", message: "Invalid email or password" });
      }

      await withTenant(db, tenantId, (tx) =>
        tx.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id)),
      );

      const role = toUserRole(user.role);
      const pair = await tokens.issuePair({ userId: user.id, tenantId, role });
      return reply.code(200).send({
        ...pair,
        user: { id: user.id, email: user.email, fullName: user.fullName, role },
      });
    },
  );
};
