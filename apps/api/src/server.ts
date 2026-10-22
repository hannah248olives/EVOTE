import { assertApplicationRole, createDatabase } from "@evote/database";
import { buildApp } from "./app.js";
import { BcryptPasswordHasher } from "./auth/password.js";
import { resolveTenantFromHost } from "./auth/tenant-host.js";
import { TokenService } from "./auth/tokens.js";
import { loadConfig } from "./config.js";

try {
  const config = loadConfig();
  const { db, pool } = createDatabase(config.databaseUrl);
  // Fail fast if the connection could bypass row-level security.
  await assertApplicationRole(db);

  const app = buildApp({
    auth: {
      db,
      tokens: new TokenService({
        accessSecret: config.jwtSecret,
        refreshSecret: config.jwtRefreshSecret,
        accessTtlSeconds: config.accessTokenTtlSeconds,
        refreshTtlSeconds: config.refreshTokenTtlSeconds,
      }),
      hasher: new BcryptPasswordHasher(config.bcryptCost),
      resolveTenant: (host) => resolveTenantFromHost(db, host, config.tenantBaseDomain),
      rateLimitPerMinute: config.authRateLimitPerMinute,
    },
  });
  app.addHook("onClose", async () => {
    await pool.end();
  });

  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  console.error("Failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
}
