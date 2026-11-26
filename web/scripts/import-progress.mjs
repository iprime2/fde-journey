// Imports progress records exported from the tracker artifact into the app's database.
//
//   npm run db:import -- <file-or-folder> [--dry-run]
//
// Input: a folder of JSON files (one record each, named by item id, e.g. l1-1.json) or one JSON
// file (a record, or an array of records with an `id` field). A record is
// {done, note, link, doneAt, updatedAt}, optionally wrapped as {data: {...}, version}.
//
// - Ids are checked against the app's content (lib/ids.ts). Unknown ids are counted, not imported.
// - A record only replaces a saved row when it is newer, so running it twice changes nothing and
//   changes made in the app are never overwritten. A timestamp in the future is stored as the
//   import time, and such a record only fills an empty row, never replaces a saved one.
// - The records are imported for the owner: the user whose GitHub account id is OWNER_GITHUB_ID.
//   The import refuses to run if that setting is missing or the owner has never signed in.
// - Prints counts only, never note text or links. Keep exported files outside this repository.
// - Uses DATABASE_URL (Neon, migrated first) or else the local PGlite folder. Stop `npm run dev`
//   first when importing into the local folder: two processes must not open it at once.
import path from "node:path";
import { applyImport, collectRecords, findOwnerUserId, planImport, readExisting, summaryLines } from "./lib/import-core.mjs";
import { WEB_DIR, errorSummary, openScriptDb, scriptDbConfig } from "./lib/db.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const inputArg = args.find((a) => !a.startsWith("--"));
if (!inputArg) {
  console.error("Usage: npm run db:import -- <file-or-folder> [--dry-run]");
  process.exit(2);
}
const input = path.resolve(process.cwd(), inputArg);

const repoRoot = path.resolve(WEB_DIR, "..");
const dataDir = path.join(WEB_DIR, ".data");
if ((input === repoRoot || input.startsWith(repoRoot + path.sep)) && !input.startsWith(dataDir + path.sep)) {
  console.warn("Warning: the input is inside this repository. Keep exported records out of git (this repo is public).");
}

// The app's own content and id rules, loaded with Node's TypeScript support (see package.json).
// Tracker records only: the courses (cr ids) never existed in the tracker.
const [{ listTrackerItems, JOURNAL_ID }, { trackerContent }, { linkProblem }] = await Promise.all([
  import("../lib/ids.ts"),
  import("../content/tracker-data.ts"),
  import("../lib/notes.ts"),
]);
const knownIds = new Set([...listTrackerItems(trackerContent).map((i) => i.id), JOURNAL_ID]);

let collected;
try {
  collected = collectRecords(input);
} catch {
  console.error("Could not read the input. Check that the path exists.");
  process.exit(2);
}

let db;
try {
  db = await openScriptDb(scriptDbConfig(process.env));
  const ownerUserId = await findOwnerUserId(db, process.env.OWNER_GITHUB_ID);
  if (!ownerUserId) {
    console.error(
      "Import refused: no owner found. Set OWNER_GITHUB_ID to the owner's numeric GitHub id, and sign in to the app once so the owner's user exists.",
    );
    process.exitCode = 2;
  } else {
    const ids = [...new Set(collected.entries.map((e) => e.id).filter((id) => id && knownIds.has(id)))];
    const plan = planImport(collected.entries, await readExisting(db, ownerUserId, ids), knownIds, linkProblem);
    const applied = dryRun
      ? { inserted: plan.writes.filter((w) => w.isNew).length, updated: plan.writes.filter((w) => !w.isNew).length, skipped: 0 }
      : await applyImport(db, ownerUserId, plan.writes);
    for (const line of summaryLines({ files: collected.files, unreadable: collected.unreadable, counts: plan.counts, applied, dryRun })) {
      console.log(line);
    }
  }
} catch (error) {
  // The scripts' own messages, or names and codes only: database messages can quote the row (and
  // so a note).
  console.error(`Import failed: ${errorSummary(error)}`);
  process.exitCode = 1;
} finally {
  await db?.close();
}
