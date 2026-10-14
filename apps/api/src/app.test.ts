import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("health endpoints", () => {
  it("GET /health returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", service: "evote-api" });

    await app.close();
  });

  it("GET /api/public/health returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/public/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });

    await app.close();
  });
});
