// Settings, "your data", leaving, and the Scaler access code (app/actions/settings.ts and
// account.ts): signed-out and waitlisted users are refused; each user reads and changes only their
// own settings, keys and data; the access code is rate-limited and never stored or logged in clear.
// Made-up users only.
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers(), cookiesSet: [] as string[] }));
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: (name: string) => request.cookiesSet.push(name) }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { asc, eq } from "drizzle-orm";
import { deleteMyAccount, leaveWaitlist } from "@/app/actions/account";
import { saveLink, saveNote, toggleDone } from "@/app/actions/progress";
import { createExportKey, downloadMyData, revokeExportKey, setSectionVisible, unlockScalerSection } from "@/app/actions/settings";
import { setScalerAccessCode } from "@/lib/admin-db";
import type { Db } from "@/db/client";
import { account, adminAudit, exportToken, progress, progressEvent, session, user, userSettings } from "@/db/schema";
import { DEFAULT_SECTIONS, OWNER_SECTIONS } from "@/lib/access-types";
import { setDone, setLink, setNote } from "@/lib/progress-db";
import { getMyExportKeys, getMySettings, getMyWaitlistPlace } from "@/lib/settings";
import { OWNER_ID, emptyDb, recordStatements, seedUser, setTestEnv } from "./support/db";

setTestEnv();

let db: Db;
const cookies = new Map<string, string>();
const as = (userId: string | null) => {
  request.headers = new Headers(userId ? { cookie: cookies.get(userId)! } : {});
};
async function add(userId: string, githubId: string, status: "active" | "waitlisted" | "suspended" = "active") {
  cookies.set(userId, (await seedUser(db, { userId, githubId, email: `${userId}@example.com`, githubLogin: `${userId}-login`, name: `${userId} Example`, status })).cookie);
}

const B_NOTE = "B's made-up note, private to B.";
const CODE = "MADE-UP-SCALER-CODE";

beforeEach(async () => {
  process.env.SIGNUP_MODE = "capped";
  db = await emptyDb();
  cookies.clear();
  request.cookiesSet = [];
  await add("owner", OWNER_ID);
  await add("a", "900000000031");
  await add("b", "900000000032");
  await add("w", "900000000033", "waitlisted");
  await add("s", "900000000034", "suspended");
  await setDone("b", db, "l1-1", true);
  await setNote("b", db, "l1-1", B_NOTE);
  await setLink("b", db, "l1-1", "https://example.com/b-only");
  as(null);
});

const settingsOf = async (userId: string) => (await db.select().from(userSettings).where(eq(userSettings.userId, userId)))[0];

describe("who may use Settings", () => {
  const calls = {
    setSectionVisible: () => setSectionVisible("projects", true),
    unlockScalerSection: () => unlockScalerSection(CODE),
    createExportKey: () => createExportKey(),
    revokeExportKey: () => revokeExportKey("00000000-0000-4000-8000-000000000000"),
    downloadMyData: () => downloadMyData(),
    deleteMyAccount: () => deleteMyAccount("a-login"),
  };

  it.each(Object.entries(calls))("%s refuses signed-out, waitlisted and suspended users, changing nothing", async (_name, call) => {
    for (const who of [null, "w", "s"]) {
      as(who);
      expect(await call()).toMatchObject({ ok: false, error: { code: "signed-out" } });
    }
    expect(await db.select().from(userSettings)).toEqual([]);
    expect(await db.select().from(exportToken)).toEqual([]);
    expect((await db.select().from(user)).length).toBe(5);
  });

  it("the read functions redirect instead", async () => {
    await expect(getMySettings()).rejects.toThrow(/^REDIRECT \/login/);
    as("w");
    await expect(getMySettings()).rejects.toThrow("REDIRECT /waitlist");
    await expect(getMyExportKeys()).rejects.toThrow("REDIRECT /waitlist");
  });
});

describe("sections", () => {
  it("new users start with the defaults; the owner with everything", async () => {
    as("a");
    expect(await getMySettings()).toEqual({ sections: DEFAULT_SECTIONS, scalerUnlocked: false, githubLogin: "a-login", canDeleteAccount: true });
    as("owner");
    expect(await getMySettings()).toMatchObject({ sections: OWNER_SECTIONS, scalerUnlocked: true, canDeleteAccount: false });
  });

  it("saves a user's own choice only", async () => {
    as("a");
    expect(await setSectionVisible("projects", true)).toEqual({ ok: true, value: { ...DEFAULT_SECTIONS, projects: true } });
    expect(await setSectionVisible("reading", false)).toEqual({ ok: true, value: { ...DEFAULT_SECTIONS, projects: true, reading: false } });
    expect(await settingsOf("b")).toBeUndefined();
    as("b");
    expect((await getMySettings()).sections).toEqual(DEFAULT_SECTIONS);
  });

  it("Roadmap can't be turned off, and input is checked", async () => {
    as("a");
    for (const [section, on] of [["roadmap", false], ["nope", true], ["reading", "yes"]] as const) {
      expect(await setSectionVisible(section as never, on as never)).toMatchObject({ ok: false, error: { code: "invalid" } });
    }
  });

  it("the owner's first change keeps every other section on (their row starts all on, not with the defaults)", async () => {
    as("owner");
    expect(await settingsOf("owner")).toBeUndefined();
    expect(await setSectionVisible("career", false)).toEqual({ ok: true, value: { ...OWNER_SECTIONS, career: false } });
    expect(await settingsOf("owner")).toMatchObject({ showScaler: true, showProjects: true, showCareer: false, scalerUnlockedAt: expect.any(Date) });
  });

  it("Scaler can only be switched on once it's unlocked; the owner always can", async () => {
    as("a");
    expect(await setSectionVisible("scaler", true)).toMatchObject({ ok: false, error: { code: "invalid", message: "Enter the Scaler access code first." } });
    expect((await getMySettings()).sections.scaler).toBe(false);
    as("owner");
    expect(await setSectionVisible("scaler", false)).toMatchObject({ ok: true, value: { scaler: false } });
    expect(await setSectionVisible("scaler", true)).toMatchObject({ ok: true, value: { scaler: true } });
  });
});

describe("the Scaler access code", () => {
  beforeEach(async () => {
    as("owner");
    expect((await setScalerAccessCode(CODE)).ok).toBe(true);
    await db.delete(adminAudit);
  });

  it("unlocks Scaler and switches it on, for that user only (any case, spaces trimmed)", async () => {
    as("a");
    expect(await unlockScalerSection(`  ${CODE.toLowerCase()} `)).toEqual({ ok: true, value: { sections: { ...DEFAULT_SECTIONS, scaler: true } } });
    expect(await getMySettings()).toMatchObject({ scalerUnlocked: true });
    as("b");
    expect(await getMySettings()).toMatchObject({ scalerUnlocked: false, sections: { scaler: false } });
  });

  it("a rotated code doesn't lock out people who already unlocked", async () => {
    as("a");
    await unlockScalerSection(CODE);
    as("owner");
    await setScalerAccessCode("ANOTHER-MADE-UP-CODE");
    as("a");
    expect(await getMySettings()).toMatchObject({ scalerUnlocked: true, sections: { scaler: true } });
    expect((await setSectionVisible("scaler", false)).ok).toBe(true);
    expect((await setSectionVisible("scaler", true)).ok).toBe(true);
  });

  it("allows 5 wrong tries an hour, counts them in the audit log without the code, then refuses even the right one", async () => {
    as("a");
    for (let i = 1; i <= 5; i++) {
      const result = await unlockScalerSection(`WRONG-GUESS-${i}`);
      expect(result).toMatchObject({ ok: false, error: { code: "invalid", field: "code" } });
    }
    expect(await unlockScalerSection(CODE)).toMatchObject({ ok: false, error: { code: "rate-limited" } });
    expect((await getMySettings()).scalerUnlocked).toBe(false);
    const audit = await db.select().from(adminAudit).orderBy(asc(adminAudit.id));
    expect(audit.map((a) => [a.actorUserId, a.action, a.details])).toEqual([1, 2, 3, 4, 5].map((n) => ["a", "scaler_code_failed", { tryInHour: n }]));
    expect(JSON.stringify(audit)).not.toMatch(/WRONG-GUESS|MADE-UP-SCALER/);
    // Another user's allowance is their own.
    as("b");
    expect((await unlockScalerSection(CODE)).ok).toBe(true);
    // An hour later, the first user can try again.
    await db.update(userSettings).set({ scalerAttemptsSince: new Date(Date.now() - 61 * 60 * 1000) }).where(eq(userSettings.userId, "a"));
    as("a");
    expect((await unlockScalerSection(CODE)).ok).toBe(true);
    expect(await settingsOf("a")).toMatchObject({ scalerAttempts: 0, scalerUnlockedAt: expect.any(Date) });
  });

  it("says how many tries are left", async () => {
    as("a");
    expect(await unlockScalerSection("WRONG-GUESS")).toMatchObject({ error: { message: "That code isn't right. 4 tries left this hour." } });
  });

  it("with no code set, nothing unlocks", async () => {
    await db.delete((await import("@/db/schema")).appSetting).where(eq((await import("@/db/schema")).appSetting.key, "scaler_code_hash"));
    as("a");
    expect(await unlockScalerSection(CODE)).toMatchObject({ ok: false, error: { code: "not-found" } });
  });
});

describe("the Scaler lock on the server", () => {
  const scalerSaves = [() => toggleDone("s1-1", true), () => saveNote("s1-1", "A made-up note."), () => saveLink("s1-1", "https://example.com/s")];

  it("refuses Scaler saves while the section is locked, and allows them once it's unlocked", async () => {
    as("a");
    for (const save of scalerSaves) {
      expect(await save()).toEqual({ ok: false, error: { code: "invalid", field: "itemId", message: "The Scaler course is locked. Enter its access code in Settings first." } });
    }
    expect(await db.select().from(progress).where(eq(progress.userId, "a"))).toEqual([]);
    // Other sections save as usual.
    expect((await toggleDone("l2-1", true)).ok).toBe(true);
    as("owner");
    await setScalerAccessCode(CODE);
    as("a");
    expect((await unlockScalerSection(CODE)).ok).toBe(true);
    for (const save of scalerSaves) expect((await save()).ok).toBe(true);
  });

  it("the owner can always save Scaler items", async () => {
    as("owner");
    for (const save of scalerSaves) expect((await save()).ok).toBe(true);
  });

  it("leaves Scaler items out of Download my data while locked", async () => {
    await setDone("a", db, "s1-1", true);
    await setDone("a", db, "l1-1", true);
    as("a");
    const locked = await downloadMyData();
    if (!locked.ok) throw new Error("expected data");
    const data = JSON.parse(locked.value.json) as { progress: { itemId: string }[]; events: { itemId: string }[] };
    expect(data.progress.map((p) => p.itemId)).toEqual(["l1-1"]);
    expect(data.events.map((e) => e.itemId)).toEqual(["l1-1"]);
    as("owner");
    await setScalerAccessCode(CODE);
    as("a");
    await unlockScalerSection(CODE);
    const unlocked = await downloadMyData();
    if (!unlocked.ok) throw new Error("expected data");
    expect((JSON.parse(unlocked.value.json) as { progress: { itemId: string }[] }).progress.map((p) => p.itemId)).toEqual(["l1-1", "s1-1"]);
  });
});

describe("Claude export keys", () => {
  it("creates a key shown once, lists it without the key, and revokes it", async () => {
    as("a");
    const created = await createExportKey();
    if (!created.ok) throw new Error("expected a key");
    expect(created.value.key).toMatch(/^fdej_[A-Za-z0-9_-]{43}$/);
    const [stored] = await db.select().from(exportToken);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.tokenHash).not.toContain(created.value.key);
    const listed = await getMyExportKeys();
    expect(listed).toEqual([{ id: created.value.id, createdAt: created.value.createdAt, lastUsedAt: null }]);
    expect(JSON.stringify(listed)).not.toContain(created.value.key);
    expect(await revokeExportKey(created.value.id)).toEqual({ ok: true, value: { revoked: true } });
    expect(await getMyExportKeys()).toEqual([]);
    expect(await revokeExportKey(created.value.id)).toMatchObject({ ok: false, error: { code: "not-found" } });
  });

  it("one user can't see or revoke another's key", async () => {
    as("b");
    const bKey = await createExportKey();
    if (!bKey.ok) throw new Error("expected a key");
    as("a");
    expect(await getMyExportKeys()).toEqual([]);
    expect(await revokeExportKey(bKey.value.id)).toMatchObject({ ok: false, error: { code: "not-found" } });
    expect(await revokeExportKey("not-a-uuid")).toMatchObject({ ok: false, error: { code: "not-found" } });
    as("b");
    expect(await getMyExportKeys()).toHaveLength(1);
  });

  it("allows 5 working keys at a time, exactly, even when asked for many at once", async () => {
    as("a");
    const statements = recordStatements(db);
    statements.length = 0;
    const results = await Promise.all(Array.from({ length: 8 }, () => createExportKey()));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error.code === "invalid")).toBe(true);
    expect(await db.select().from(exportToken).where(eq(exportToken.userId, "a"))).toHaveLength(5);
    // Each count-and-insert ran under the user's own lock (PGlite runs them one at a time anyway).
    expect(statements.filter((q) => /^select pg_advisory_xact_lock\(7243, hashtext\(\$1\)\)$/.test(q))).toHaveLength(8);
    // Revoking one frees a slot.
    const first = results.find((r) => r.ok);
    if (!first?.ok) throw new Error("expected a key");
    await revokeExportKey(first.value.id);
    expect((await createExportKey()).ok).toBe(true);
  });
});

describe("Download my data", () => {
  it("holds the user's own profile, progress, events and settings, and nobody else's", async () => {
    as("a");
    await setSectionVisible("career", true);
    await setDone("a", db, "l2-1", true);
    await setNote("a", db, "journal", "A's made-up weekly note.");
    const result = await downloadMyData();
    if (!result.ok) throw new Error("expected data");
    expect(result.value.fileName).toMatch(/^fde-journey-data-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(result.value.json);
    expect(data).toMatchObject({
      format: "fde-journey-data",
      version: 1,
      profile: { name: "a Example", githubLogin: "a-login" },
      settings: { sections: { ...DEFAULT_SECTIONS, career: true }, scalerUnlocked: false, scalerUnlockedAt: null },
    });
    expect(data.progress.map((p: { itemId: string }) => p.itemId)).toEqual(["journal", "l2-1"]);
    expect(data.events.map((e: { itemId: string; kind: string }) => [e.itemId, e.kind])).toEqual([
      ["l2-1", "done"],
      ["journal", "note"],
    ]);
    expect(result.value.json).not.toContain(B_NOTE);
    expect(result.value.json).not.toContain("@example.com");
  });
});

describe("Delete my account", () => {
  it("needs the GitHub username typed (any case), then deletes everything of theirs and signs them out", async () => {
    as("a");
    await setDone("a", db, "l1-1", true);
    await createExportKey();
    await setSectionVisible("career", true);
    expect(await deleteMyAccount("")).toMatchObject({ ok: false, error: { code: "invalid", message: "Type your GitHub username to confirm." } });
    expect(await deleteMyAccount("b-login")).toMatchObject({ ok: false, error: { code: "invalid", message: "That doesn't match your username. Type a-login." } });
    await expect(deleteMyAccount("  A-LOGIN ")).rejects.toThrow("REDIRECT /login?status=deleted");
    for (const table of [progress, progressEvent, exportToken, userSettings, session, account]) {
      expect(await db.select().from(table).where(eq(table.userId, "a"))).toEqual([]);
    }
    expect(await db.select().from(user).where(eq(user.id, "a"))).toEqual([]);
    expect(request.cookiesSet).toContain("better-auth.session_token");
    const audit = await db.select().from(adminAudit);
    expect(audit.map((a) => [a.actorUserId, a.action, a.targetUserId, a.details])).toEqual([[null, "account_deleted", null, { status: "active" }]]);
    // B is untouched.
    expect((await db.select().from(progress).where(eq(progress.userId, "b"))).map((r) => r.note)).toEqual([B_NOTE]);
  });

  it("the owner's account can't be deleted here", async () => {
    as("owner");
    expect(await deleteMyAccount("owner-login")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await db.select().from(user).where(eq(user.id, "owner"))).toHaveLength(1);
  });
});

describe("the waitlist", () => {
  it("shows a waitlisted user their place; an active user has none", async () => {
    as("w");
    expect(await getMyWaitlistPlace()).toMatchObject({ name: "w Example", place: 1, joinedAt: expect.any(String) });
    as("a");
    expect(await getMyWaitlistPlace()).toBeNull();
    as(null);
    await expect(getMyWaitlistPlace()).rejects.toThrow(/^REDIRECT \/login/);
    as("s");
    await expect(getMyWaitlistPlace()).rejects.toThrow("REDIRECT /login?error=suspended");
  });

  it("leaving deletes the waitlisted user's account and signs them out; active users can't 'leave'", async () => {
    as("a");
    expect(await leaveWaitlist()).toMatchObject({ ok: false, error: { code: "forbidden" } });
    as("w");
    await expect(leaveWaitlist()).rejects.toThrow("REDIRECT /login?status=left-waitlist");
    expect(await db.select().from(user).where(eq(user.id, "w"))).toEqual([]);
    expect((await db.select().from(adminAudit)).map((a) => a.details)).toEqual([{ status: "waitlisted" }]);
    as(null);
    expect(await leaveWaitlist()).toMatchObject({ ok: false, error: { code: "signed-out" } });
  });
});
