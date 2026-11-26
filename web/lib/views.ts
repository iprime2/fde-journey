// What each section page shows, built from the content files and saved progress. Pure functions:
// rendering (components) and search (lib/filter.ts) both read these models, so a row's search
// text always matches what the row shows. Every id comes from lib/ids.ts.
import type { CourseGroup } from "@/content/courses";
import type { Course, Resource, TrackerContent } from "@/content/types";
import { formatDayMonth, formatRange, isInWeek } from "@/lib/dates";
import type { FilterEntry, TagOption } from "@/lib/filter";
import {
  JOURNAL_ID,
  bookId,
  careerId,
  certTaskId,
  certsInDisplayOrder,
  courseId,
  paperId,
  phaseTaskId,
  projectTaskId,
  resourceId,
  scalerClassId,
} from "@/lib/ids";
import { isHttpsUrl } from "@/lib/notes";
import type { ProgressMap } from "@/lib/progress";
import { type ChipState, certChip, moduleChip, phaseChip, pickCurrentModule, projectChip } from "@/lib/status";

export interface RowModel {
  id: string;
  title: string;
  /** Only set for https links. */
  url?: string;
  /** "M1·01", "1.", "Week of 30 Nov". */
  index?: string;
  meta?: string;
  why?: string;
  done: boolean;
  note: string;
  link: string;
  /** Text search matches without showing it (a task's resource titles and authors). */
  searchExtra?: string;
  /** Hint in the empty note field (the tracker's wording for each kind of item). */
  notePlaceholder: string;
  resources?: ResourceGroupModel;
  /** Chips after the meta line (Courses & badges: Top pick, Badge, the phase). */
  chips?: ChipState[];
  /** What the page's tag filter matches (lib/filter.ts). */
  tags?: string[];
}

export interface ResourceGroupModel {
  taskId: string;
  start: string;
  rows: RowModel[];
  done: number;
}

export interface CardModel {
  /** Section key for filtering, e.g. "phase-1", "mod-3", "cert-6". */
  key: string;
  title: string;
  sub?: string;
  /** The sub line is a date range: set in the number face. */
  subIsDate?: boolean;
  desc?: string;
  chip?: ChipState;
  done: number;
  rows: RowModel[];
}

export interface ModuleCardModel extends CardModel {
  n: number;
  kind: "core" | "elective";
  isCurrent: boolean;
}

/** Note field hints, as in the tracker. */
export const NOTE_PLACEHOLDERS = {
  task: "What did you build or learn? Key takeaways, questions, links…",
  resource: "What did you learn from this? Key points, questions…",
  scalerClass: "What did you build in this class? Project, assignment, key takeaways…",
  paper: "Your takeaway in one or two lines, and one question it raised…",
  book: "Chapters read, key ideas, what you will use…",
  course: "What did you learn? Key points, and where the badge or certificate lives…",
} as const;

function row(
  progress: ProgressMap,
  id: string,
  fields: Omit<RowModel, "id" | "done" | "note" | "link" | "notePlaceholder"> & { notePlaceholder?: string },
): RowModel {
  const p = progress.get(id);
  const url = fields.url && isHttpsUrl(fields.url) ? fields.url : undefined;
  return {
    id,
    ...fields,
    url,
    notePlaceholder: fields.notePlaceholder ?? NOTE_PLACEHOLDERS.task,
    done: p?.done === true,
    note: p?.note ?? "",
    link: p?.link ?? "",
  };
}

const doneIn = (rows: readonly RowModel[]) => rows.filter((r) => r.done).length;

export const TYPE_LABEL: Record<Resource["type"], string> = {
  video: "Video",
  article: "Article",
  docs: "Docs",
  course: "Course",
  interactive: "Interactive",
};

/** "by · type · length · level", skipping empty parts (the tracker's format). */
export function resourceMeta(r: Resource): string {
  const level = r.level ? r.level[0].toUpperCase() + r.level.slice(1) : "";
  return [r.by, TYPE_LABEL[r.type] ?? r.type, r.length, level].filter(Boolean).join(" · ");
}

export function roadmapView(c: TrackerContent, progress: ProgressMap, todayIso: string): CardModel[] {
  return c.phases.map((phase) => {
    const rows = phase.tasks.map(([title, tag], j) => {
      const id = phaseTaskId(phase.n, j);
      const group = c.resources[id];
      const resourceRows = group?.items.map((r, k) =>
        row(progress, resourceId(id, k), {
          title: r.title,
          url: r.url,
          index: `${k + 1}.`,
          meta: resourceMeta(r),
          why: r.why,
          notePlaceholder: NOTE_PLACEHOLDERS.resource,
        }),
      );
      return row(progress, id, {
        title,
        meta: tag,
        searchExtra: group?.items.map((r) => `${r.title} ${r.by}`).join(" "),
        resources:
          group && resourceRows ? { taskId: id, start: group.start, rows: resourceRows, done: doneIn(resourceRows) } : undefined,
      });
    });
    const done = doneIn(rows);
    return {
      key: `phase-${phase.n}`,
      title: `Phase ${phase.n} · ${phase.title}`,
      sub: formatRange(phase.start, phase.end),
      subIsDate: true,
      chip: phaseChip(phase, todayIso, done, rows.length),
      done,
      rows,
    };
  });
}

export const PAPERS_SUB =
  "One core paper a week, plus an optional second if you have time. Use the three-pass method from week 1 and write a one-line takeaway in each note.";
export const BOOKS_SUB =
  "Core books first, in this order. Books are paid, so check a library or an O'Reilly subscription first.";

export function readingView(c: TrackerContent, progress: ProgressMap, todayIso: string): CardModel[] {
  const papers = c.papers.map((p, i) =>
    row(progress, paperId(i), {
      title: p.title,
      url: p.url,
      index: `Week of ${formatDayMonth(p.week)}`,
      meta: `${p.by} · ${p.core ? "Core" : "Optional"}${isInWeek(todayIso, p.week) ? " · This week" : ""}`,
      why: p.why,
      notePlaceholder: NOTE_PLACEHOLDERS.paper,
    }),
  );
  const books = c.books.map((b, i) =>
    row(progress, bookId(i), {
      title: b.title,
      url: b.url,
      meta: `${b.by} · ${b.core ? "Core" : "Optional"}`,
      why: b.why,
      notePlaceholder: NOTE_PLACEHOLDERS.book,
    }),
  );
  return [
    { key: "papers", title: "Research papers", sub: PAPERS_SUB, done: doneIn(papers), rows: papers },
    { key: "books", title: "Books", sub: BOOKS_SUB, done: doneIn(books), rows: books },
  ];
}

const classIds = (m: TrackerContent["scaler"][number]) => m.classes.map((_, j) => scalerClassId(m.n, j));

export function currentModuleNumber(c: TrackerContent, progress: ProgressMap): number {
  return pickCurrentModule(c.scaler, (m) => classIds(m).every((id) => progress.get(id)?.done === true)).n;
}

export function scalerView(c: TrackerContent, progress: ProgressMap): ModuleCardModel[] {
  const current = currentModuleNumber(c, progress);
  return c.scaler.map((m) => {
    const rows = m.classes.map((title, j) =>
      row(progress, scalerClassId(m.n, j), {
        title,
        index: `M${m.n}·${String(j + 1).padStart(2, "0")}`,
        notePlaceholder: NOTE_PLACEHOLDERS.scalerClass,
      }),
    );
    const done = doneIn(rows);
    return {
      key: `mod-${m.n}`,
      n: m.n,
      kind: m.kind,
      isCurrent: m.n === current,
      title: `Module ${m.n} · ${m.title}`,
      sub: `${m.sub} · ${m.months} mo · ${m.classes.length} classes`,
      chip: moduleChip(done, rows.length, m.n === current),
      done,
      rows,
    };
  });
}

/** In display order (rank). Ids and section keys keep the array position. */
export function certsView(c: TrackerContent, progress: ProgressMap): CardModel[] {
  return certsInDisplayOrder(c).map(({ cert, index }) => {
    const rows = cert.tasks.map((title, j) => row(progress, certTaskId(index, j), { title }));
    return {
      key: `cert-${index}`,
      title: cert.name,
      sub: `${cert.date} · ${cert.status}`,
      desc: cert.desc,
      chip: certChip(cert.priority, rows[rows.length - 1]?.done === true),
      done: doneIn(rows),
      rows,
    };
  });
}

export function projectsView(c: TrackerContent, progress: ProgressMap): CardModel[] {
  return c.projects.map((p, i) => {
    const rows = p.tasks.map((title, j) => row(progress, projectTaskId(i, j), { title }));
    const done = doneIn(rows);
    return { key: `proj-${i}`, title: p.name, sub: p.subtitle, desc: p.desc, chip: projectChip(done, rows.length), done, rows };
  });
}

// ---- Courses & badges

export const BADGE_CHIP: ChipState = { label: "Badge", variant: "ok" };
export const TOP_PICK_CHIP: ChipState = { label: "Top pick", variant: "now" };

/** Phase names by number (content/courses.ts, COURSE_PHASE_NAMES). */
export type PhaseNames = Readonly<Record<number, string>>;

/** "Phase 4 · Agents and harnesses"; "Phase 4" if the name is missing. */
export function phaseLabel(names: PhaseNames, n: number): string {
  return names[n] ? `Phase ${n} · ${names[n]}` : `Phase ${n}`;
}

/** "2–4 h · Intermediate", "67 lessons · 9 h", or "" when the provider gives neither. */
export const courseMeta = (course: Course) => [course.length, course.level].filter(Boolean).join(" · ");

/** Tag filter values on Courses & badges. */
export const BADGE_TAG = "badge";
export const TOP_PICK_TAG = "top-pick";
export const phaseTag = (n: number) => `phase-${n}`;

/**
 * One card per provider, in COURSE_GROUPS order; rows keep their list position for the id. The
 * chips, the provider and the phase are searchable too.
 */
export function coursesView(
  courses: readonly Course[],
  groups: readonly CourseGroup[],
  phaseNames: PhaseNames,
  progress: ProgressMap,
): CardModel[] {
  return groups.map((g) => {
    const rows = courses.flatMap((course, i) => {
      if (course.provider !== g.provider) return [];
      const phase = phaseLabel(phaseNames, course.phase);
      const chips = [
        ...(course.topPick ? [TOP_PICK_CHIP] : []),
        ...(course.badge ? [BADGE_CHIP] : []),
        { label: phase, variant: "neutral" as const },
      ];
      return [
        row(progress, courseId(i), {
          title: course.title,
          url: course.url,
          meta: courseMeta(course) || undefined,
          why: course.topPick ? `For the FDE role: ${course.topPick}.` : undefined,
          searchExtra: [course.provider, ...chips.map((c) => c.label)].join(" "),
          notePlaceholder: NOTE_PLACEHOLDERS.course,
          chips,
          tags: [
            ...(course.badge ? [BADGE_TAG] : []),
            ...(course.topPick ? [TOP_PICK_TAG] : []),
            phaseTag(course.phase),
          ],
        }),
      ];
    });
    return { key: g.key, title: g.title, sub: g.sub, done: doneIn(rows), rows };
  });
}

/** The tag filter's choices: everything, badges, top picks, then each phase that has a course. */
export function courseTagOptions(courses: readonly Course[], phaseNames: PhaseNames): TagOption[] {
  const used = [...new Set(courses.map((c) => c.phase))].sort((a, b) => a - b);
  return [
    { value: "", label: "All courses" },
    { value: BADGE_TAG, label: "With a badge" },
    { value: TOP_PICK_TAG, label: "Top picks" },
    ...used.map((n) => ({ value: phaseTag(n), label: phaseLabel(phaseNames, n) })),
  ];
}

export interface CourseFacts {
  total: number;
  done: number;
  /** Courses that award a badge. */
  badges: number;
  /** Done courses that award a badge. */
  badgesEarned: number;
}

export function courseFacts(courses: readonly Course[], progress: ProgressMap): CourseFacts {
  const isDoneAt = (i: number) => progress.get(courseId(i))?.done === true;
  return {
    total: courses.length,
    done: courses.filter((_, i) => isDoneAt(i)).length,
    badges: courses.filter((c) => c.badge).length,
    badgesEarned: courses.filter((c, i) => c.badge && isDoneAt(i)).length,
  };
}

/**
 * Hours in the lengths the providers state ("2–4 h", "67 lessons · 9 h", "4 lessons · 45 min"):
 * the low and high totals, and how many courses state one. Courses with no length are left out.
 */
export function knownHours(courses: readonly Course[]): { low: number; high: number; courses: number } {
  let low = 0;
  let high = 0;
  let counted = 0;
  for (const c of courses) {
    const hours = c.length.match(/(\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))? h\b/);
    const minutes = c.length.match(/(\d+) min\b/);
    if (hours) {
      low += Number(hours[1]);
      high += Number(hours[2] ?? hours[1]);
    } else if (minutes) {
      low += Number(minutes[1]) / 60;
      high += Number(minutes[1]) / 60;
    } else continue;
    counted += 1;
  }
  return { low, high, courses: counted };
}

/** "44–49 h", or "40 h" when the totals match. Rounded to the nearest hour. */
export function formatHours({ low, high }: { low: number; high: number }): string {
  const lo = Math.round(low);
  const hi = Math.round(high);
  return lo === hi ? `${lo} h` : `${lo}–${hi} h`;
}

export const CAREER_SUB = "Apply while learning; don't wait for every certification.";
export const JOURNAL_SUB = "Blockers, next actions, exam dates, weekly reflections.";

export function careerView(c: TrackerContent, progress: ProgressMap): { milestones: CardModel; journalNote: string } {
  const rows = c.career.map((k, i) => row(progress, careerId(i), { title: k.title, meta: `${k.date} · ${k.desc}` }));
  return {
    milestones: { key: "career", title: "Career milestones", sub: CAREER_SUB, done: doneIn(rows), rows },
    journalNote: progress.get(JOURNAL_ID)?.note ?? "",
  };
}

/** Lower-case search text for a row: what it shows, plus its note and link. */
export const rowSearchText = (r: RowModel) =>
  [r.index, r.title, r.meta, r.why, r.searchExtra, r.note, r.link].filter(Boolean).join(" ").toLowerCase();

const entry = (r: RowModel, section: string, group?: string, parent?: string): FilterEntry => ({
  id: r.id,
  text: rowSearchText(r),
  done: r.done,
  noted: r.note !== "" || r.link !== "",
  section,
  ...(group ? { group } : {}),
  ...(parent ? { parent } : {}),
  ...(r.tags ? { tags: r.tags } : {}),
});

/** Search entries for every row (and learning resource) on the given cards. */
export function filterEntries(cards: ReadonlyArray<CardModel & { kind?: string }>): FilterEntry[] {
  return cards.flatMap((card) =>
    card.rows.flatMap((r) => [
      entry(r, card.key, card.kind),
      ...(r.resources?.rows.map((child) => entry(child, card.key, card.kind, r.id)) ?? []),
    ]),
  );
}

/** The weekly-notes entry: matches "weekly notes" and its own text. */
export const journalEntry = (note: string): FilterEntry => ({
  id: JOURNAL_ID,
  text: `weekly notes journal ${note}`.toLowerCase(),
  done: false,
  noted: note !== "",
  section: "journal",
  journal: true,
});
