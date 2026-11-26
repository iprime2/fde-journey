// Item ids for saved progress. They must stay identical to the tracker's ids, because the
// owner's existing progress is stored under them. Ids come from list positions: lists are
// append-only, never reordered. See .claude/skills/journey-app-dev/SKILL.md.
import type { TrackerContent } from "@/content/types";

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
/** Free-text weekly notes. */
export const JOURNAL_ID = "journal";

export type ItemGroup = "roadmap" | "cert" | "project" | "career" | "scaler" | "resource" | "paper" | "book";

export interface ItemRef {
  id: string;
  title: string;
  group: ItemGroup;
}

/** Every trackable item, in the same order the tracker registers them. */
export function listItems(c: TrackerContent): ItemRef[] {
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

/** Certifications in display order, keeping each one's array index for its ids. */
export function certsInDisplayOrder(c: TrackerContent) {
  return c.certs.map((cert, index) => ({ cert, index })).sort((a, b) => (a.cert.rank ?? 99) - (b.cert.rank ?? 99));
}
