// The end-to-end sign-in seed must be inert anywhere but a local test run.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dbConfigFromEnv } from "@/db/client";
import { checkE2eSeedEnv } from "../../scripts/lib/e2e-guard.mjs";

const WEB = "/repo/web";
const good = {
  E2E_AUTH: "1",
  PGLITE_DIR: ".data/pglite-e2e",
  E2E_SESSION_TOKEN: "t".repeat(43),
  OWNER_GITHUB_ID: "900000000001",
};

describe("e2e seed guard", () => {
  it("passes only for a local test run", () => {
    expect(checkE2eSeedEnv(good, WEB)).toEqual({
      ok: true,
      dataDir: path.join(WEB, ".data", "pglite-e2e"),
      token: good.E2E_SESSION_TOKEN,
      ownerId: good.OWNER_GITHUB_ID,
    });
  });

  it.each([
    ["no E2E_AUTH", { E2E_AUTH: undefined }],
    ["E2E_AUTH not exactly 1", { E2E_AUTH: "true" }],
    ["on Vercel", { VERCEL: "1" }],
    ["a database URL (production-like)", { DATABASE_URL: "postgresql://user@db.example/neondb" }],
    ["a database URL pointing at localhost", { DATABASE_URL: "postgresql://localhost/test" }],
    ["no PGLITE_DIR", { PGLITE_DIR: undefined }],
    ["the development database folder", { PGLITE_DIR: ".data/pglite" }],
    ["a folder outside .data", { PGLITE_DIR: "pglite-e2e" }],
    ["path traversal", { PGLITE_DIR: ".data/pglite-e2e/../../../etc" }],
    ["an absolute path elsewhere", { PGLITE_DIR: "/tmp/pglite-e2e" }],
    ["a nested folder", { PGLITE_DIR: ".data/x/pglite-e2e" }],
    [".data itself", { PGLITE_DIR: ".data" }],
    ["a short session token", { E2E_SESSION_TOKEN: "short" }],
    ["no session token", { E2E_SESSION_TOKEN: undefined }],
    ["no owner id", { OWNER_GITHUB_ID: undefined }],
  ])("refuses with %s", (_label, change) => {
    const result = checkE2eSeedEnv({ ...good, ...change }, WEB);
    expect(result.ok).toBe(false);
  });
});

describe("the app's database choice in production-like environments", () => {
  it("never uses PGlite on Vercel", () => {
    expect(() => dbConfigFromEnv({ VERCEL: "1" })).toThrow(/DATABASE_URL is required/);
  });

  it("refuses a real database while E2E_AUTH is set", () => {
    expect(() => dbConfigFromEnv({ E2E_AUTH: "1", DATABASE_URL: "postgresql://user@db.example/neondb" })).toThrow(/E2E_AUTH/);
  });

  it("uses Neon when DATABASE_URL is set, PGlite otherwise", () => {
    expect(dbConfigFromEnv({ DATABASE_URL: "postgresql://user@db.example/neondb" })).toEqual({ kind: "neon", url: "postgresql://user@db.example/neondb" });
    expect(dbConfigFromEnv({}, WEB)).toEqual({ kind: "pglite", dataDir: path.join(WEB, ".data", "pglite") });
    expect(dbConfigFromEnv({ PGLITE_DIR: ".data/pglite-e2e" }, WEB)).toEqual({ kind: "pglite", dataDir: path.join(WEB, ".data", "pglite-e2e") });
    expect(dbConfigFromEnv({ VITEST: "true" })).toEqual({ kind: "pglite", dataDir: null });
    expect(() => dbConfigFromEnv({ DATABASE_URL: "mysql://x" })).toThrow();
  });
});

describe("no test sign-in in production code", () => {
  const roots = ["app", "components", "lib", "db", "proxy.ts"];
  const files = (p: string): string[] =>
    statSync(p).isDirectory() ? readdirSync(p).flatMap((name) => files(path.join(p, name))) : /\.(ts|tsx)$/.test(p) ? [p] : [];

  it("the app never reads the e2e session token, and only db/client.ts looks at E2E_AUTH (to refuse a real database)", () => {
    const all = roots.flatMap((r) => files(path.join(process.cwd(), r)));
    expect(all.length).toBeGreaterThan(20);
    for (const file of all) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("E2E_SESSION_TOKEN"), file).toBe(false);
      if (!file.endsWith(path.join("db", "client.ts"))) expect(/E2E_AUTH/.test(text), file).toBe(false);
    }
  });
});
