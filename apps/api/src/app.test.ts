import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("health endpoints", () => {
  it("GET /health returns status, time and version", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      status: "ok",
      time: expect.any(String),
      version: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);

    await app.close();
  });

  it("GET /api/public/health returns the same shape", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/public/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "ok",
      time: expect.any(String),
      version: expect.any(String),
    });

    await app.close();
  });
});
