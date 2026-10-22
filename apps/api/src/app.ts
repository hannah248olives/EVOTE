import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { authRoutes, type AuthRoutesOptions } from "./auth/routes.js";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

export interface AppOptions {
  /** Registers the sign-up and login routes. Omitted in tests that only need the health checks. */
  auth?: AuthRoutesOptions;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { level: process.env.LOG_LEVEL ?? "info" },
    // Strict request validation: no type coercion (a number is not a string) and no silently
    // dropped fields, so unexpected input is rejected instead of reshaped.
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });

  const health = async () => ({
    status: "ok",
    time: new Date().toISOString(),
    version,
  });

  app.get("/health", health);
  app.get("/api/public/health", health);

  if (options.auth) {
    void app.register(authRoutes, options.auth);
  }

  return app;
}
