// Core of `npm run db:import`: read exported tracker records, check them, and plan and apply the
// upserts. Never logs or returns note text or links: callers only get counts.
//
// The records are the owner's: every query here is scoped to the owner's user id, found through
// the GitHub account whose id is OWNER_GITHUB_ID (findOwnerUserId). The import writes no
// progress_event rows: those record saves made in the app from M4 on, and imported history keeps
// its own done_at instead.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ScriptError } from "./db.mjs";

const NOTE_MAX = 10_000;
const EPOCH = new Date(0);
const RECORD_KEYS = ["done", "note", "link", "doneAt", "updatedAt"];

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** `{ data: {...}, version }` wraps a record; anything with record fields is a record itself. */
function unwrap(value) {
  if (isObject(value) && isObject(value.data) && !RECORD_KEYS.some((k) => k in value)) return value.data;
  return value;
}

function idOf(value, wrapped) {
  if (typeof value?.id === "string") return value.id;
  if (typeof wrapped?.id === "string") return wrapped.id;
  return null;
}

/**
 * Reads a JSON file, or every `*.json` file in a folder (not recursive). A file holds one record
 * (id from its `id` field or else the file name, e.g. `l1-1.json`) or an array of records with ids.
 * @returns {{ entries: { id: string | null, value: unknown }[], files: number, unreadable: number }}
 */
export function collectRecords(inputPath) {
  const stat = statSync(inputPath);
  const files = stat.isDirectory()
    ? readdirSync(inputPath)
        .filter((name) => name.toLowerCase().endsWith(".json"))
        .sort()
        .map((name) => path.join(inputPath, name))
    : [inputPath];
  const entries = [];
  let unreadable = 0;
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      unreadable += 1;
      continue;
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) entries.push({ id: idOf(unwrap(item), item), value: unwrap(item) });
    } else {
      const value = unwrap(parsed);
      entries.push({ id: idOf(value, parsed) ?? path.basename(file).replace(/\.json$/i, ""), value });
    }
  }
  return { entries, files: files.length, unreadable };
}

function parseTime(value) {
  if (value === undefined || value === null || value === "") return { ok: true, date: null };
  if (typeof value !== "string" && typeof value !== "number") return { ok: false };
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, date };
}

/**
 * Checks one record. Invalid links are dropped (the tick and note still import); anything else
 * malformed makes the record invalid.
 *
 * Timestamps in the future (a device clock that ran ahead) are stored as `now`, and the record is
 * marked `futureDated`: it may fill an empty row but never replaces a saved one (see planImport).
 * Otherwise a saved 2030 timestamp would beat every later edit in the app on the next run.
 * @param {(link: string) => string | null} linkProblem the app's link rule (lib/notes.ts)
 * @param {Date} [now] the import's start time
 */
export function normalizeRecord(value, linkProblem, now = new Date()) {
  if (!isObject(value)) return { ok: false };
  const { done = false, note = "", link = "" } = value;
  if (typeof done !== "boolean") return { ok: false };
  if (note !== null && typeof note !== "string") return { ok: false };
  if (link !== null && typeof link !== "string") return { ok: false };
  const cleanNote = (note ?? "").replaceAll("\u0000", "");
  if (cleanNote.length > NOTE_MAX) return { ok: false };
  const doneAt = parseTime(value.doneAt);
  const updatedAt = parseTime(value.updatedAt);
  if (!doneAt.ok || !updatedAt.ok) return { ok: false };
  const trimmedLink = (link ?? "").trim();
  const linkDropped = trimmedLink !== "" && linkProblem(trimmedLink) !== null;
  // Deterministic, so a second run sees the same timestamp and changes nothing.
  const sourceTime = updatedAt.date ?? doneAt.date ?? EPOCH;
  const futureDated = sourceTime.getTime() > now.getTime();
  const notAfterNow = (date) => (date && date.getTime() > now.getTime() ? now : date);
  return {
    ok: true,
    linkDropped,
    futureDated,
    /** The export's own time, used only to choose between duplicates of one id. */
    sourceTime,
    record: {
      done,
      note: cleanNote,
      link: linkDropped ? "" : trimmedLink,
      doneAt: done ? notAfterNow(doneAt.date) : null,
      updatedAt: futureDated ? now : sourceTime,
    },
  };
}

/**
 * Decides what to write. A record replaces a saved row only when it is newer, so the import never
 * overwrites changes made in the app, and running it twice changes nothing. A future-dated record
 * (stored as the import time) only fills an empty row: its real time is unknown, so it never
 * replaces a saved one, and a second run leaves the row it added alone.
 * @param {{ id: string | null, value: unknown }[]} entries
 * @param {Map<string, Date>} existing saved `updated_at` per item id
 * @param {ReadonlySet<string>} knownIds
 * @param {(link: string) => string | null} linkProblem
 * @param {Date} [now] the import's start time
 */
export function planImport(entries, existing, knownIds, linkProblem, now = new Date()) {
  const counts = { records: entries.length, unknown: 0, invalid: 0, duplicates: 0, linksDropped: 0, futureDated: 0, unchanged: 0 };
  const chosen = new Map();
  for (const { id, value } of entries) {
    if (!id || !knownIds.has(id)) {
      counts.unknown += 1;
      continue;
    }
    const result = normalizeRecord(value, linkProblem, now);
    if (!result.ok) {
      counts.invalid += 1;
      continue;
    }
    if (result.linkDropped) counts.linksDropped += 1;
    const previous = chosen.get(id);
    if (previous) {
      counts.duplicates += 1;
      if (previous.sourceTime >= result.sourceTime) continue;
    }
    chosen.set(id, result);
  }
  const writes = [];
  for (const [itemId, { record, futureDated }] of chosen) {
    if (futureDated) counts.futureDated += 1;
    const saved = existing.get(itemId);
    if (saved && (futureDated || saved.getTime() >= record.updatedAt.getTime())) counts.unchanged += 1;
    else writes.push({ itemId, ...record, isNew: !saved, insertOnly: futureDated });
  }
  return { counts, writes };
}

const INSERT = `
insert into progress (user_id, item_id, done, note, link, done_at, updated_at)
values ($1, $2, $3, $4, $5, $6, $7)`;

const UPSERT = `${INSERT}
on conflict (user_id, item_id) do update set
  done = excluded.done, note = excluded.note, link = excluded.link,
  done_at = excluded.done_at, updated_at = excluded.updated_at
where progress.user_id = $1 and progress.updated_at < excluded.updated_at
returning (xmax = 0) as inserted`;

// Future-dated records: add the row only if it still does not exist.
const INSERT_IF_MISSING = `${INSERT}
on conflict (user_id, item_id) do nothing
returning true as inserted`;

const GITHUB_ID = /^[1-9]\d{0,19}$/;

/**
 * The owner's user id: the user whose GitHub account id is `ownerGithubId` (OWNER_GITHUB_ID).
 * Null when the setting is missing or malformed, or no such user exists (never signed in).
 */
export async function findOwnerUserId(db, ownerGithubId) {
  const id = typeof ownerGithubId === "string" ? ownerGithubId.trim() : "";
  if (!GITHUB_ID.test(id)) return null;
  const rows = await db.query("select user_id from account where provider_id = 'github' and account_id = $1 limit 1", [id]);
  return rows[0]?.user_id ?? null;
}

function checkUserId(userId) {
  if (typeof userId !== "string" || userId.length === 0) throw new ScriptError("The import needs the owner's user id.");
}

/** The user's saved `updated_at` for the given ids. */
export async function readExisting(db, userId, ids) {
  checkUserId(userId);
  if (ids.length === 0) return new Map();
  const rows = await db.query("select item_id, updated_at from progress where user_id = $1 and item_id = any($2::text[])", [userId, ids]);
  return new Map(rows.map((r) => [r.item_id, new Date(r.updated_at)]));
}

/** Writes the planned rows for the user. Returns how many were inserted, updated, or skipped as not newer. */
export async function applyImport(db, userId, writes) {
  checkUserId(userId);
  const result = { inserted: 0, updated: 0, skipped: 0 };
  for (const w of writes) {
    const sql = w.insertOnly ? INSERT_IF_MISSING : UPSERT;
    const rows = await db.query(sql, [userId, w.itemId, w.done, w.note, w.link, w.doneAt?.toISOString() ?? null, w.updatedAt.toISOString()]);
    if (rows.length === 0) result.skipped += 1;
    else if (rows[0].inserted) result.inserted += 1;
    else result.updated += 1;
  }
  return result;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The summary the script prints: counts only. */
export function summaryLines({ files, unreadable, counts, applied, dryRun }) {
  const lines = [`Read ${plural(counts.records, "record")} from ${plural(files, "file")} (${unreadable} unreadable).`];
  if (dryRun) {
    lines.push(`Dry run, nothing written. Would add ${applied.inserted}, update ${applied.updated}, leave ${counts.unchanged} unchanged.`);
  } else {
    lines.push(`Added ${applied.inserted}, updated ${applied.updated}, unchanged ${counts.unchanged + applied.skipped} (the saved copy was the same or newer).`);
  }
  lines.push(`Skipped: ${plural(counts.unknown, "unknown id")}, ${plural(counts.invalid, "invalid record")}, ${plural(counts.duplicates, "duplicate")}.`);
  if (counts.linksDropped) lines.push(`Links left out because they were not valid https:// addresses: ${counts.linksDropped}.`);
  if (counts.futureDated) {
    lines.push(`Records dated in the future: ${counts.futureDated}. Stored with the import time; they never replace a saved copy.`);
  }
  return lines;
}
