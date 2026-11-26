// The admin data functions and actions (lib/admin-db.ts, app/actions/admin.ts), cross-user by
// design. First: every function refuses anyone without its permission (signed out, waitlisted, no
// permission, another permission) and changes nothing then. Then what each one does, and the rules
// on who may change whom. Made-up users only; nothing here is a real person.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { asc, eq, sql } from "drizzle-orm";
import * as actions from "@/app/actions/admin";
import type { Db } from "@/db/client";
import { adminAudit, appSetting, session, user, userPermission } from "@/db/schema";
import { PERMISSIONS, type Permission, type UserStatus } from "@/lib/access-types";
import * as adminDb from "@/lib/admin-db";
import { setDone, setLink, setNote } from "@/lib/progress-db";
import { PermissionError, SignedOutError } from "@/lib/session";
import { OWNER_ID, emptyDb, seedUser, setTestEnv } from "./support/db";

setTestEnv();

let db: Db;
const cookies = new Map<string, string>();
const as = (userId: string | null) => {
  request.headers = new Headers(userId ? { cookie: cookies.get(userId)! } : {});
};
let gh = 0;
async function add(userId: string, status: UserStatus = "active", permissions: Permission[] = [], extra: { name?: string; createdAt?: Date } = {}) {
  gh += 1;
  const githubId = userId === "owner" ? OWNER_ID : `92000000${String(gh).padStart(4, "0")}`;
  cookies.set(userId, (await seedUser(db, { userId, githubId, email: `${userId}@example.com`, githubLogin: userId, status, permissions, ...extra })).cookie);
}

const NOTE = "Admin must never see this made-up note.";
const LINK = "https://example.com/private-made-up-link";

beforeEach(async () => {
  process.env.SIGNUP_MODE = "capped";
  db = await emptyDb();
  cookies.clear();
  await add("owner", "active", [], { name: "Sam Example", createdAt: new Date("2026-11-01T00:00:00Z") });
  await add("alex", "active", [], { name: "Alex Example" });
  await add("w1", "waitlisted");
  await add("w2", "waitlisted");
  await add("s1", "suspended");
  // One user per permission, holding only that one (users.manage implies users.view).
  for (const p of PERMISSIONS) await add(`only-${p.replace(".", "-")}`, "active", p === "users.manage" ? ["users.manage", "users.view"] : [p]);
  await setDone("alex", db, "l1-1", true);
  await setNote("alex", db, "l1-1", NOTE);
  await setLink("alex", db, "l1-1", LINK);
  as(null);
});
afterEach(() => vi.restoreAllMocks());

const holder = (p: Permission) => `only-${p.replace(".", "-")}`;
const statusOf = async (id: string) => (await db.select({ s: user.status }).from(user).where(eq(user.id, id)))[0]?.s ?? null;
const auditRows = () => db.select().from(adminAudit).orderBy(asc(adminAudit.id));

/** Every exported function of lib/admin-db.ts, its permission, and a call that would change something. */
const FUNCTIONS: [keyof typeof adminDb, Permission, () => Promise<unknown>][] = [
  ["getAdminOverview", "metrics.view", () => adminDb.getAdminOverview()],
  ["listAdminUsers", "users.view", () => adminDb.listAdminUsers()],
  ["suspendUser", "users.manage", () => adminDb.suspendUser("alex")],
  ["reactivateSuspendedUser", "users.manage", () => adminDb.reactivateSuspendedUser("s1")],
  ["getWaitlistQueue", "waitlist.manage", () => adminDb.getWaitlistQueue()],
  ["letInFromWaitlist", "waitlist.manage", () => adminDb.letInFromWaitlist("w1")],
  ["letInNextFromWaitlist", "waitlist.manage", () => adminDb.letInNextFromWaitlist(2)],
  ["removeFromWaitlist", "waitlist.manage", () => adminDb.removeFromWaitlist("w2")],
  ["getSignupSettings", "settings.manage", () => adminDb.getSignupSettings()],
  ["setUserCap", "settings.manage", () => adminDb.setUserCap(500)],
  ["setScalerAccessCode", "settings.manage", () => adminDb.setScalerAccessCode("MADE-UP-CODE-1")],
  ["listAdmins", "admins.manage", () => adminDb.listAdmins()],
  ["findUserByGithubLogin", "admins.manage", () => adminDb.findUserByGithubLogin("alex")],
  ["setAdminPermissions", "admins.manage", () => adminDb.setAdminPermissions("alex", ["audit.view"])],
  ["removeAdmin", "admins.manage", () => adminDb.removeAdmin(holder("audit.view"))],
  ["listAuditLog", "audit.view", () => adminDb.listAuditLog()],
];

/** Everything an admin function could have changed. */
async function snapshot() {
  return {
    users: await db.select({ id: user.id, status: user.status }).from(user).orderBy(asc(user.id)),
    sessions: (await db.select({ id: session.id }).from(session)).length,
    permissions: await db.select({ u: userPermission.userId, p: userPermission.permission }).from(userPermission).orderBy(asc(userPermission.userId), asc(userPermission.permission)),
    settings: await db.select({ k: appSetting.key, v: appSetting.value }).from(appSetting).orderBy(asc(appSetting.key)),
    audit: (await auditRows()).length,
  };
}

describe("every admin function checks its permission first", () => {
  it("the list covers every exported function", () => {
    const exported = Object.entries(adminDb)
      .filter(([, v]) => typeof v === "function")
      .map(([k]) => k)
      .sort();
    expect(FUNCTIONS.map(([name]) => name).sort()).toEqual(exported);
  });

  describe.each(FUNCTIONS)("%s (%s)", (_name, permission, call) => {
    it("refuses signed-out visitors and waitlisted users as signed out, changing nothing", async () => {
      const before = await snapshot();
      for (const who of [null, "w1"]) {
        as(who);
        await expect(call()).rejects.toBeInstanceOf(SignedOutError);
      }
      expect(await snapshot()).toEqual(before);
    });

    it("refuses an active user without permissions, and an admin holding every other permission", async () => {
      await add("everything-else", "active", PERMISSIONS.filter((p) => p !== permission && !(permission === "users.view" && p === "users.manage")));
      const before = await snapshot();
      for (const who of ["alex", "everything-else"]) {
        as(who);
        await expect(call()).rejects.toBeInstanceOf(PermissionError);
      }
      expect(await snapshot()).toEqual(before);
    });

    it("works for an admin holding just this permission", async () => {
      as(holder(permission));
      const result = (await call()) as { ok?: boolean } | null;
      if (result && typeof result === "object" && "ok" in result) expect(result).toMatchObject({ ok: true });
    });

    it("works for the super admin", async () => {
      as("owner");
      const result = (await call()) as { ok?: boolean } | null;
      if (result && typeof result === "object" && "ok" in result) expect(result).toMatchObject({ ok: true });
    });
  });

  it("the actions answer forbidden or signed-out instead of throwing", async () => {
    as("alex");
    for (const result of [
      await actions.suspendUser("w1"),
      await actions.reactivateUser("s1"),
      await actions.letIn("w1"),
      await actions.letInNext(1),
      await actions.removeFromWaitlist("w1"),
      await actions.saveUserCap(10),
      await actions.saveScalerAccessCode("MADE-UP-CODE-2"),
      await actions.findUserForAdmin("alex"),
      await actions.saveAdminPermissions("w1", ["audit.view"]),
      await actions.removeAdmin(holder("audit.view")),
      await actions.loadMoreUsers("", "all", 50),
      await actions.loadMoreWaitlist(50),
      await actions.loadMoreAudit("all", 50),
    ]) {
      expect(result).toEqual({ ok: false, error: { code: "forbidden", message: "You no longer have permission to do this." } });
    }
    as(null);
    expect(await actions.suspendUser("w1")).toMatchObject({ ok: false, error: { code: "signed-out" } });
    as("w2");
    expect(await actions.letIn("w1")).toMatchObject({ ok: false, error: { code: "signed-out" } });
  });
});

describe("nobody but the super admin can touch the super admin", () => {
  it.each([
    ["suspend", () => adminDb.suspendUser("owner")],
    ["reactivate", () => adminDb.reactivateSuspendedUser("owner")],
    ["change permissions", () => adminDb.setAdminPermissions("owner", [])],
    ["remove as admin", () => adminDb.removeAdmin("owner")],
  ])("%s the owner: refused for every admin, the owner included", async (_label, call) => {
    await add("all-but-super", "active", [...PERMISSIONS]);
    for (const who of ["all-but-super", "owner"]) {
      as(who);
      expect(await call()).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(await statusOf("owner")).toBe("active");
    expect(await auditRows()).toEqual([]);
  });

  it("the owner can't be removed from the waitlist or let in (they never wait)", async () => {
    as("owner");
    expect(await adminDb.removeFromWaitlist("owner")).toMatchObject({ ok: false, error: { code: "not-found" } });
    expect(await statusOf("owner")).toBe("active");
  });
});

describe("suspend and reactivate (users.manage)", () => {
  it("suspending ends every session at once and is audited", async () => {
    as(holder("users.manage"));
    expect(await adminDb.suspendUser("alex")).toEqual({ ok: true, value: { status: "suspended" } });
    expect(await statusOf("alex")).toBe("suspended");
    expect(await db.select().from(session).where(eq(session.userId, "alex"))).toEqual([]);
    expect((await auditRows()).map((a) => [a.actorUserId, a.action, a.targetUserId])).toEqual([[holder("users.manage"), "suspended", "alex"]]);
    expect(await adminDb.suspendUser("alex")).toMatchObject({ ok: false, error: { code: "not-found" } });
  });

  it("nobody suspends themselves; only the super admin suspends an admin", async () => {
    as(holder("users.manage"));
    expect(await adminDb.suspendUser(holder("users.manage"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await adminDb.suspendUser(holder("audit.view"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await statusOf(holder("audit.view"))).toBe("active");
    as("owner");
    expect((await adminDb.suspendUser(holder("audit.view"))).ok).toBe(true);
    // Reactivating an admin is the super admin's too.
    as(holder("users.manage"));
    expect(await adminDb.reactivateSuspendedUser(holder("audit.view"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("reactivate respects the cap: with no free place they go to the waitlist", async () => {
    as("owner");
    await adminDb.setUserCap(0);
    expect(await adminDb.reactivateSuspendedUser("s1")).toEqual({ ok: true, value: { status: "waitlisted" } });
    await db.update(user).set({ status: "suspended" }).where(eq(user.id, "s1"));
    await adminDb.setUserCap(1000);
    expect(await adminDb.reactivateSuspendedUser("s1")).toEqual({ ok: true, value: { status: "active" } });
  });

  it("refuses ids that aren't ids", async () => {
    as("owner");
    for (const bad of ["", "x".repeat(200), "a b", null, 5, { id: "alex" }]) {
      expect(await adminDb.suspendUser(bad)).toMatchObject({ ok: false, error: { code: "invalid" } });
    }
  });
});

describe("waitlist (waitlist.manage)", () => {
  it("lists the queue in order with places, then lets people in and removes them", async () => {
    as(holder("waitlist.manage"));
    const queue = await adminDb.getWaitlistQueue();
    expect(queue.rows.map((r) => [r.place, r.id])).toEqual([
      [1, "w1"],
      [2, "w2"],
    ]);
    expect(queue).toMatchObject({ waiting: 2, nextOffset: null });
    expect(await adminDb.letInFromWaitlist("w2")).toEqual({ ok: true, value: { status: "active" } });
    expect(await adminDb.removeFromWaitlist("w1")).toEqual({ ok: true, value: { removed: true } });
    expect(await db.select().from(user).where(eq(user.id, "w1"))).toEqual([]);
    expect(await adminDb.removeFromWaitlist("alex")).toMatchObject({ ok: false, error: { code: "not-found" } });
    expect(await statusOf("alex")).toBe("active");
  });

  it("never lets anyone in past the cap", async () => {
    as("owner");
    await adminDb.setUserCap(0);
    as(holder("waitlist.manage"));
    expect(await adminDb.letInFromWaitlist("w1")).toMatchObject({ ok: false, error: { code: "no-place" } });
    expect(await adminDb.letInNextFromWaitlist(5)).toMatchObject({ ok: false, error: { code: "no-place" } });
    expect(await statusOf("w1")).toBe("waitlisted");
  });

  it("checks how many to let in", async () => {
    as(holder("waitlist.manage"));
    for (const bad of [0, -1, 1.5, 1001, "2", null]) expect(await adminDb.letInNextFromWaitlist(bad)).toMatchObject({ ok: false, error: { code: "invalid", field: "count" } });
    expect(await adminDb.letInNextFromWaitlist(10)).toEqual({ ok: true, value: { admitted: 2 } });
  });
});

describe("sign-up settings (settings.manage)", () => {
  it("saves the cap within 0 to 1,000, and raising it lets people in", async () => {
    as(holder("settings.manage"));
    for (const bad of [-1, 1001, 2.5, "10", null]) expect(await adminDb.setUserCap(bad)).toMatchObject({ ok: false, error: { code: "invalid", field: "cap" } });
    const taken = (await adminDb.getSignupSettings()).taken;
    expect(await adminDb.setUserCap(taken)).toEqual({ ok: true, value: { cap: taken, previous: 100, admitted: 0 } });
    expect(await adminDb.setUserCap(taken + 1)).toEqual({ ok: true, value: { cap: taken + 1, previous: taken, admitted: 1 } });
    expect(await statusOf("w1")).toBe("active");
    expect(await statusOf("w2")).toBe("waitlisted");
  });

  it("stores the Scaler access code only as a hash, and never puts it in the audit log", async () => {
    as(holder("settings.manage"));
    expect(await adminDb.getSignupSettings()).toMatchObject({ scalerCodeSet: false, scalerCodeUpdatedAt: null });
    for (const bad of ["short", "x".repeat(65), 12345678, null]) expect(await adminDb.setScalerAccessCode(bad)).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await adminDb.setScalerAccessCode("  made-up-code-77 ")).toEqual({ ok: true, value: { set: true } });
    const [stored] = await db.select().from(appSetting).where(eq(appSetting.key, "scaler_code_hash"));
    expect(stored.value).toMatch(/^scrypt\$/);
    expect(stored.value.toUpperCase()).not.toContain("MADE-UP-CODE-77");
    const audit = await auditRows();
    expect(audit.map((a) => a.action)).toEqual(["scaler_code_set"]);
    expect(JSON.stringify(audit).toUpperCase()).not.toContain("MADE-UP-CODE-77");
    expect(await adminDb.getSignupSettings()).toMatchObject({ scalerCodeSet: true, scalerCodeUpdatedAt: expect.any(String) });
  });
});

describe("admins (admins.manage)", () => {
  it("adds, changes and removes an admin, adding implied permissions, all audited", async () => {
    as("owner");
    expect(await adminDb.setAdminPermissions("alex", ["users.manage"])).toEqual({ ok: true, value: { permissions: ["users.view", "users.manage"] } });
    expect(await adminDb.setAdminPermissions("alex", ["users.view", "audit.view"])).toEqual({ ok: true, value: { permissions: ["users.view", "audit.view"] } });
    expect(await adminDb.removeAdmin("alex")).toEqual({ ok: true, value: { permissions: [] } });
    const audit = await auditRows();
    expect(audit.map((a) => [a.action, a.targetUserId, a.details])).toEqual([
      ["admin_added", "alex", { gave: ["users.manage", "users.view"], took: [] }],
      ["permissions_changed", "alex", { gave: ["audit.view"], took: ["users.manage"] }],
      ["admin_removed", "alex", { gave: [], took: ["audit.view", "users.view"] }],
    ]);
  });

  it("only the super admin gives or takes away “Manage admins”", async () => {
    as(holder("admins.manage"));
    expect(await adminDb.setAdminPermissions("alex", ["admins.manage"])).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect((await adminDb.setAdminPermissions("alex", ["audit.view"])).ok).toBe(true);
    as("owner");
    expect((await adminDb.setAdminPermissions("alex", ["audit.view", "admins.manage"])).ok).toBe(true);
    as(holder("admins.manage"));
    expect(await adminDb.setAdminPermissions("alex", ["audit.view"])).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await adminDb.removeAdmin("alex")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    // Other permissions of an admins.manage holder can still change, keeping admins.manage.
    expect(await adminDb.setAdminPermissions("alex", ["metrics.view", "admins.manage"])).toEqual({ ok: true, value: { permissions: ["metrics.view", "admins.manage"] } });
  });

  it("nobody changes their own permissions, and only people with a place become admins", async () => {
    as(holder("admins.manage"));
    expect(await adminDb.setAdminPermissions(holder("admins.manage"), ["metrics.view"])).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await adminDb.removeAdmin(holder("admins.manage"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await adminDb.setAdminPermissions("w1", ["metrics.view"])).toMatchObject({ ok: false, error: { code: "not-found" } });
    expect(await adminDb.setAdminPermissions("s1", ["metrics.view"])).toMatchObject({ ok: false, error: { code: "not-found" } });
    expect(await adminDb.setAdminPermissions("alex", ["root"])).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await db.select().from(userPermission).where(eq(userPermission.userId, "w1"))).toEqual([]);
  });

  it("lists the owner first and the other admins with their permissions; finds people by username", async () => {
    as("owner");
    const list = await adminDb.listAdmins();
    expect(list.owner).toMatchObject({ id: "owner", name: "Sam Example", githubLogin: "owner" });
    expect(list.admins.find((a) => a.id === holder("users.manage"))?.permissions).toEqual(["users.view", "users.manage"]);
    expect(list.admins.some((a) => a.id === "alex")).toBe(false);
    expect(await adminDb.findUserByGithubLogin("@ALEX")).toMatchObject([{ id: "alex", status: "active", isOwner: false, permissions: [], createdAt: expect.any(String) }]);
    // Dates only: when they last signed in or saved, or null for never.
    expect((await adminDb.findUserByGithubLogin("alex"))[0]).toHaveProperty("lastActiveAt");
    expect(await adminDb.findUserByGithubLogin("w1")).toMatchObject([{ status: "waitlisted" }]);
    expect(await adminDb.findUserByGithubLogin("nobody-here")).toEqual([]);
    expect(await adminDb.findUserByGithubLogin("not a login")).toEqual([]);
  });

  it("lists everyone who shares a username (someone renamed and hasn't signed in since), newest first", async () => {
    await add("alex-old", "active", [], { name: "Alex Renamed", createdAt: new Date("2026-10-01T00:00:00Z") });
    await db.update(user).set({ githubLogin: "alex" }).where(eq(user.id, "alex-old"));
    as("owner");
    const found = await adminDb.findUserByGithubLogin("alex");
    expect(found.map((f) => f.id)).toEqual(["alex", "alex-old"]);
    expect(JSON.stringify(found)).not.toContain("@example.com");
  });
});

describe("what admins can read: counts and dates, never notes, links or emails", () => {
  it("overview: places (owner not counted), waitlist, activity, this week's done items, sign-ups per week", async () => {
    await db.update(user).set({ lastActiveAt: new Date() }).where(eq(user.id, "alex"));
    await db.update(user).set({ lastActiveAt: new Date(Date.now() - 20 * 24 * 3600 * 1000) }).where(eq(user.id, "owner"));
    as(holder("metrics.view"));
    const overview = await adminDb.getAdminOverview();
    expect(overview).toMatchObject({ taken: 8, cap: 100, free: 92, waiting: 2, active7: 1, active30: 2, doneThisWeek: 1 });
    expect(overview.signupsPerWeek).toHaveLength(8);
    expect(overview.signupsPerWeek[0].weekOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${overview.signupsPerWeek[0].weekOf}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(overview.signupsPerWeek[0].count).toBe(11);
  });

  it("users: search, filter, pages of 50, and done counts by section", async () => {
    as(holder("users.view"));
    const all = await adminDb.listAdminUsers();
    expect(all.total).toBe(12);
    const alex = all.rows.find((r) => r.id === "alex");
    expect(alex).toMatchObject({ name: "Alex Example", githubLogin: "alex", status: "active", isAdmin: false, done: { roadmap: 1, total: 1 } });
    expect((await adminDb.listAdminUsers({ q: "alex ex" })).rows.map((r) => r.id)).toEqual(["alex"]);
    expect((await adminDb.listAdminUsers({ q: "W1" })).rows.map((r) => r.id)).toEqual(["w1"]);
    expect((await adminDb.listAdminUsers({ q: "%" })).rows).toEqual([]);
    expect((await adminDb.listAdminUsers({ filter: "waitlisted" })).rows.map((r) => r.id).sort()).toEqual(["w1", "w2"]);
    expect((await adminDb.listAdminUsers({ filter: "suspended" })).rows.map((r) => r.id)).toEqual(["s1"]);
    expect((await adminDb.listAdminUsers({ filter: "admins" })).total).toBe(8);
    await db.execute(sql`insert into "user" (id, name, email, created_at, updated_at) select 'bulk' || i, 'Bulk Example', 'bulk' || i || '@example.com', timestamptz '2026-10-01' + i * interval '1 minute', now() from generate_series(1, 45) i`);
    const first = await adminDb.listAdminUsers();
    expect(first.rows).toHaveLength(50);
    expect(first.nextOffset).toBe(50);
    const second = await adminDb.listAdminUsers({ offset: first.nextOffset });
    expect(second.rows).toHaveLength(7);
    expect(second.nextOffset).toBeNull();
  });

  it("nothing an admin reads holds a note, a link or an email address", async () => {
    as("owner");
    await adminDb.suspendUser("alex");
    const everything = JSON.stringify([
      await adminDb.getAdminOverview(),
      await adminDb.listAdminUsers(),
      await adminDb.getWaitlistQueue(),
      await adminDb.getSignupSettings(),
      await adminDb.listAdmins(),
      await adminDb.findUserByGithubLogin("alex"),
      await adminDb.listAuditLog(),
    ]);
    expect(everything).not.toContain(NOTE);
    expect(everything).not.toContain(LINK);
    expect(everything).not.toContain("@example.com");
  });
});

describe("audit log (audit.view)", () => {
  it("newest first, filtered, and a deleted person shows as a deleted account", async () => {
    as("owner");
    await adminDb.suspendUser("alex");
    await adminDb.reactivateSuspendedUser("alex");
    await adminDb.setUserCap(90);
    await adminDb.removeFromWaitlist("w2");
    as(holder("audit.view"));
    const log = await adminDb.listAuditLog();
    expect(log.rows.map((r) => r.action)).toEqual(["waitlist_removed", "cap_changed", "reactivated", "suspended"]);
    expect(log.rows[0]).toMatchObject({ actor: { id: "owner", githubLogin: "owner" }, target: null, targetDeleted: true });
    expect(log.rows[1]).toMatchObject({ target: null, targetDeleted: false, details: { from: 100, to: 90, admitted: 0 } });
    expect(log.rows[3]).toMatchObject({ target: { id: "alex", name: "Alex Example" }, targetDeleted: false });
    expect((await adminDb.listAuditLog({ filter: "suspended" })).rows.map((r) => r.action)).toEqual(["suspended"]);
    expect((await adminDb.listAuditLog({ filter: "reactivated" })).rows.map((r) => r.action)).toEqual(["reactivated"]);
    expect((await adminDb.listAuditLog({ filter: "nonsense" })).rows).toHaveLength(4);
    // After alex deletes their account, their rows say "a deleted account".
    await db.delete(user).where(eq(user.id, "alex"));
    const after = await adminDb.listAuditLog({ filter: "suspended" });
    expect(after.rows[0]).toMatchObject({ target: null, targetDeleted: true });
  });
});
