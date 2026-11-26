// The runtime half of the guard for M4b's per-user tables (user_settings, export_token): two
// made-up users go through every settings action, the reads and the export endpoint, and every SQL
// statement the app sends to those tables is recorded and checked for a user filter. The one
// exception is the reviewed key lookup by hash (lib/export-auth.ts). B's rows stay exactly as they
// were whatever A does.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { asc, eq } from "drizzle-orm";
import { createExportKey, downloadMyData, revokeExportKey, setSectionVisible, unlockScalerSection } from "@/app/actions/settings";
import { GET } from "@/app/api/export/route";
import type { Db } from "@/db/client";
import { exportToken, userSettings } from "@/db/schema";
import { setScalerAccessCode } from "@/lib/admin-db";
import { getMyExportKeys, getMySettings } from "@/lib/settings";
import { checkSqlText } from "./support/query-guard";
import { OWNER_ID, emptyDb, seedUser, setTestEnv } from "./support/db";

setTestEnv();

const statements: string[] = [];
type Client = { query: (...args: unknown[]) => Promise<unknown> };
let client: Client;
let realQuery: Client["query"];
let db: Db;
const cookies = new Map<string, string>();
const as = (userId: string) => {
  request.headers = new Headers({ cookie: cookies.get(userId)! });
};

beforeAll(async () => {
  process.env.SIGNUP_MODE = "capped";
  db = await emptyDb();
  for (const [userId, githubId] of [["owner", OWNER_ID], ["a", "900000000051"], ["b", "900000000052"]]) {
    cookies.set(userId, (await seedUser(db, { userId, githubId, email: `${userId}@example.com` })).cookie);
  }
  client = (db as unknown as { $client: Client }).$client;
  realQuery = client.query;
  client.query = function (this: Client, ...args: unknown[]) {
    if (typeof args[0] === "string") statements.push(args[0]);
    return realQuery.apply(this, args);
  };
});
afterAll(() => {
  client.query = realQuery;
});

const rowsOf = async (userId: string) => ({
  settings: await db.select().from(userSettings).where(eq(userSettings.userId, userId)),
  keys: await db.select().from(exportToken).where(eq(exportToken.userId, userId)).orderBy(asc(exportToken.id)),
});

describe("A and B through every settings action", () => {
  it("A's changes never touch B's rows, and every statement on the per-user tables is scoped", async () => {
    as("owner");
    await setScalerAccessCode("MADE-UP-CODE-9");
    as("b");
    await setSectionVisible("career", true);
    const bKey = await createExportKey();
    if (!bKey.ok) throw new Error("expected a key");
    const bBefore = await rowsOf("b");

    as("a");
    await getMySettings();
    await setSectionVisible("projects", true);
    await setSectionVisible("reading", false);
    await setSectionVisible("scaler", true);
    await unlockScalerSection("WRONG-CODE-1");
    await unlockScalerSection("MADE-UP-CODE-9");
    const aKey = await createExportKey();
    if (!aKey.ok) throw new Error("expected a key");
    await getMyExportKeys();
    await revokeExportKey(bKey.value.id);
    await downloadMyData();
    const exported = await GET(new Request("http://localhost/api/export", { headers: { authorization: `Bearer ${aKey.value.key}` } }));
    expect(exported.status).toBe(200);
    await revokeExportKey(aKey.value.id);

    expect(await rowsOf("b")).toEqual(bBefore);

    const touching = statements.filter((s) => /\b(from|into|update|join)\s+"?(user_settings|export_token)"?(?![\w."])/i.test(s));
    expect(touching.length).toBeGreaterThan(15);
    const unscoped = touching.filter((s) => checkSqlText(s).length > 0);
    // Only the reviewed lookup of a key by its hash (lib/export-auth.ts) has no user filter.
    expect(unscoped).toHaveLength(1);
    expect(unscoped[0]).toMatch(/^update "export_token" t set "last_used_at" = now\(\).* where t\."token_hash" = \$1 and t\."revoked_at" is null and u\."id" = t\."user_id" and u\."status" = 'active' returning t\."user_id", t\."window_count"$/);
  });
});
