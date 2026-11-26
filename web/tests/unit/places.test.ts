// Places under the user cap (lib/places.ts): who gets a place, in what order, and that nothing ever
// takes the places past the cap, even when many changes arrive at once. Runs on PGlite (the
// transaction path) and through the real Neon HTTP driver against a fake endpoint (the batch path
// production uses). Made-up users only.
//
// A limit to keep in mind: PGlite is one connection, so the "at the same moment" tests below run
// their transactions one at a time, never truly interleaved. They prove the counting and the
// order are right and that every change takes the lock (asserted below); that the lock makes
// interleaved transactions on Neon safe rests on how Postgres locks and snapshots work (the
// comment at the top of lib/places.ts). The Neon branch rehearsal in docs/M4b-ROLLOUT.md is the
// check against a real server.
import type { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Db, openDb } from "@/db/client";
import { adminAudit, user } from "@/db/schema";
import type { UserStatus } from "@/lib/access-types";
import { letInNext, letInOne, placeNewUser, placesSummary, reactivateUser, runLocked, setCapAndAdmit, waitlistPosition } from "@/lib/places";
import { emptyDb, recordStatements, seedUser, setTestEnv } from "./support/db";
import { type NeonRequest, fakeNeon } from "./support/fake-neon";

setTestEnv();
const OWNER = "900000000001";

let db: Db;
/** Every statement PGlite ran, transactions included. */
let statements: string[] = [];
beforeEach(async () => {
  db = await emptyDb();
  statements = recordStatements(db);
  statements.length = 0;
});

/** The statements sent inside transactions that took the places lock, as [lock, change] pairs. */
const lockedChanges = () => {
  const out: string[] = [];
  statements.forEach((s, i) => {
    if (s === "select pg_advisory_xact_lock(7243100001)") out.push(statements[i + 1] ?? "");
  });
  return out;
};

let n = 0;
/** A made-up user. Waitlisted users join one second apart, in the order they are added. */
async function addUser(status: UserStatus, { githubId, joined }: { githubId?: string; joined?: Date } = {}) {
  n += 1;
  const userId = `u${String(n).padStart(4, "0")}`;
  const at = joined ?? new Date(Date.UTC(2026, 10, 1, 0, 0, n));
  await seedUser(db, { userId, githubId: githubId ?? `9100000${String(n).padStart(5, "0")}`, email: `${userId}@example.com`, status, createdAt: at, waitlistedAt: at });
  return userId;
}
const addOwner = () => addUser("active", { githubId: OWNER });
const setCap = (cap: number) => db.execute(sql`update "app_setting" set "value" = ${String(cap)} where "key" = 'user_cap'`);
const statusOf = async (id: string) => (await db.select({ s: user.status }).from(user).where(eq(user.id, id)))[0]?.s;
const audit = () => db.select({ actor: adminAudit.actorUserId, action: adminAudit.action, target: adminAudit.targetUserId, details: adminAudit.details }).from(adminAudit).orderBy(asc(adminAudit.id));

describe("placesSummary", () => {
  it("counts active users but never the owner, and never suspended or waitlisted users", async () => {
    await addOwner();
    await addUser("active");
    await addUser("active");
    await addUser("suspended");
    await addUser("waitlisted");
    await setCap(5);
    expect(await placesSummary(db, OWNER)).toEqual({ taken: 2, cap: 5, free: 3, waiting: 1 });
    await setCap(1);
    expect(await placesSummary(db, OWNER)).toEqual({ taken: 2, cap: 1, free: 0, waiting: 1 });
  });
});

describe("a new sign-up (placeNewUser)", () => {
  it("gets a place while there is one, then joins the waitlist", async () => {
    await addOwner();
    await setCap(2);
    const a = await addUser("waitlisted");
    const b = await addUser("waitlisted");
    const c = await addUser("waitlisted");
    expect(await placeNewUser(db, a, OWNER)).toBe("active");
    expect(await placeNewUser(db, b, OWNER)).toBe("active");
    expect(await placeNewUser(db, c, OWNER)).toBe("waitlisted");
    expect(await placesSummary(db, OWNER)).toMatchObject({ taken: 2, free: 0, waiting: 1 });
    // Getting a place clears the waitlist time; waiting keeps it.
    const rows = await db.select({ id: user.id, waitlistedAt: user.waitlistedAt, activatedAt: user.activatedAt }).from(user).where(eq(user.id, a));
    expect(rows[0]).toMatchObject({ waitlistedAt: null, activatedAt: expect.any(Date) });
  });

  it("never jumps the queue: people already waiting get free places first", async () => {
    await setCap(1);
    await addUser("active");
    const early = await addUser("waitlisted");
    await setCap(2); // a place opens (as if someone left); `early` is still waiting
    const late = await addUser("waitlisted");
    expect(await placeNewUser(db, late, OWNER)).toBe("waitlisted");
    expect(await statusOf(early)).toBe("waitlisted");
    // With two free places, the first two in line could both have one: the newcomer is second.
    await setCap(3);
    expect(await placeNewUser(db, late, OWNER)).toBe("active");
  });

  it("with a cap of 0, nobody new gets a place", async () => {
    await setCap(0);
    const a = await addUser("waitlisted");
    expect(await placeNewUser(db, a, OWNER)).toBe("waitlisted");
  });

  it("fails closed when the cap setting is missing", async () => {
    await db.execute(sql`delete from "app_setting" where "key" = 'user_cap'`);
    const a = await addUser("waitlisted");
    expect(await placeNewUser(db, a, OWNER)).toBe("waitlisted");
  });

  it("leaves anyone who isn't waiting alone", async () => {
    const s = await addUser("suspended");
    expect(await placeNewUser(db, s, OWNER)).toBe("suspended");
    expect(await placeNewUser(db, "no-such-user", OWNER)).toBeNull();
  });

  it("many sign-ups at the same moment never take the places past the cap, and the earliest win", async () => {
    await addOwner();
    await setCap(3);
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) ids.push(await addUser("waitlisted"));
    const results = await Promise.all([...ids].reverse().map((id) => placeNewUser(db, id, OWNER)));
    expect(results.filter((r) => r === "active")).toHaveLength(3);
    expect(await placesSummary(db, OWNER)).toMatchObject({ taken: 3, cap: 3, waiting: 9 });
    expect(await Promise.all(ids.slice(0, 3).map(statusOf))).toEqual(["active", "active", "active"]);
  });
});

describe("every change that gives out a place takes the lock first (PGlite's transaction path too)", () => {
  it("sign-up, let in, let in the next N, reactivate and the cap", async () => {
    const admin = await addOwner();
    const w = await addUser("waitlisted");
    const s = await addUser("suspended");
    await placeNewUser(db, w, OWNER);
    await letInOne(db, w, admin, OWNER);
    await letInNext(db, 1, admin, OWNER);
    await reactivateUser(db, s, admin, OWNER);
    await setCapAndAdmit(db, 50, admin, OWNER);
    const changes = lockedChanges();
    expect(changes).toHaveLength(5);
    expect(changes.every((c) => /update "user" set\s+"status"/.test(c) || /insert into "app_setting"/.test(c))).toBe(true);
  });
});

describe("let in (letInOne, letInNext)", () => {
  it("only ever updates someone who is still waitlisted when the update runs", async () => {
    const admin = await addOwner();
    const w = await addUser("waitlisted");
    await letInOne(db, w, admin, OWNER);
    await placeNewUser(db, w, OWNER);
    // The guard sits on the update itself, where Postgres re-checks a row that changed while the
    // statement waited (a suspension landing at that moment), not only in the CTE's snapshot.
    for (const change of lockedChanges()) {
      expect(change).toMatch(/update "user" set "status" = 'active'[^]*?where "id" = \(select "id" from (target|me)\) and "status" = 'waitlisted'/);
    }
  });

  it("never revives a suspended or deleted person: they are not waiting, whatever the free places", async () => {
    const admin = await addOwner();
    await setCap(5);
    const suspended = await addUser("waitlisted");
    const removed = await addUser("waitlisted");
    await db.update(user).set({ status: "suspended" }).where(eq(user.id, suspended));
    await db.delete(user).where(eq(user.id, removed));
    expect(await letInOne(db, suspended, admin, OWNER)).toBe("not-waiting");
    expect(await letInOne(db, removed, admin, OWNER)).toBe("not-waiting");
    expect(await statusOf(suspended)).toBe("suspended");
    expect(await audit()).toEqual([]);
  });

  it("lets one person in when a place is free, and audits it", async () => {
    const admin = await addOwner();
    await setCap(1);
    const a = await addUser("waitlisted");
    const b = await addUser("waitlisted");
    expect(await letInOne(db, b, admin, OWNER)).toBe("let-in");
    expect(await letInOne(db, a, admin, OWNER)).toBe("no-place");
    expect(await letInOne(db, b, admin, OWNER)).toBe("not-waiting");
    expect(await audit()).toEqual([{ actor: admin, action: "let_in", target: b, details: {} }]);
  });

  it("lets the next N in, in order, never past the cap", async () => {
    const admin = await addOwner();
    await setCap(3);
    await addUser("active");
    const waiting = [await addUser("waitlisted"), await addUser("waitlisted"), await addUser("waitlisted"), await addUser("waitlisted")];
    expect(await letInNext(db, 5, admin, OWNER)).toBe(2);
    expect(await Promise.all(waiting.map(statusOf))).toEqual(["active", "active", "waitlisted", "waitlisted"]);
    expect(await letInNext(db, 5, admin, OWNER)).toBe(0);
    expect(await audit()).toEqual([{ actor: admin, action: "let_in_many", target: null, details: { count: 2 } }]);
  });

  it("two admins letting people in at once still stop at the cap", async () => {
    const admin = await addOwner();
    await setCap(4);
    for (let i = 0; i < 10; i++) await addUser("waitlisted");
    const admitted = await Promise.all([letInNext(db, 3, admin, OWNER), letInNext(db, 3, admin, OWNER), letInNext(db, 3, admin, OWNER)]);
    expect(admitted.reduce((a, b) => a + b, 0)).toBe(4);
    expect(await placesSummary(db, OWNER)).toMatchObject({ taken: 4, free: 0, waiting: 6 });
  });
});

describe("reactivate", () => {
  it("gives the place back when one is free, otherwise sends them to the back of the waitlist", async () => {
    const admin = await addOwner();
    await setCap(1);
    const s1 = await addUser("suspended");
    const s2 = await addUser("suspended");
    const waiting = await addUser("waitlisted", { joined: new Date("2026-11-02T00:00:00Z") });
    expect(await reactivateUser(db, s1, admin, OWNER)).toBe("active");
    expect(await reactivateUser(db, s2, admin, OWNER)).toBe("waitlisted");
    expect(await reactivateUser(db, s2, admin, OWNER)).toBe("not-suspended");
    expect((await waitlistPosition(db, waiting))?.place).toBe(1);
    expect((await waitlistPosition(db, s2))?.place).toBe(2);
    expect((await audit()).map((a) => a.action)).toEqual(["reactivated", "reactivated_to_waitlist"]);
  });
});

describe("changing the cap (setCapAndAdmit)", () => {
  it("raising it lets the earliest waiting people in, up to the new free places", async () => {
    const admin = await addOwner();
    await setCap(1);
    await addUser("active");
    const waiting = [await addUser("waitlisted"), await addUser("waitlisted"), await addUser("waitlisted")];
    expect(await setCapAndAdmit(db, 3, admin, OWNER)).toEqual({ previous: 1, admitted: 2 });
    expect(await Promise.all(waiting.map(statusOf))).toEqual(["active", "active", "waitlisted"]);
    expect(await placesSummary(db, OWNER)).toMatchObject({ taken: 3, cap: 3, waiting: 1 });
    expect(await audit()).toEqual([{ actor: admin, action: "cap_changed", target: null, details: { from: 1, to: 3, admitted: 2 } }]);
  });

  it("lowering it lets nobody in and takes no place away", async () => {
    const admin = await addOwner();
    await setCap(3);
    await addUser("active");
    await addUser("active");
    const w = await addUser("waitlisted");
    expect(await setCapAndAdmit(db, 1, admin, OWNER)).toEqual({ previous: 3, admitted: 0 });
    expect(await statusOf(w)).toBe("waitlisted");
    expect(await placesSummary(db, OWNER)).toMatchObject({ taken: 2, cap: 1, free: 0 });
  });

  it("saving the same cap writes no audit row", async () => {
    const admin = await addOwner();
    expect(await setCapAndAdmit(db, 100, admin, OWNER)).toEqual({ previous: 100, admitted: 0 });
    expect(await audit()).toEqual([]);
  });
});

describe("waitlistPosition", () => {
  it("is one plus the number of people who joined earlier", async () => {
    const a = await addUser("waitlisted");
    const b = await addUser("waitlisted");
    const active = await addUser("active");
    expect(await waitlistPosition(db, a)).toEqual({ place: 1, joinedAt: expect.any(Date) });
    expect((await waitlistPosition(db, b))?.place).toBe(2);
    expect(await waitlistPosition(db, active)).toBeNull();
  });
});

describe("through the Neon HTTP driver (production's batch transaction)", () => {
  let pg: PGlite;
  let neonDb: Db;
  let requests: NeonRequest[];
  let originalFetch: typeof neonConfig.fetchFunction;

  beforeAll(async () => {
    const local = await openDb({ kind: "pglite", dataDir: null });
    pg = (local as unknown as { $client: PGlite }).$client;
    const fake = fakeNeon(pg);
    requests = fake.requests;
    originalFetch = neonConfig.fetchFunction;
    neonConfig.fetchFunction = fake.fetchFunction;
    neonDb = await openDb({ kind: "neon", url: "postgresql://someone:not-a-password@db.example.invalid/journey" });
  });
  afterAll(async () => {
    neonConfig.fetchFunction = originalFetch;
    await pg.close();
  });

  it("sends one batch: READ COMMITTED, the lock, then the change", async () => {
    requests.length = 0;
    const rows = await runLocked<{ one: number }>(neonDb, sql`select 1 as one`);
    expect(rows).toEqual([{ one: 1 }]);
    expect(requests.map((r) => [r.batch, r.query])).toEqual([
      [1, "set transaction isolation level read committed"],
      [1, "select pg_advisory_xact_lock(7243100001)"],
      [1, "select 1 as one"],
    ]);
  });

  it("gives places correctly, and never past the cap when many arrive at once", async () => {
    await pg.query(`insert into "user" (id, name, email, email_verified, status, waitlisted_at, created_at, updated_at)
      select 'n' || i, 'Test User', 'n' || i || '@example.com', true, 'waitlisted', timestamptz '2026-11-01' + i * interval '1 second', now(), now()
      from generate_series(1, 8) i`);
    await pg.query(`update app_setting set value = '3' where key = 'user_cap'`);
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => placeNewUser(neonDb, `n${8 - i}`, OWNER)));
    expect(results.filter((r) => r === "active")).toHaveLength(3);
    expect((await pg.query<{ id: string }>(`select id from "user" where status = 'active' order by id`)).rows.map((r) => r.id)).toEqual(["n1", "n2", "n3"]);
    expect(await placesSummary(neonDb, OWNER)).toEqual({ taken: 3, cap: 3, free: 0, waiting: 5 });
    expect(await setCapAndAdmit(neonDb, 4, "n1", OWNER)).toEqual({ previous: 3, admitted: 1 });
  });
});
