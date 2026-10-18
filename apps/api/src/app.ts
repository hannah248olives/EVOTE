import { readFileSync } from "node:fs";
import Fastify from "fastify";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { level: process.env.LOG_LEVEL ?? "info" },
  });

  const health = async () => ({
    status: "ok",
    time: new Date().toISOString(),
    version,
  });

  app.get("/health", health);
  app.get("/api/public/health", health);

  return app;
}
