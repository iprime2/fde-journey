// Reads the current tracker (tracker/fde-journey-tracker.html), which stays the source of
// roadmap content until cut-over (milestone M3). Used by `npm run content:sync` and by tests.
// The tracker is this repo's own file; its data section is plain object literals.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const TRACKER_PATH = resolve(here, "../../tracker/fde-journey-tracker.html");

const DATA_START = "const PHASES";
const IDS_START = "/* ---------- Ids and groups";
const STATE_START = "/* ---------- State";

export function readTrackerHtml(path = TRACKER_PATH) {
  return readFileSync(path, "utf8");
}

function slice(html, from, to) {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`tracker markers not found: ${from} .. ${to}`);
  return html.slice(a, b);
}

/** The roadmap content, exactly as the tracker defines it. */
export function extractContent(html) {
  const data = slice(html, DATA_START, IDS_START);
  const read = new Function(
    `${data}\nreturn { phases: PHASES, certs: CERTS, projects: PROJECTS, career: CAREER, scaler: SCALER, resources: RESOURCES, papers: PAPERS, books: BOOKS };`,
  );
  return JSON.parse(JSON.stringify(read()));
}

/** Every saved-progress id the tracker registers, with its title (the tracker's own id code). */
export function extractTrackerItems(html) {
  const code = slice(html, DATA_START, STATE_START);
  const read = new Function(`${code}\nreturn ITEMS;`);
  const items = read();
  return new Map(Object.entries(items).map(([id, item]) => [id, item.title]));
}
