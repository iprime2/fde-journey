// Item ids for saved progress. They must stay identical to the tracker's ids, because the
// owner's existing progress is stored under them. Ids come from list positions: lists are
// append-only, never reordered. See .claude/skills/journey-app-dev/SKILL.md.
// No runtime imports here: scripts/import-progress.mjs loads this file with Node's TypeScript
// support, which can't resolve the "@/" alias. Callers pass the content in.
import type { Course, TrackerContent } from "@/content/types";
import type { DoneSection } from "./access-types";

/** Phase number is 1-based (Phase.n); task index is 0-based. */
export const phaseTaskId = (phaseNumber: number, taskIndex: number) => `l${phaseNumber}-${taskIndex + 1}`;
/** Certification index is the 0-based array position, never the display rank. */
export const certTaskId = (certIndex: number, taskIndex: number) => `c${certIndex + 1}-${taskIndex + 1}`;
export const projectTaskId = (projectIndex: number, taskIndex: number) => `p${projectIndex + 1}-${taskIndex + 1}`;
export const careerId = (index: number) => `k${index + 1}`;
/** Module number is 1-based (ScalerModule.n). */
export const scalerClassId = (moduleNumber: number, classIndex: number) => `s${moduleNumber}-${classIndex + 1}`;
/** "l1-1" + 0 -> "r1-1-1". */
export const resourceId = (taskId: string, index: number) => `r${taskId.slice(1)}-${index + 1}`;
export const paperId = (index: number) => `pp${index + 1}`;
export const bookId = (index: number) => `bk${index + 1}`;
/** Courses & badges (content/courses.ts). Not in the tracker: these ids exist only in the app. */
export const courseId = (index: number) => `cr${index + 1}`;
/** Free-text weekly notes. */
export const JOURNAL_ID = "journal";

/**
 * Which kind of item an id is, from its prefix and shape, or null for anything else (the journal,
 * a malformed id). Courses (`cr1`) are tested first, before any rule on a single letter, so they
 * can never be taken for certification steps (`c1-1`); likewise `pp` before `p`.
 */
const KIND_PATTERNS: readonly (readonly [RegExp, DoneSection])[] = [
  [/^cr[1-9][0-9]*$/, "courses"],
  [/^pp[1-9][0-9]*$/, "reading"],
  [/^bk[1-9][0-9]*$/, "reading"],
  [/^l[1-9][0-9]*-[1-9][0-9]*$/, "roadmap"],
  [/^r[1-9][0-9]*-[1-9][0-9]*-[1-9][0-9]*$/, "resources"],
  [/^s[1-9][0-9]*-[1-9][0-9]*$/, "scaler"],
  [/^c[1-9][0-9]*-[1-9][0-9]*$/, "certs"],
  [/^p[1-9][0-9]*-[1-9][0-9]*$/, "projects"],
  [/^k[1-9][0-9]*$/, "career"],
];

export function itemKind(itemId: string): DoneSection | null {
  for (const [pattern, kind] of KIND_PATTERNS) if (pattern.test(itemId)) return kind;
  return null;
}

export type ItemGroup ="roadmap" | "cert" | "project" | "career" | "scaler" | "resource" | "paper" | "book" | "course";

export interface ItemRef {
  id: string;
  title: string;
  group: ItemGroup;
}

/** Every item the old tracker had, in the same order it registers them. */
export function listTrackerItems(c: TrackerContent): ItemRef[] {
  const out: ItemRef[] = [];
  c.phases.forEach((p) => p.tasks.forEach((t, j) => out.push({ id: phaseTaskId(p.n, j), title: t[0], group: "roadmap" })));
  c.certs.forEach((cert, i) => cert.tasks.forEach((t, j) => out.push({ id: certTaskId(i, j), title: t, group: "cert" })));
  c.projects.forEach((pr, i) => pr.tasks.forEach((t, j) => out.push({ id: projectTaskId(i, j), title: t, group: "project" })));
  c.career.forEach((k, i) => out.push({ id: careerId(i), title: k.title, group: "career" }));
  c.scaler.forEach((m) => m.classes.forEach((t, j) => out.push({ id: scalerClassId(m.n, j), title: t, group: "scaler" })));
  Object.entries(c.resources).forEach(([taskId, g]) =>
    g.items.forEach((r, j) => out.push({ id: resourceId(taskId, j), title: r.title, group: "resource" })),
  );
  c.papers.forEach((x, i) => out.push({ id: paperId(i), title: x.title, group: "paper" }));
  c.books.forEach((x, i) => out.push({ id: bookId(i), title: x.title, group: "book" }));
  return out;
}

/** The Courses & badges items (app only). */
export const listCourseItems = (courses: readonly Course[]): ItemRef[] =>
  courses.map((x, i) => ({ id: courseId(i), title: x.title, group: "course" }));

/** Every trackable item: the tracker's, then the courses. */
export const listItems = (c: TrackerContent, courses: readonly Course[]): ItemRef[] => [
  ...listTrackerItems(c),
  ...listCourseItems(courses),
];

/** Certifications in display order, keeping each one's array index for its ids. */
export function certsInDisplayOrder(c: TrackerContent) {
  return c.certs.map((cert, index) => ({ cert, index })).sort((a, b) => (a.cert.rank ?? 99) - (b.cert.rank ?? 99));
}
