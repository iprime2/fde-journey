// What the Insights page shows (design spec 10), worked out from getInsights()'s numbers: chart
// kinds and their labels, the bar chart's scale and segments, the calendar's steps and labels, the
// summary sentences, the table rows and every line of copy that depends on a number. Pure and
// deterministic; the components in components/insights/ only lay these out.
import { COURSES } from "@/content/courses";
import { trackerContent } from "@/content/tracker-data";
import type { SwitchableSection } from "./access-types";
import { SWITCHABLE_SECTIONS } from "./access-types";
import { addDays, daysBetween, formatDate, formatDayMonth, formatWeekdayDate } from "./dates";
import { type ActivityDay, type CertInsight, EVENT_HISTORY_START, type InsightKind, type Insights, type KindCounts, type PhaseInsight, type WeekCompletions, computeInsights } from "./insights";
import { SECTION_LABELS } from "./nav";
import type { ProgressMap } from "./progress";
import type { SectionSettings } from "./sections";

// ---- Words

/** "1 day", "3 days"; `many` for irregular plurals. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
/** "Nov" for "2026-11-23". Three letters, never "Sept". */
export const monthShort = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
/** "23" for "2026-11-23". */
export const dayOfMonth = (iso: string) => String(Number(iso.slice(8, 10)));

// ---- Kinds (design spec 10, "Kinds"). The data layer keeps projects and career apart (each has
// its own switch); the chart draws them as one kind, labelled by which of the two are shown.

export type ChartKind = "roadmap" | "resources" | "reading" | "scaler" | "certs" | "courses" | "projects";
/** Stack order bottom to top, legend order and "By kind" order. */
export const CHART_KINDS: readonly ChartKind[] = ["roadmap", "resources", "reading", "scaler", "certs", "courses", "projects"];

export interface KindInfo {
  key: ChartKind;
  /** Key, table and summary label: "Roadmap tasks". */
  label: string;
  /** The label inside a sentence: "roadmap tasks" (Scaler keeps its capital). */
  lower: string;
}

const LABELS: Record<Exclude<ChartKind, "projects">, string> = {
  roadmap: "Roadmap tasks",
  resources: "Learning resources",
  reading: "Reading",
  scaler: "Scaler classes",
  certs: "Certification prep",
  courses: "Courses",
};

const lowerLabel = (label: string) => (label.startsWith("Scaler") ? label : label.charAt(0).toLowerCase() + label.slice(1));

/** The chart kinds this user sees, in chart order, from the data layer's shown kinds. */
export function chartKinds(kinds: readonly InsightKind[]): KindInfo[] {
  const shown = new Set(kinds);
  const out: KindInfo[] = [];
  for (const key of CHART_KINDS) {
    let label: string | null;
    if (key === "projects") {
      const projects = shown.has("projects");
      const career = shown.has("career");
      label = projects && career ? "Projects and career" : projects ? "Projects" : career ? "Career" : null;
    } else label = shown.has(key) ? LABELS[key] : null;
    if (label) out.push({ key, label, lower: lowerLabel(label) });
  }
  return out;
}

/** A week's counts per chart kind (projects and career added together). */
export function chartCounts(byKind: KindCounts): Record<ChartKind, number> {
  return {
    roadmap: byKind.roadmap,
    resources: byKind.resources,
    reading: byKind.reading,
    scaler: byKind.scaler,
    certs: byKind.certs,
    courses: byKind.courses,
    projects: byKind.projects + byKind.career,
  };
}

/** Kinds with at least one completion in the weeks shown: the key (spec 10.4), in stack order. */
export function keyKinds(weekly: readonly WeekCompletions[], kinds: readonly KindInfo[]): KindInfo[] {
  return kinds.filter((k) => weekly.some((w) => chartCounts(w.byKind)[k.key] > 0));
}

/** Any completion in the weeks shown (else the card's empty state, spec 10.2 B). */
export const hasWeeklyCompletions = (weekly: readonly WeekCompletions[]) => weekly.some((w) => w.total > 0);

// ---- The weekly bar chart (spec 10.4)

/** Plot height in px: below `md`, and from `md`. */
export const PLOT_HEIGHTS = { phone: 160, wide: 200 } as const;
/** Room above the tallest bar for its total. */
export const TOTALS_ROOM = 22;
/** Space between two segments of a bar; the card shows through. */
export const SEGMENT_GAP = 2;
/** A segment is never shorter than this, so one item stays visible. */
export const MIN_SEGMENT = 3;
/** The scale never tops out below this, so a quiet week doesn't look full. */
export const MIN_SCALE = 5;
/** The SVG's x units per week (12 weeks: viewBox width 1200). */
export const WEEK_UNITS = 100;

/** The top of the scale: the largest weekly total, at least MIN_SCALE. */
export const scaleMax = (weekly: readonly WeekCompletions[]) => Math.max(MIN_SCALE, ...weekly.map((w) => w.total));

export interface Segment {
  kind: ChartKind;
  count: number;
  /** SVG y of the segment's top, px from the top of the plot. */
  y: number;
  /** Drawn height in px (the gap above it is left out). */
  height: number;
}

export interface Bar {
  weekStart: string;
  total: number;
  current: boolean;
  /** Px from the baseline to the top of the bar, gaps included: the total sits 4 px above it. */
  height: number;
  /** Bottom to top, in kind order. */
  segments: Segment[];
}

/**
 * The bars for a plot `plotHeight` px tall. Segments stack from the baseline up in kind order, each
 * proportional to its count over the usable height (plot minus TOTALS_ROOM), with a SEGMENT_GAP above
 * every segment but the top one and at least MIN_SEGMENT px drawn.
 */
export function barLayout(weekly: readonly WeekCompletions[], kinds: readonly KindInfo[], plotHeight: number, thisWeek: string): Bar[] {
  const max = scaleMax(weekly);
  const usable = plotHeight - TOTALS_ROOM;
  return weekly.map((w) => {
    const counts = chartCounts(w.byKind);
    const parts = kinds.filter((k) => counts[k.key] > 0);
    const segments: Segment[] = [];
    let stacked = 0;
    parts.forEach((k, i) => {
      const gap = i < parts.length - 1 ? SEGMENT_GAP : 0;
      const slot = Math.max((counts[k.key] / max) * usable, MIN_SEGMENT + gap);
      const height = slot - gap;
      segments.push({ kind: k.key, count: counts[k.key], y: round2(plotHeight - stacked - slot + gap), height: round2(height) });
      stacked += slot;
    });
    return { weekStart: w.weekStart, total: w.total, current: w.weekStart === thisWeek, height: round2(stacked), segments };
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface WeekLabel {
  /** Day of month of the week's Monday: "23". */
  day: string;
  /** "Nov" on the first column and where a new month starts; null otherwise. */
  month: string | null;
}

/**
 * Labels under the bars: the Monday's day of month, and the month on the first column and on each
 * column whose Monday is in a new month. The first column's month is dropped when the second column
 * has one, so the two don't touch at 320 px.
 */
export function weekLabels(weekStarts: readonly string[]): WeekLabel[] {
  const labels = weekStarts.map((w, i) => ({
    day: dayOfMonth(w),
    month: i === 0 || monthShort(w) !== monthShort(weekStarts[i - 1]) ? monthShort(w) : null,
  }));
  if (labels.length > 1 && labels[1].month !== null) labels[0].month = null;
  return labels;
}

/** The hidden sentence after the bar chart's key (spec 10.5). */
export function weeklySummary(weekly: readonly WeekCompletions[], keys: readonly KindInfo[], thisWeek: string): string {
  const total = weekly.reduce((sum, w) => sum + w.total, 0);
  const current = weekly.find((w) => w.weekStart === thisWeek)?.total ?? 0;
  const last = weekly.find((w) => w.weekStart === addDays(thisWeek, -7))?.total ?? 0;
  // Ties go to the most recent week.
  const busiest = weekly.reduce((best, w) => (w.total >= best.total ? w : best), weekly[0]);
  const parts = [
    `Over the last ${weekly.length} weeks you marked ${plural(total, "item")} done.`,
    `This week so far: ${current}; last week: ${last}.`,
    `Busiest week: week of ${formatWeekdayDate(busiest.weekStart)}, with ${busiest.total}.`,
  ];
  if (keys.length > 1) {
    const sums = keys.map((k) => ({ k, n: weekly.reduce((sum, w) => sum + chartCounts(w.byKind)[k.key], 0) }));
    const most = sums.reduce((best, s) => (s.n > best.n ? s : best), sums[0]);
    parts.push(`Most were ${most.k.lower} (${most.n}).`);
  }
  return parts.join(" ");
}

export interface WeeklyRow {
  weekStart: string;
  /** "23 Nov". */
  label: string;
  current: boolean;
  total: number;
  /** "Roadmap tasks 2 · Learning resources 3", or null for "Nothing done". */
  byKind: string | null;
}

/** The "Show as table" rows for the bar chart, newest week first. */
export function weeklyRows(weekly: readonly WeekCompletions[], kinds: readonly KindInfo[], thisWeek: string): WeeklyRow[] {
  return [...weekly].reverse().map((w) => {
    const counts = chartCounts(w.byKind);
    const parts = kinds.filter((k) => counts[k.key] > 0).map((k) => `${k.label} ${counts[k.key]}`);
    return { weekStart: w.weekStart, label: formatDayMonth(w.weekStart), current: w.weekStart === thisWeek, total: w.total, byKind: parts.length ? parts.join(" · ") : null };
  });
}

// ---- The activity calendar (spec 10.4)

export type HeatStep = 0 | 1 | 2 | 3 | 4;

/** Saves that day to a step: 0, 1–2, 3–5, 6–9, 10 or more. Fixed, so a square means the same every week. */
export function heatStep(count: number): HeatStep {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/** The key's steps, in order. */
export const HEAT_KEY: readonly { step: HeatStep; label: string }[] = [
  { step: 0, label: "None" },
  { step: 1, label: "1–2" },
  { step: 2, label: "3–5" },
  { step: 3, label: "6–9" },
  { step: 4, label: "10 or more" },
];

/** Columns (weeks) and rows (Monday at the top) of the calendar; cell pitch in viewBox units. */
export const CALENDAR_WEEKS = 26;
export const CELL_PITCH = 12;

export interface HeatCell {
  date: string;
  count: number;
  step: HeatStep;
  /** Week column, 0 = oldest. */
  col: number;
  /** 0 = Monday … 6 = Sunday. */
  row: number;
  today: boolean;
}

/** One cell per day from the window's first Monday to today; days after today get none. */
export function heatCells(days: readonly ActivityDay[], windowStart: string, today: string): HeatCell[] {
  return days.map((d) => {
    const i = daysBetween(windowStart, d.date);
    return { date: d.date, count: d.count, step: heatStep(d.count), col: Math.floor(i / 7), row: i % 7, today: d.date === today };
  });
}

export interface MonthLabel {
  col: number;
  label: string;
}

/**
 * Month labels above the calendar: each on the first column holding that month's 1st (among the
 * days shown). The leftmost column gets its own month only when the next label is 3 or more
 * columns away.
 */
export function monthLabels(days: readonly ActivityDay[], windowStart: string): MonthLabel[] {
  const labels: MonthLabel[] = [];
  for (const d of days) {
    if (d.date.slice(8) !== "01") continue;
    const col = Math.floor(daysBetween(windowStart, d.date) / 7);
    labels.push({ col, label: monthShort(d.date) });
  }
  if (days.length > 0 && labels[0]?.col !== 0) {
    const next = labels[0]?.col ?? Infinity;
    if (next >= 3) labels.unshift({ col: 0, label: monthShort(days[0].date) });
  }
  return labels;
}

/** Days with at least one save. */
export const activeDayCount = (days: readonly ActivityDay[]) => days.filter((d) => d.count > 0).length;

/** "12 active days", "1 active day". */
export const activeDaysText = (n: number) => plural(n, "active day");

/** The hidden sentence after the calendar's key (spec 10.5). */
export function activitySummary(days: readonly ActivityDay[], activeDays30: number, today: string): string {
  const active = activeDayCount(days);
  // Ties go to the most recent day.
  const busiest = days.reduce((best, d) => (d.count >= best.count ? d : best), days[0]);
  const todayCount = days.find((d) => d.date === today)?.count ?? 0;
  const parts = [`${active} of the last ${days.length} days were active.`, `Last 30 days: ${activeDaysText(activeDays30)}.`];
  if (busiest && busiest.count > 0) parts.push(`Busiest day: ${formatWeekdayDate(busiest.date)}, with ${plural(busiest.count, "save")}.`);
  parts.push(todayCount > 0 ? `Today: ${plural(todayCount, "save")} so far.` : "Today: no saves yet.");
  return parts.join(" ");
}

export interface ActivityRow {
  weekStart: string;
  label: string;
  current: boolean;
  activeDays: number;
  /** "Mon 3 · Wed 1 · Sat 5", or null for "No activity". */
  savesByDay: string | null;
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The "Show as table" rows for the calendar: one per week, newest first. */
export function activityRows(days: readonly ActivityDay[], windowStart: string, today: string): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (let c = 0; c * 7 < days.length; c++) {
    const week = days.slice(c * 7, c * 7 + 7);
    const weekStart = addDays(windowStart, c * 7);
    const saves = week.map((d, r) => (d.count > 0 ? `${WEEKDAY_SHORT[r]} ${d.count}` : null)).filter((s): s is string => s !== null);
    rows.push({
      weekStart,
      label: formatDayMonth(weekStart),
      current: week.some((d) => d.date === today),
      activeDays: activeDayCount(week),
      savesByDay: saves.length ? saves.join(" · ") : null,
    });
  }
  return rows.reverse();
}

/** The estimate line shows while the window reaches back before the event history. */
export const ESTIMATE_LINE = `Days before ${formatDate(EVENT_HISTORY_START)} are estimated from when items were marked done, so they may show less than you did.`;

// ---- At a glance (spec 10.2 A)

/** "Mon 23 Nov – Sun 29 Nov": the header's "This week" fact. */
export const weekRangeText = (weekStart: string) => `${formatWeekdayDate(weekStart)} – ${formatWeekdayDate(addDays(weekStart, 6))}`;

export interface TileText {
  value: string;
  label: string;
  /** The full reading for screen readers, when it replaces the number and label. */
  sr?: string;
  hint?: string;
}

export function glanceTiles(t: Insights["thisWeek"]): [TileText, TileText, TileText] {
  return [
    {
      value: String(t.done),
      label: `done this week · ${t.lastWeek} last week`,
      sr: `${plural(t.done, "item")} done this week, ${t.lastWeek} last week`,
    },
    {
      value: String(t.currentStreak),
      label: `${t.currentStreak === 1 ? "week" : "weeks"} in your current streak`,
      hint:
        t.currentStreak === 0
          ? "Mark something done this week to start one."
          : t.done === 0
            ? "Mark something done this week to keep it going."
            : undefined,
    },
    { value: String(t.longestStreak), label: `${t.longestStreak === 1 ? "week" : "weeks"} in your longest streak` },
  ];
}

export const STREAK_DEFINITION =
  "A streak counts the weeks in a row, Monday to Sunday, in which you marked at least one item done. This week joins your streak as soon as you do.";

/**
 * "Hidden sections aren't counted here: Scaler course and Projects." with its link label, or null
 * when nothing is switched off. A locked Scaler isn't listed: the person never had it.
 */
export function hiddenSectionsLine(settings: SectionSettings): { text: string; link: string } | null {
  const off = SWITCHABLE_SECTIONS.filter((s: SwitchableSection) => !settings.sections[s] && (s !== "scaler" || settings.scalerUnlocked));
  if (off.length === 0) return null;
  return {
    text: `Hidden sections aren't counted here: ${andList(off.map((s) => SECTION_LABELS[s]))}.`,
    link: off.length === 1 ? "Show it in Settings" : "Show them in Settings",
  };
}

// ---- Current phase (spec 10.2 D)

const PHASES = trackerContent.phases;

/** Where today sits when no phase includes it: before the roadmap, after it, or null (in a phase or a gap). */
export function outsideRoadmap(today: string): { text: string } | null {
  const first = PHASES[0];
  const last = PHASES[PHASES.length - 1];
  if (today < first.start) return { text: `The roadmap starts on ${formatDate(first.start)}.` };
  if (today > last.end) return { text: `The roadmap's last phase ended on ${formatDate(last.end)}.` };
  return null;
}

/** "Tue 15 Dec · 6 days left", "Tue 15 Dec · last day". */
export function phaseEndsText(phase: PhaseInsight): string {
  const end = formatWeekdayDate(phase.end);
  if (phase.daysLeft === 0) return `${end} · last day`;
  if (phase.daysLeft > 0) return `${end} · ${plural(phase.daysLeft, "day")} left`;
  return `${end} · ended`;
}

/** The "Projected finish" fact, or null once every task is done. */
export function projectionText(phase: PhaseInsight): string | null {
  const p = phase.projection;
  if (p.status === "complete") return null;
  if (p.status === "not-enough-activity") return "Not enough recent activity";
  const finish = formatWeekdayDate(p.finish);
  const before = daysBetween(p.finish, phase.end);
  if (before === 0) return `${finish} · on its last day`;
  return before > 0 ? `${finish} · ${plural(before, "day")} before it ends` : `${finish} · ${plural(-before, "day")} after it ends`;
}

/** The line under the facts. */
export function paceLine(phase: PhaseInsight): string {
  const p = phase.projection;
  if (p.status === "complete") return "All tasks in this phase are done.";
  if (p.status === "not-enough-activity") return "Mark at least 2 roadmap tasks done within 4 weeks to see a projected finish.";
  return `At your pace over the last 4 weeks: ${plural(phase.recentCompletions, "roadmap task")} done.`;
}

// ---- This month (spec 10.2 E)

export function monthText(m: Insights["thisMonth"]) {
  return {
    since: `Since ${formatDayMonth(m.monthStart)}`,
    notesLabel: m.notesSaved === 1 ? "item with a note saved" : "items with a note saved",
    resourcesLabel: m.resourcesDone === 1 ? "learning resource finished" : "learning resources finished",
    /** Only in the month the event history began. */
    historyLine:
      m.monthStart.slice(0, 7) === EVENT_HISTORY_START.slice(0, 7)
        ? `Notes are counted from ${formatDate(EVENT_HISTORY_START)}, when the app started recording them.`
        : null,
    emptyLine: m.notesSaved === 0 && m.resourcesDone === 0 ? "Notes you save and learning resources you finish this month will show here." : null,
  };
}

// ---- Certifications (spec 10.2 F; the lead settled "days left" on 2026-11-26)

/** "December 2026 · 35 days left", "… · today", "… · date passed", or the date text alone. */
export function certLine(cert: CertInsight): string {
  if (cert.passed || cert.daysLeft === null) return cert.dateText;
  if (cert.daysLeft === 0) return `${cert.dateText} · today`;
  if (cert.daysLeft < 0) return `${cert.dateText} · date passed`;
  return `${cert.dateText} · ${plural(cert.daysLeft, "day")} left`;
}

export const passedCount = (certs: readonly CertInsight[]) => certs.filter((c) => c.passed).length;

// ---- Home's link (spec 10.7)

/**
 * This week's numbers for Home's Insights link, from the progress rows Home already reads, through
 * the same function as the Insights page (computeInsights; no events, which only feed activity).
 */
export function weekGlance(progress: ProgressMap, settings: SectionSettings, nowMs: number): Insights["thisWeek"] {
  const rows = [...progress].filter(([, r]) => r.done).map(([itemId, r]) => ({ itemId, done: true, doneAt: r.doneAt }));
  return computeInsights({ nowMs, progress: rows, events: [], settings, content: trackerContent, courses: COURSES }).thisWeek;
}

/** "3-week streak", "1-week streak" or "no streak yet". */
export const homeStreakText = (streak: number) => (streak > 0 ? `${streak}-week streak` : "no streak yet");
