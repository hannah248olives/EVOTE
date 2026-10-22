/** Runtime configuration, read once at startup. Names follow Charter section 20.3. */
export interface Config {
  nodeEnv: string;
  port: number;
  host: string;
  logLevel: string;
  /** Connection string of the application role (evote_app), never the database owner. */
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  /** Domain under which each school has a subdomain, for example evote.app. */
  tenantBaseDomain: string;
  bcryptCost: number;
  authRateLimitPerMinute: number;
}

const MIN_SECRET_LENGTH = 32;
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
  problems: string[],
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    problems.push(`${name} must be an integer between ${min} and ${max}`);
    return fallback;
  }
  return value;
}

/**
 * Validates the environment and fails fast with every problem listed. Values are never echoed, so
 * a secret that is wrong cannot end up in a log.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];
  const nodeEnv = env.NODE_ENV ?? "development";

  const required = (name: string): string => {
    const value = env[name];
    if (!value) problems.push(`${name} is required`);
    return value ?? "";
  };

  const databaseUrl = required("DATABASE_URL");
  const jwtSecret = required("JWT_SECRET");
  const jwtRefreshSecret = required("JWT_REFRESH_SECRET");
  const tenantBaseDomain = required("TENANT_BASE_DOMAIN").toLowerCase();

  if (jwtSecret && jwtSecret.length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (jwtRefreshSecret && jwtRefreshSecret.length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (jwtSecret && jwtSecret === jwtRefreshSecret) {
    problems.push("JWT_SECRET and JWT_REFRESH_SECRET must be different");
  }
  if (tenantBaseDomain && !DOMAIN_PATTERN.test(tenantBaseDomain)) {
    problems.push("TENANT_BASE_DOMAIN must be a bare domain such as evote.app (no scheme or port)");
  }

  // bcrypt below cost 10 is too cheap to resist guessing; tests may use less to stay fast.
  const minCost = nodeEnv === "test" ? 4 : 10;

  const config: Config = {
    nodeEnv,
    port: integer(env, "PORT", 3001, 1, 65535, problems),
    host: env.HOST ?? "0.0.0.0",
    logLevel: env.LOG_LEVEL ?? "info",
    databaseUrl,
    jwtSecret,
    jwtRefreshSecret,
    accessTokenTtlSeconds: integer(env, "ACCESS_TOKEN_TTL_SECONDS", 900, 60, 86_400, problems),
    refreshTokenTtlSeconds: integer(
      env,
      "REFRESH_TOKEN_TTL_SECONDS",
      604_800,
      3_600,
      2_592_000,
      problems,
    ),
    tenantBaseDomain,
    bcryptCost: integer(env, "BCRYPT_COST", 12, minCost, 15, problems),
    authRateLimitPerMinute: integer(env, "AUTH_RATE_LIMIT_PER_MINUTE", 10, 1, 10_000, problems),
  };

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n${problems.map((p) => ` - ${p}`).join("\n")}`);
  }
  return Object.freeze(config);
}
