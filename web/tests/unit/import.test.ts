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
import { applyImport, collectRecords, normalizeRecord, planImport, readExisting, summaryLines } from "../../scripts/lib/import-core.mjs";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "import");
const RECORDS = path.join(FIXTURES, "records");
const knownIds = new Set([...listItems(trackerContent).map((i) => i.id), JOURNAL_ID]);

type ScriptDb = Awaited<ReturnType<typeof openScriptDb>>;
let db: ScriptDb;
beforeAll(async () => {
  db = await openScriptDb({ kind: "pglite", dataDir: null });
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
  const plan = planImport(collected.entries, await readExisting(db, ids), knownIds, linkProblem);
  const applied = await applyImport(db, plan.writes);
  return { collected, plan, applied };
}

describe("import", () => {
  it("imports known records, reports the rest, and changes nothing on a second run", async () => {
    const first = await runImport(RECORDS);
    expect(first.collected.files).toBe(7);
    expect(first.collected.unreadable).toBe(1);
    expect(first.plan.counts).toMatchObject({ records: 6, unknown: 1, invalid: 1, duplicates: 0, linksDropped: 1, unchanged: 0 });
    expect(first.applied).toEqual({ inserted: 4, updated: 0, skipped: 0 });

    const rows = await db.query("select item_id, done, note, link, done_at, updated_at from progress order by item_id");
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
    expect(await db.query("select item_id, done, note, link, done_at, updated_at from progress order by item_id")).toEqual(rows);
  });

  it("never overwrites a newer change made in the app", async () => {
    await runImport(RECORDS);
    await db.query("update progress set note = 'Changed in the app.', updated_at = '2026-12-01T00:00:00Z' where item_id = 'l1-1'");
    const again = await runImport(RECORDS);
    expect(again.applied).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    const [row] = await db.query("select note from progress where item_id = 'l1-1'");
    expect(row.note).toBe("Changed in the app.");
  });

  it("updates a row when the export is newer", async () => {
    await db.query("insert into progress (item_id, done, updated_at) values ('l1-1', false, '2026-11-01T00:00:00Z')");
    const result = await runImport(RECORDS);
    expect(result.applied).toEqual({ inserted: 3, updated: 1, skipped: 0 });
  });

  it("reads a single file holding an array of records with ids", async () => {
    const result = await runImport(path.join(FIXTURES, "array.json"));
    expect(result.plan.counts).toMatchObject({ records: 3, unknown: 1, invalid: 0 });
    expect(result.applied.inserted).toBe(2);
    const rows = await db.query("select item_id, done_at, updated_at from progress order by item_id");
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

  it("summaries hold counts only", async () => {
    const first = await runImport(RECORDS);
    const text = summaryLines({ files: 7, unreadable: 1, counts: first.plan.counts, applied: first.applied, dryRun: false }).join("\n");
    expect(text).toContain("Added 4, updated 0");
    expect(text).not.toMatch(/Made-up|invented|example\.com/i);
  });
});

describe("npm run db:import (the real command, twice)", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "fde-import-test-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const run = (...args: string[]) =>
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--disable-warning=ExperimentalWarning",
        "scripts/import-progress.mjs",
        ...args,
      ],
      { cwd: process.cwd(), env: { ...process.env, PGLITE_DIR: dir, DATABASE_URL: "", VERCEL: "", E2E_AUTH: "" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
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
});
