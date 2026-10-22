import { describe, expect, it } from "vitest";
import { subdomainFromHost } from "./tenant-host.js";

describe("subdomainFromHost", () => {
  it.each([
    ["stmarys.evote.app", "stmarys"],
    ["stmarys.evote.app:3001", "stmarys"],
    ["STMARYS.Evote.App", "stmarys"],
    ["st-marys-2.evote.app", "st-marys-2"],
    ["a.evote.app", "a"],
  ])("extracts the school from %j", (host, expected) => {
    expect(subdomainFromHost(host, "evote.app")).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "evote.app", // the bare base domain is not a school
    "a.b.evote.app", // nested subdomains are not schools
    "stmarys.evote.app.evil.com", // the base domain must be the end of the host
    "stmarys.notevote.app",
    "xevote.app",
    "-bad.evote.app",
    "bad-.evote.app",
    "under_score.evote.app",
    "stmarys.evote.app.", // trailing dot
    "stmarys.evote.app:99999999",
    "[::1]",
  ])("returns null for %j", (host) => {
    expect(subdomainFromHost(host, "evote.app")).toBeNull();
  });

  it("works with a local base domain", () => {
    expect(subdomainFromHost("stmarys.localhost:3001", "localhost")).toBe("stmarys");
  });
});
