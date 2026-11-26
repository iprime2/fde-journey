// The tracker import: made-up fixtures in tests/fixtures/import, run twice.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { trackerContent } from "@/content/tracker-data";
import { JOURNAL_ID, listItems } from "@/lib/ids";
import { linkProblem } from "@/lib/notes";
import { openScriptDb } from "../../scripts/lib/db.mjs";
import { applyImport, collectRecords, findOwnerUserId, normalizeRecord, planImport, readExisting, summaryLines } from "../../scripts/lib/import-core.mjs";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "import");
const RECORDS = path.join(FIXTURES, "records");
const knownIds = new Set([...listItems(trackerContent).map((i) => i.id), JOURNAL_ID]);

type ScriptDb = Awaited<ReturnType<typeof openScriptDb>>;
let db: ScriptDb;

/** Made-up GitHub ids and users. The import writes for the owner only. */
const OWNER_GITHUB_ID = "900000000001";
const OTHER_GITHUB_ID = "900000000002";
const OWNER = "import-owner";
const OTHER = "import-other";

/** A made-up user with a GitHub account, as Better Auth would create at first sign-in. */
async function addUser(target: ScriptDb, userId: string, githubId: string) {
  await target.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, 'Test User', $2, true, now(), now())`,
    [userId, `${userId}@example.com`],
  );
  await target.query(
    `insert into account (id, account_id, provider_id, user_id, created_at, updated_at) values ($1, $2, 'github', $3, now(), now())`,
    [`${userId}-gh`, githubId, userId],
  );
}

beforeAll(async () => {
  db = await openScriptDb({ kind: "pglite", dataDir: null });
  await addUser(db, OWNER, OWNER_GITHUB_ID);
  await addUser(db, OTHER, OTHER_GITHUB_ID);
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.query("delete from progress");
});

async function runImport(input: string) {
  const collected = collectRecords(input);
  const ids = collected.entries.map((e) => e.id).filter((id): id is string => !!id && knownIds.has(id));
  const plan = planImport(collected.entries, await readExisting(db, OWNER, ids), knownIds, linkProblem);
  const applied = await applyImport(db, OWNER, plan.writes);
  return { collected, plan, applied };
}

describe("import", () => {
  it("imports known records, reports the rest, and changes nothing on a second run", async () => {
    const first = await runImport(RECORDS);
    expect(first.collected.files).toBe(7);
    expect(first.collected.unreadable).toBe(1);
    expect(first.plan.counts).toMatchObject({ records: 6, unknown: 1, invalid: 1, duplicates: 0, linksDropped: 1, unchanged: 0 });
    expect(first.applied).toEqual({ inserted: 4, updated: 0, skipped: 0 });

    const rows = await db.query("select user_id, item_id, done, note, link, done_at, updated_at from progress order by item_id");
    expect(new Set(rows.map((r) => r.user_id))).toEqual(new Set([OWNER]));
    expect(rows.map((r) => r.item_id)).toEqual(["journal", "l1-1", "l1-2", "r1-1-3"]);
    const l11 = rows.find((r) => r.item_id === "l1-1");
    expect(l11).toMatchObject({ done: true, note: "Made-up note for the import test.", link: "https://example.com/demo" });
    expect(new Date(l11.done_at).toISOString()).toBe("2026-11-25T09:30:00.000Z");
    expect(new Date(l11.updated_at).toISOString()).toBe("2026-11-25T09:31:00.000Z");
    expect(rows.find((r) => r.item_id === "l1-2")).toMatchObject({ done: false, note: "Wrapped record, invented text.", done_at: null });
    expect(rows.find((r) => r.item_id === "r1-1-3")).toMatchObject({ done: true, link: "" });

    const second = await runImport(RECORDS);
    expect(second.applied).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    expect(second.plan.counts.unchanged).toBe(4);
    expect(await db.query("select user_id, item_id, done, note, link, done_at, updated_at from progress order by item_id")).toEqual(rows);
  });

  it("never overwrites a newer change made in the app", async () => {
    await runImport(RECORDS);
    await db.query("update progress set note = 'Changed in the app.', updated_at = '2026-12-01T00:00:00Z' where user_id = $1 and item_id = 'l1-1'", [OWNER]);
    const again = await runImport(RECORDS);
    expect(again.applied).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    const [row] = await db.query("select note from progress where user_id = $1 and item_id = 'l1-1'", [OWNER]);
    expect(row.note).toBe("Changed in the app.");
  });

  it("updates a row when the export is newer", async () => {
    await db.query("insert into progress (user_id, item_id, done, updated_at) values ($1, 'l1-1', false, '2026-11-01T00:00:00Z')", [OWNER]);
    const result = await runImport(RECORDS);
    expect(result.applied).toEqual({ inserted: 3, updated: 1, skipped: 0 });
  });

  it("reads a single file holding an array of records with ids", async () => {
    const result = await runImport(path.join(FIXTURES, "array.json"));
    expect(result.plan.counts).toMatchObject({ records: 3, unknown: 1, invalid: 0 });
    expect(result.applied.inserted).toBe(2);
    const rows = await db.query("select item_id, done_at, updated_at from progress where user_id = $1 order by item_id", [OWNER]);
    expect(rows.map((r) => r.item_id)).toEqual(["k1", "pp1"]);
    // No timestamps in the export: a fixed one, so a second run still changes nothing.
    expect(new Date(rows[1].updated_at).toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect((await runImport(path.join(FIXTURES, "array.json"))).applied.inserted).toBe(0);
  });

  it("keeps the newest of duplicate records", async () => {
    const entries = [
      { id: "l1-1", value: { done: true, updatedAt: "2026-11-02T00:00:00Z", doneAt: "2026-11-02T00:00:00Z" } },
      { id: "l1-1", value: { done: false, updatedAt: "2026-11-01T00:00:00Z" } },
    ];
    const plan = planImport(entries, new Map(), knownIds, linkProblem);
    expect(plan.counts.duplicates).toBe(1);
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0].done).toBe(true);
  });

  describe("a timestamp in the future (a device clock that ran ahead)", () => {
    const FUTURE = "2030-01-01T00:00:00.000Z";
    const IMPORT_TIME = new Date("2026-11-26T10:00:00.000Z");
    const hoursLater = (h: number) => new Date(IMPORT_TIME.getTime() + h * 60 * 60 * 1000);
    const entries = [{ id: "l1-3", value: { done: true, note: "Made-up note dated in the future.", doneAt: FUTURE, updatedAt: FUTURE } }];

    async function importAt(now: Date, input = entries) {
      const plan = planImport(input, await readExisting(db, OWNER, ["l1-3"]), knownIds, linkProblem, now);
      return { plan, applied: await applyImport(db, OWNER, plan.writes) };
    }
    const savedRow = async () => (await db.query("select note, done_at, updated_at from progress where user_id = $1 and item_id = 'l1-3'", [OWNER]))[0];

    it("is stored as the import time", async () => {
      const first = await importAt(IMPORT_TIME);
      expect(first.plan.counts.futureDated).toBe(1);
      expect(first.applied).toEqual({ inserted: 1, updated: 0, skipped: 0 });
      const row = await savedRow();
      expect(new Date(row.updated_at).toISOString()).toBe(IMPORT_TIME.toISOString());
      expect(new Date(row.done_at).toISOString()).toBe(IMPORT_TIME.toISOString());
    });

    it("changes nothing on a second run, even though the import time has moved on", async () => {
      await importAt(IMPORT_TIME);
      const before = await savedRow();
      const second = await importAt(hoursLater(1));
      expect(second.plan.writes).toEqual([]);
      expect(second.plan.counts.unchanged).toBe(1);
      expect(second.applied).toEqual({ inserted: 0, updated: 0, skipped: 0 });
      expect(await savedRow()).toEqual(before);
    });

    it("never overwrites a later edit in the app on a re-run", async () => {
      await importAt(IMPORT_TIME);
      await db.query("update progress set note = 'Changed in the app.', updated_at = $1 where user_id = $2 and item_id = 'l1-3'", [
        hoursLater(1).toISOString(),
        OWNER,
      ]);
      await importAt(hoursLater(2));
      expect((await savedRow()).note).toBe("Changed in the app.");
    });

    it("never replaces a saved row, even an older one, since its real time is unknown", async () => {
      await db.query("insert into progress (user_id, item_id, note, updated_at) values ($1, 'l1-3', 'Saved earlier.', '2026-11-01T00:00:00Z')", [OWNER]);
      const run = await importAt(IMPORT_TIME);
      expect(run.plan.counts.unchanged).toBe(1);
      expect((await savedRow()).note).toBe("Saved earlier.");
      // Also when the row appears between planning and writing.
      await db.query("delete from progress");
      const plan = planImport(entries, new Map(), knownIds, linkProblem, IMPORT_TIME);
      await db.query("insert into progress (user_id, item_id, note, updated_at) values ($1, 'l1-3', 'Saved meanwhile.', '2026-11-01T00:00:00Z')", [OWNER]);
      expect(await applyImport(db, OWNER, plan.writes)).toEqual({ inserted: 0, updated: 0, skipped: 1 });
      expect((await savedRow()).note).toBe("Saved meanwhile.");
    });

    it("applies to the doneAt fallback too, and picks the later of future-dated duplicates", () => {
      expect(normalizeRecord({ done: true, doneAt: FUTURE }, linkProblem, IMPORT_TIME)).toMatchObject({
        futureDated: true,
        record: { doneAt: IMPORT_TIME, updatedAt: IMPORT_TIME },
      });
      expect(normalizeRecord({ done: true, updatedAt: "2026-11-25T00:00:00Z" }, linkProblem, IMPORT_TIME)).toMatchObject({ futureDated: false });
      const plan = planImport(
        [
          { id: "l1-3", value: { done: false, updatedAt: "2030-01-01T00:00:00Z" } },
          { id: "l1-3", value: { done: true, updatedAt: "2031-01-01T00:00:00Z" } },
        ],
        new Map(),
        knownIds,
        linkProblem,
        IMPORT_TIME,
      );
      expect(plan.writes).toHaveLength(1);
      expect(plan.writes[0]).toMatchObject({ done: true, updatedAt: IMPORT_TIME, insertOnly: true });
    });

    it("is counted in the summary, without personal text", async () => {
      const { plan, applied } = await importAt(IMPORT_TIME);
      const text = summaryLines({ files: 1, unreadable: 0, counts: plan.counts, applied, dryRun: false }).join("\n");
      expect(text).toContain("Records dated in the future: 1.");
      expect(text).not.toMatch(/Made-up/);
    });
  });

  it("checks each field", () => {
    expect(normalizeRecord({ done: true, note: "a".repeat(10_001) }, linkProblem).ok).toBe(false);
    expect(normalizeRecord({ done: true, updatedAt: "not a date" }, linkProblem).ok).toBe(false);
    expect(normalizeRecord("text", linkProblem).ok).toBe(false);
    expect(normalizeRecord({ done: false, doneAt: "2026-11-01T00:00:00Z", link: "javascript:alert(1)" }, linkProblem)).toMatchObject({
      ok: true,
      linkDropped: true,
      record: { done: false, doneAt: null, link: "" },
    });
  });

  it("imports for the owner only, and never reads or changes another user's rows", async () => {
    await db.query("insert into progress (user_id, item_id, done, note, done_at, updated_at) values ($1, 'l1-1', true, 'Other user note.', now(), '2030-01-01T00:00:00Z')", [
      OTHER,
    ]);
    // The other user's newer l1-1 row neither blocks the owner's import nor is replaced by it.
    expect(await readExisting(db, OWNER, ["l1-1"])).toEqual(new Map());
    const result = await runImport(RECORDS);
    expect(result.applied).toEqual({ inserted: 4, updated: 0, skipped: 0 });
    const other = await db.query("select item_id, note from progress where user_id = $1", [OTHER]);
    expect(other).toEqual([{ item_id: "l1-1", note: "Other user note." }]);
    expect(await db.query("select item_id from progress where user_id = $1 and item_id = 'l1-1'", [OWNER])).toHaveLength(1);
  });

  it("finds the owner through OWNER_GITHUB_ID, and nobody for a missing, malformed or unknown id", async () => {
    expect(await findOwnerUserId(db, OWNER_GITHUB_ID)).toBe(OWNER);
    expect(await findOwnerUserId(db, ` ${OWNER_GITHUB_ID} `)).toBe(OWNER);
    for (const id of [undefined, "", "abc", "0", "1 or 1=1", "900000000009"]) {
      expect(await findOwnerUserId(db, id)).toBeNull();
    }
  });

  it("refuses to read or write without a user id", async () => {
    await expect(readExisting(db, "", ["l1-1"])).rejects.toThrow(/owner's user id/);
    await expect(applyImport(db, undefined as unknown as string, [])).rejects.toThrow(/owner's user id/);
  });

  it("summaries hold counts only", async () => {
    const first = await runImport(RECORDS);
    const text = summaryLines({ files: 7, unreadable: 1, counts: first.plan.counts, applied: first.applied, dryRun: false }).join("\n");
    expect(text).toContain("Added 4, updated 0");
    expect(text).not.toMatch(/Made-up|invented|example\.com/i);
  });
});

describe("npm run db:import (the real command, twice)", () => {
  let dir: string;
  let emptyDir: string;
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "fde-import-test-"));
    emptyDir = mkdtempSync(path.join(tmpdir(), "fde-import-test-no-owner-"));
    // The owner has signed in once (a made-up user), as before a real import.
    const local = await openScriptDb({ kind: "pglite", dataDir: dir });
    try {
      await addUser(local, OWNER, OWNER_GITHUB_ID);
    } finally {
      await local.close();
    }
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(emptyDir, { recursive: true, force: true });
  });

  const run = (...args: string[]) => runIn(dir, OWNER_GITHUB_ID, ...args);
  const runIn = (pgliteDir: string, ownerGithubId: string, ...args: string[]) =>
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--disable-warning=ExperimentalWarning",
        "scripts/import-progress.mjs",
        ...args,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, PGLITE_DIR: pgliteDir, OWNER_GITHUB_ID: ownerGithubId, DATABASE_URL: "", VERCEL: "", E2E_AUTH: "" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

  it("imports once, then reports everything unchanged, printing no personal text", () => {
    const dry = run(RECORDS, "--dry-run");
    expect(dry).toContain("Dry run, nothing written. Would add 4, update 0, leave 0 unchanged.");
    const first = run(RECORDS);
    expect(first).toContain("Read 6 records from 7 files (1 unreadable).");
    expect(first).toContain("Added 4, updated 0, unchanged 0");
    expect(first).toContain("Skipped: 1 unknown id, 1 invalid record, 0 duplicates.");
    expect(first).toContain("Links left out because they were not valid https:// addresses: 1.");
    const second = run(RECORDS);
    expect(second).toContain("Added 0, updated 0, unchanged 4");
    for (const out of [dry, first, second]) expect(out).not.toMatch(/Made-up|invented|example\.com|insecure/i);
  });

  it.each([
    ["OWNER_GITHUB_ID is not set", () => runIn(dir, "", RECORDS)],
    ["the owner has never signed in", () => runIn(emptyDir, OWNER_GITHUB_ID, RECORDS)],
    ["the owner is unknown, even for a dry run", () => runIn(dir, "900000000009", RECORDS, "--dry-run")],
  ])("refuses, writing nothing, when %s", (_label, attempt) => {
    let failure: { status: number; stderr: string; stdout: string } | null = null;
    try {
      attempt();
    } catch (error) {
      failure = error as { status: number; stderr: string; stdout: string };
    }
    expect(failure?.status).toBe(2);
    expect(failure?.stderr).toContain("Import refused: no owner found.");
    expect(failure?.stdout).not.toContain("Added");
  });
});
