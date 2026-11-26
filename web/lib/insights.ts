// The Insights page's numbers (M5a, docs/M5-DESIGN.md). Pure and deterministic: no database, no
// clock. The caller passes "now", the user's done items, their save history (progress_event) from
// the activity window, their section settings and the content. The database read is getInsights()
// in lib/data.ts.
//
// Rules (M5-DESIGN "Rules"):
// - Days, weeks and months are IST (Asia/Kolkata); weeks start on Monday (lib/dates.ts).
// - A completion is an item that is done now, counted in the IST week of its `done_at`. An item
//   ticked and then unticked doesn't count; one done without a `done_at` (an old import) counts in
//   the totals but in no week.
// - Activity counts saves (progress_event rows of any kind) per IST day. Before the event history
//   began (the M4a release, EVENT_HISTORY_START) a `done_at` completion counts as one save instead,
//   as a best-effort estimate.
// - Kinds of hidden or locked sections are left out of everything: charts, totals, activity and
//   this month's notes. Weekly notes (the journal) belong to no section and always count as activity.
// - Only ids the content knows count (lib/ids.ts): the same items every other page counts.
import type { Course, TrackerContent } from "@/content/types";
import type { ProgressEventKind } from "@/db/schema";
import type { DoneSection, SectionChoices } from "./access-types";
import { addDays, daysBetween, istDate, istDayStartMs, weekStartOf } from "./dates";
import { JOURNAL_ID, certTaskId, certsInDisplayOrder, itemKind, listItems, phaseTaskId } from "./ids";
import type { SectionSettings } from "./sections";
import { pickCurrentPhase } from "./status";

/** The kinds the weekly chart splits completions into, in chart order. Same names as DONE_SECTIONS. */
export type InsightKind = DoneSection;
export const INSIGHT_KINDS: readonly InsightKind[] = ["roadmap", "resources", "reading", "scaler", "certs", "courses", "projects", "career"];

/** The setting that shows each kind; null for kinds with no switch (Courses & badges). */
const SECTION_OF_KIND: Record<InsightKind, keyof SectionChoices | null> = {
  roadmap: "roadmap",
  resources: "roadmap",
  reading: "reading",
  scaler: "scaler",
  certs: "certs",
  courses: null,
  projects: "projects",
  career: "career",
};

/** The first IST day with save history: the M4a release. Earlier days are estimated from `done_at`. */
export const EVENT_HISTORY_START = "2026-11-26";
/** Weeks in the completions chart, this week included. */
export const WEEKLY_WEEKS = 12;
/** Whole weeks (Monday to Sunday, this week included) in the activity heatmap. */
export const ACTIVITY_WEEKS = 26;
/** "Active days in the last 30": today and the 29 days before it. */
export const ACTIVE_DAYS_WINDOW = 30;
/** The recent pace for the phase projection: completions over the last 28 days (4 weeks), today included. */
export const PACE_DAYS = 28;
/** Fewer completions than this in the pace window: no projection. */
export const MIN_PACE_COMPLETIONS = 2;

// ---- Inputs

/** A saved progress row, without its note or link. Rows not done are ignored. */
export interface InsightProgressRow {
  itemId: string;
  done: boolean;
  /** ISO timestamp, or null. */
  doneAt: string | null;
}

/** A progress_event row: which item, what kind of save, when (ISO timestamp). */
export interface InsightEvent {
  itemId: string;
  kind: ProgressEventKind;
  at: string;
}

export interface InsightsInput {
  /** The current time, epoch ms. */
  nowMs: number;
  progress: readonly InsightProgressRow[];
  /** Events from activityWindowStart(nowMs) on; earlier ones are ignored. */
  events: readonly InsightEvent[];
  /** The user's effective sections (lib/sections.ts effectiveSections). */
  settings: SectionSettings;
  content: TrackerContent;
  courses: readonly Course[];
}

// ---- Output

export type KindCounts = Record<InsightKind, number>;

export interface WeekCompletions {
  /** The week's Monday (IST), "YYYY-MM-DD". */
  weekStart: string;
  total: number;
  /** Per kind. Kinds not in `Insights.kinds` (hidden or locked) are always 0. */
  byKind: KindCounts;
}

export interface ActivityDay {
  /** IST date, "YYYY-MM-DD". */
  date: string;
  /** Saves that day (ticks, unticks, notes, links); before the event history, completions. */
  count: number;
  /** True before EVENT_HISTORY_START: the count is estimated from completion dates. */
  estimated: boolean;
}

export type PhaseProjection =
  | {
      status: "projected";
      /** IST date the phase's tasks would all be done at the recent pace. */
      finish: string;
      /** Days from today to `finish`. */
      daysNeeded: number;
      /** The recent pace, tasks per week (completions in the last 28 days ÷ 4), one decimal. */
      perWeek: number;
      /** The projected finish falls on or before the phase's end date. */
      onTrack: boolean;
    }
  | { status: "not-enough-activity" }
  | { status: "complete" };

export interface PhaseInsight {
  n: number;
  title: string;
  /** ISO dates, inclusive. */
  start: string;
  end: string;
  /** Today falls within the phase's dates (false when Home's fallback picked it: before, between or after phases). */
  inDates: boolean;
  done: number;
  total: number;
  /** Days from today to the phase's last day: 0 on that day, negative once it has passed. */
  daysLeft: number;
  /** The phase's tasks completed in the last PACE_DAYS days. */
  recentCompletions: number;
  projection: PhaseProjection;
}

export interface CertInsight {
  /** Array position in the content (its ids are `c{index + 1}-…`); the list is in display order. */
  index: number;
  name: string;
  /** The content's date text, as the Certifications page shows it ("December 2026"). */
  dateText: string;
  /**
   * The last day of the month (or range) the date text names, "YYYY-MM-DD"; null when it names no
   * date ("After joining a Claude partner company").
   */
  targetDate: string | null;
  /** Days from today to `targetDate` (negative once passed); null without a target date. */
  daysLeft: number | null;
  done: number;
  total: number;
  /** The last prep step is ticked, as on the Certifications page. */
  passed: boolean;
}

export interface Insights {
  /** "Now" as passed in, ISO. */
  generatedAt: string;
  /** IST date. */
  today: string;
  /** Kinds shown for this user, in chart order. Hidden and locked sections' kinds are left out. */
  kinds: InsightKind[];
  /** Any completion with a date, in a shown kind (false: the weekly cards' empty state). */
  hasCompletions: boolean;
  thisWeek: {
    /** This week's Monday (IST). */
    weekStart: string;
    done: number;
    lastWeek: number;
    /** Weeks in a row with at least one completion, up to this week (or last week while this one has none). */
    currentStreak: number;
    longestStreak: number;
  };
  /** The last WEEKLY_WEEKS weeks, oldest first; the last one is this week. */
  weekly: WeekCompletions[];
  activity: {
    /** Monday of the first week shown. */
    windowStart: string;
    /** Every IST day from `windowStart` to today, oldest first. */
    days: ActivityDay[];
    /** Days with at least one save in the last ACTIVE_DAYS_WINDOW days (today included). */
    activeDays30: number;
    /** EVENT_HISTORY_START. */
    historyStart: string;
    /** The window starts before the event history: some days are estimates (say so on the page). */
    reachesBeforeHistory: boolean;
    /** Any day in the window with a save (false: the heatmap's empty state). */
    hasActivity: boolean;
  };
  phase: PhaseInsight;
  /** Certifications in display order; empty when the Certifications section is hidden. */
  certs: CertInsight[];
  thisMonth: {
    /** The 1st of this month (IST). */
    monthStart: string;
    /** Items whose note was saved this month, each counted once (weekly notes included; never the text). */
    notesSaved: number;
    /** Learning resources (`r` ids) completed this month. */
    resourcesDone: number;
  };
}

// ---- Helpers

/** Monday of the first week in the activity window. */
export const activityWindowStartDay = (nowMs: number) => addDays(weekStartOf(istDate(nowMs)), -7 * (ACTIVITY_WEEKS - 1));

/** The instant the activity window starts (00:00 IST on its first Monday): the event query's lower bound. */
export const activityWindowStart = (nowMs: number) => new Date(istDayStartMs(activityWindowStartDay(nowMs)));

/** The kinds this user sees: their section is shown (Scaler also unlocked). Courses always show. */
export function shownKinds({ sections, scalerUnlocked }: SectionSettings): InsightKind[] {
  return INSIGHT_KINDS.filter((kind) => {
    const section = SECTION_OF_KIND[kind];
    if (section === null) return true;
    if (section === "scaler") return sections.scaler && scalerUnlocked;
    return sections[section];
  });
}

const zeroCounts = (): KindCounts => ({ roadmap: 0, resources: 0, reading: 0, scaler: 0, certs: 0, courses: 0, projects: 0, career: 0 });

/** IST date of an ISO timestamp, or null when it doesn't parse. */
function dayOf(iso: string | null): string | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : istDate(ms);
}

/** Streaks over a set of week Mondays. The current one may start last week while this week is empty. */
export function weeklyStreaks(weeks: ReadonlySet<string>, thisWeek: string): { current: number; longest: number } {
  let week = weeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  while (weeks.has(week)) {
    current += 1;
    week = addDays(week, -7);
  }
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const w of [...weeks].filter((x) => x <= thisWeek).sort()) {
    run = previous !== null && daysBetween(previous, w) === 7 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = w;
  }
  return { current, longest };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH = `(${MONTHS.join("|")})`;
const lastDayOfMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);

/**
 * The target date a certification's date text names: the last day of the month, or of the last
 * month of a range. "December 2026" → 2026-12-31; "February–March 2027, after Phase 6" →
 * 2027-03-31; "April 2027 or later" → 2027-04-30; "February 10–15, 2027" → 2027-02-15. Text that
 * names no month and year ("After job applications are going") → null.
 */
export function targetDateOf(text: string): string | null {
  const t = text.trim().toLowerCase();
  const days = new RegExp(`^${MONTH}\\s+(\\d{1,2})(?:\\s*[–-]\\s*(\\d{1,2}))?,?\\s+(\\d{4})\\b`).exec(t);
  if (days) {
    const [, month, from, to, year] = days;
    const iso = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-${String(Number(to ?? from)).padStart(2, "0")}`;
    const lastDay = lastDayOfMonth(Number(year), MONTHS.indexOf(month));
    return iso <= lastDay ? iso : null;
  }
  const months = new RegExp(`^${MONTH}(?:\\s*[–-]\\s*${MONTH})?\\s+(\\d{4})\\b`).exec(t);
  if (months) {
    const [, first, last, year] = months;
    return lastDayOfMonth(Number(year), MONTHS.indexOf(last ?? first));
  }
  return null;
}

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

// ---- The whole page

interface Completion {
  itemId: string;
  kind: InsightKind;
  day: string;
  week: string;
}

export function computeInsights({ nowMs, progress, events, settings, content, courses }: InsightsInput): Insights {
  const today = istDate(nowMs);
  const thisWeek = weekStartOf(today);
  const kinds = shownKinds(settings);
  const shown = new Set<InsightKind>(kinds);
  const known = new Set(listItems(content, courses).map((i) => i.id));
  /** The kind of an id the content knows, if this user sees that kind. */
  const shownKind = (itemId: string): InsightKind | null => {
    if (!known.has(itemId)) return null;
    const kind = itemKind(itemId);
    return kind && shown.has(kind) ? kind : null;
  };

  const doneIds = new Set(progress.filter((p) => p.done).map((p) => p.itemId));
  // Completions with a date up to today, in shown kinds. A `done_at` after today (a device clock
  // running ahead, in old imports) belongs to no week yet.
  const completions: Completion[] = [];
  for (const row of progress) {
    if (!row.done) continue;
    const kind = shownKind(row.itemId);
    const day = dayOf(row.doneAt);
    if (!kind || !day || day > today) continue;
    completions.push({ itemId: row.itemId, kind, day, week: weekStartOf(day) });
  }

  // Completions per week, and streaks.
  const weekly: WeekCompletions[] = [];
  for (let i = WEEKLY_WEEKS - 1; i >= 0; i--) weekly.push({ weekStart: addDays(thisWeek, -7 * i), total: 0, byKind: zeroCounts() });
  const weekIndex = new Map(weekly.map((w, i) => [w.weekStart, i]));
  const weeksWithCompletions = new Set<string>();
  for (const c of completions) {
    weeksWithCompletions.add(c.week);
    const i = weekIndex.get(c.week);
    if (i === undefined) continue;
    weekly[i].total += 1;
    weekly[i].byKind[c.kind] += 1;
  }
  const lastWeekStart = addDays(thisWeek, -7);
  const countInWeek = (week: string) => completions.filter((c) => c.week === week).length;
  const streaks = weeklyStreaks(weeksWithCompletions, thisWeek);

  // Activity per day.
  const windowStart = activityWindowStartDay(nowMs);
  const perDay = new Map<string, number>();
  const bump = (day: string) => perDay.set(day, (perDay.get(day) ?? 0) + 1);
  const shownEvent = (e: InsightEvent) => e.itemId === JOURNAL_ID || shownKind(e.itemId) !== null;
  const eventDays: { itemId: string; kind: ProgressEventKind; day: string }[] = [];
  for (const e of events) {
    const day = dayOf(e.at);
    if (!day || day < windowStart || day > today || !shownEvent(e)) continue;
    eventDays.push({ itemId: e.itemId, kind: e.kind, day });
    bump(day);
  }
  for (const c of completions) if (c.day < EVENT_HISTORY_START && c.day >= windowStart) bump(c.day);
  const days: ActivityDay[] = [];
  for (let day = windowStart; day <= today; day = addDays(day, 1)) {
    days.push({ date: day, count: perDay.get(day) ?? 0, estimated: day < EVENT_HISTORY_START });
  }
  const activeFrom = addDays(today, -(ACTIVE_DAYS_WINDOW - 1));

  // The current phase, chosen as Home chooses it.
  const phaseIds = (p: TrackerContent["phases"][number]) => p.tasks.map((_, j) => phaseTaskId(p.n, j));
  const phase = pickCurrentPhase(content.phases, today, (p) => phaseIds(p).every((id) => doneIds.has(id)));
  const ids = new Set(phaseIds(phase));
  const done = [...ids].filter((id) => doneIds.has(id)).length;
  const total = ids.size;
  const paceFrom = addDays(today, -(PACE_DAYS - 1));
  const recentCompletions = completions.filter((c) => ids.has(c.itemId) && c.day >= paceFrom).length;
  let projection: PhaseProjection;
  if (done === total) projection = { status: "complete" };
  else if (recentCompletions < MIN_PACE_COMPLETIONS) projection = { status: "not-enough-activity" };
  else {
    const daysNeeded = Math.ceil(((total - done) * PACE_DAYS) / recentCompletions);
    const finish = addDays(today, daysNeeded);
    projection = { status: "projected", finish, daysNeeded, perWeek: oneDecimal((recentCompletions * 7) / PACE_DAYS), onTrack: finish <= phase.end };
  }

  // Certifications.
  const certs: CertInsight[] = !shown.has("certs")
    ? []
    : certsInDisplayOrder(content).map(({ cert, index }) => {
        const taskIds = cert.tasks.map((_, j) => certTaskId(index, j));
        const targetDate = targetDateOf(cert.date);
        return {
          index,
          name: cert.name,
          dateText: cert.date,
          targetDate,
          daysLeft: targetDate ? daysBetween(today, targetDate) : null,
          done: taskIds.filter((id) => doneIds.has(id)).length,
          total: taskIds.length,
          passed: taskIds.length > 0 && doneIds.has(taskIds[taskIds.length - 1]),
        };
      });

  // This month.
  const monthStart = `${today.slice(0, 7)}-01`;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    today,
    kinds,
    hasCompletions: completions.length > 0,
    thisWeek: {
      weekStart: thisWeek,
      done: countInWeek(thisWeek),
      lastWeek: countInWeek(lastWeekStart),
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
    },
    weekly,
    activity: {
      windowStart,
      days,
      activeDays30: days.filter((d) => d.date >= activeFrom && d.count > 0).length,
      historyStart: EVENT_HISTORY_START,
      reachesBeforeHistory: windowStart < EVENT_HISTORY_START,
      hasActivity: days.some((d) => d.count > 0),
    },
    phase: {
      n: phase.n,
      title: phase.title,
      start: phase.start,
      end: phase.end,
      inDates: today >= phase.start && today <= phase.end,
      done,
      total,
      daysLeft: daysBetween(today, phase.end),
      recentCompletions,
      projection,
    },
    certs,
    thisMonth: {
      monthStart,
      // Distinct items, not saves: notes autosave while typing, so one note can record many saves.
      notesSaved: new Set(eventDays.filter((e) => e.kind === "note" && e.day >= monthStart).map((e) => e.itemId)).size,
      resourcesDone: completions.filter((c) => c.kind === "resources" && c.day >= monthStart).length,
    },
  };
}
