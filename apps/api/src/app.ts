import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { level: process.env.LOG_LEVEL ?? "info" },
  });

  const health = async () => ({
    status: "ok",
    service: "evote-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });

  app.get("/health", health);
  app.get("/api/public/health", health);

  return app;
}
