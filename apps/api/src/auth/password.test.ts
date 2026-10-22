import { describe, expect, it } from "vitest";
import { BcryptPasswordHasher, MAX_PASSWORD_BYTES, validatePassword } from "./password.js";

describe("validatePassword", () => {
  it("accepts a password of at least 10 characters", () => {
    expect(validatePassword("correct-horse")).toBeNull();
  });

  it("rejects fewer than 10 characters", () => {
    expect(validatePassword("short")).toMatch(/at least 10/);
  });

  it("counts characters, not bytes, for the minimum", () => {
    expect(validatePassword("é".repeat(10))).toBeNull();
  });

  it("accepts exactly 72 bytes and rejects 73", () => {
    expect(validatePassword("a".repeat(72))).toBeNull();
    expect(validatePassword("a".repeat(73))).toMatch(/at most 72 bytes/);
  });

  it("counts bytes, so a short multi-byte password can still be too long", () => {
    const password = "€".repeat(25); // 25 characters, 75 bytes
    expect(Buffer.byteLength(password)).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(validatePassword(password)).toMatch(/at most 72 bytes/);
  });

  it("rejects a NUL character, which bcrypt would treat as the end of the password", () => {
    expect(validatePassword("valid-prefix\u0000-hidden")).toMatch(/invalid character/);
  });
});

describe("BcryptPasswordHasher", () => {
  const hasher = new BcryptPasswordHasher(4);

  it("produces a bcrypt hash that is not the password", async () => {
    const hash = await hasher.hash("correct-horse-battery");
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    expect(hash).not.toContain("correct-horse");
  });

  it("verifies the right password and refuses a wrong one", async () => {
    const hash = await hasher.hash("correct-horse-battery");
    expect(await hasher.verify("correct-horse-battery", hash)).toBe(true);
    expect(await hasher.verify("correct-horse-batterz", hash)).toBe(false);
  });

  it("salts every hash, so equal passwords give different hashes", async () => {
    const [a, b] = await Promise.all([
      hasher.hash("same-password-1"),
      hasher.hash("same-password-1"),
    ]);
    expect(a).not.toBe(b);
  });

  it("does not let bcrypt truncate an over-long password into a match", async () => {
    const stored = "a".repeat(MAX_PASSWORD_BYTES);
    const hash = await hasher.hash(stored);
    expect(await hasher.verify(stored, hash)).toBe(true);
    expect(await hasher.verify(`${stored}-extra-characters`, hash)).toBe(false);
  });

  it("returns false for a malformed stored hash instead of throwing", async () => {
    expect(await hasher.verify("whatever-password", "not-a-bcrypt-hash")).toBe(false);
  });
});
