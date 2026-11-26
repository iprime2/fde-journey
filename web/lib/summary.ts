// Numbers for the Home tiles, the current-phase panel and the navigation counts. Same rules as
// the tracker. Pure functions; every id comes from lib/ids.ts.
import type { TrackerContent } from "@/content/types";
import { formatRange } from "@/lib/dates";
import {
  bookId,
  careerId,
  certTaskId,
  paperId,
  phaseTaskId,
  projectTaskId,
  resourceId,
  scalerClassId,
} from "@/lib/ids";
import { type ProgressMap, countDone, isDone } from "@/lib/progress";
import { type ChipState, phaseChip, pickCurrentPhase } from "@/lib/status";
import { currentModuleNumber } from "@/lib/views";

export interface Fraction {
  done: number;
  total: number;
}

export const percent = (f: Fraction) => (f.total ? Math.round((f.done / f.total) * 100) : 0);

const fraction = (progress: ProgressMap, ids: readonly string[]): Fraction => ({ done: countDone(progress, ids), total: ids.length });

const phaseIds = (p: TrackerContent["phases"][number]) => p.tasks.map((_, j) => phaseTaskId(p.n, j));
const moduleIds = (m: TrackerContent["scaler"][number]) => m.classes.map((_, j) => scalerClassId(m.n, j));
const certIds = (c: TrackerContent, i: number) => c.certs[i].tasks.map((_, j) => certTaskId(i, j));
const projectIds = (c: TrackerContent, i: number) => c.projects[i].tasks.map((_, j) => projectTaskId(i, j));

/** Roadmap tasks only (l ids): what the tracker calls technical learning. */
export const learningIds = (c: TrackerContent) => c.phases.flatMap(phaseIds);
export const careerIds = (c: TrackerContent) => c.career.map((_, i) => careerId(i));
export const scalerIds = (c: TrackerContent) => c.scaler.flatMap(moduleIds);
export const resourceIds = (c: TrackerContent) =>
  Object.entries(c.resources).flatMap(([taskId, g]) => g.items.map((_, k) => resourceId(taskId, k)));
export const readingIds = (c: TrackerContent) => [...c.papers.map((_, i) => paperId(i)), ...c.books.map((_, i) => bookId(i))];

/** Roadmap milestones: tasks, certification steps, project steps and career milestones. */
export const milestoneIds = (c: TrackerContent) => [
  ...learningIds(c),
  ...c.certs.flatMap((_, i) => certIds(c, i)),
  ...c.projects.flatMap((_, i) => projectIds(c, i)),
  ...careerIds(c),
];

/** A certification is passed when its last step is ticked. */
export const certsPassed = (c: TrackerContent, progress: ProgressMap): Fraction => ({
  done: c.certs.filter((_, i) => isDone(progress, certIds(c, i).at(-1) ?? "")).length,
  total: c.certs.length,
});

/** A project is complete when every step is ticked. */
export const projectsComplete = (c: TrackerContent, progress: ProgressMap): Fraction => ({
  done: c.projects.filter((_, i) => projectIds(c, i).every((id) => isDone(progress, id))).length,
  total: c.projects.length,
});

export type SectionKey = "roadmap" | "reading" | "scaler" | "certs" | "projects" | "career";

/** The counts beside each navigation item (the tracker's tab counts). */
export function navCounts(c: TrackerContent, progress: ProgressMap): Record<SectionKey, Fraction> {
  return {
    roadmap: fraction(progress, learningIds(c)),
    reading: fraction(progress, readingIds(c)),
    scaler: fraction(progress, scalerIds(c)),
    certs: certsPassed(c, progress),
    projects: projectsComplete(c, progress),
    career: fraction(progress, careerIds(c)),
  };
}

export interface TileModel {
  key: string;
  /** "42%" or "3/57". */
  value: string;
  /** For screen readers: "3 of 57 done". */
  valueLabel: string;
  label: string;
  percent: number;
  href: "/roadmap" | "/scaler" | "/certs" | "/projects";
}

export interface NowModel {
  phase: { n: number; title: string; range: string; chip: ChipState } & Fraction;
  /** First three tasks of the phase not yet done. */
  upNext: { id: string; title: string }[];
  module: { n: number; title: string; sub: string; nextClass: string | null } & Fraction;
}

export interface DashboardModel {
  tiles: TileModel[];
  now: NowModel;
  /** Anything saved at all (any tick, note or link). */
  hasProgress: boolean;
}

const tile = (key: string, f: Fraction, label: string, href: TileModel["href"]): TileModel => ({
  key,
  value: `${f.done}/${f.total}`,
  valueLabel: `${f.done} of ${f.total} done`,
  label,
  percent: percent(f),
  href,
});

export function dashboardModel(c: TrackerContent, progress: ProgressMap, todayIso: string): DashboardModel {
  const milestones = fraction(progress, milestoneIds(c));
  const moduleN = currentModuleNumber(c, progress);
  const mod = c.scaler.find((m) => m.n === moduleN) ?? c.scaler[c.scaler.length - 1];
  const tiles: TileModel[] = [
    {
      key: "milestones",
      value: `${percent(milestones)}%`,
      valueLabel: `${percent(milestones)}%`,
      label: `${milestones.done} of ${milestones.total} roadmap milestones`,
      percent: percent(milestones),
      href: "/roadmap",
    },
    tile("learning", fraction(progress, learningIds(c)), "Technical learning", "/roadmap"),
    tile("resources", fraction(progress, resourceIds(c)), "Learning resources studied", "/roadmap"),
    tile("scaler", fraction(progress, scalerIds(c)), `Scaler classes · now Module ${mod.n}`, "/scaler"),
    tile("certs", certsPassed(c, progress), "Certifications passed", "/certs"),
    tile("projects", projectsComplete(c, progress), "Portfolio projects complete", "/projects"),
  ];

  const phase = pickCurrentPhase(c.phases, todayIso, (p) => countDone(progress, phaseIds(p)) === p.tasks.length);
  const ids = phaseIds(phase);
  const phaseDone = fraction(progress, ids);
  const upNext = ids
    .map((id, j) => ({ id, title: phase.tasks[j][0] }))
    .filter((t) => !isDone(progress, t.id))
    .slice(0, 3);
  const mIds = moduleIds(mod);
  const nextClassIndex = mIds.findIndex((id) => !isDone(progress, id));

  return {
    tiles,
    now: {
      phase: {
        n: phase.n,
        title: phase.title,
        range: formatRange(phase.start, phase.end),
        chip: phaseChip(phase, todayIso, phaseDone.done, phaseDone.total),
        ...phaseDone,
      },
      upNext,
      module: {
        n: mod.n,
        title: mod.title,
        sub: mod.sub,
        nextClass: nextClassIndex >= 0 ? mod.classes[nextClassIndex] : null,
        ...fraction(progress, mIds),
      },
    },
    hasProgress: [...progress.values()].some((p) => p.done || p.note !== "" || p.link !== ""),
  };
}
