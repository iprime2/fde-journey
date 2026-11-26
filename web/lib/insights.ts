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
// - Activity counts saves (progress_event rows of any kind) per IST day. Up to and including the
//   day the event history began (the M4a release, EVENT_HISTORY_START), a day counts the larger of
//   its saves and its `done_at` completions, as a best-effort estimate: ticks made before the
//   release (that morning too) have no events, and taking the larger never counts a tick twice.
// - Kinds of hidden or locked sections are left out of everything: charts, totals, activity and
//   this month's notes. Weekly notes (the journal) belong to no section and always count as activity.
// - Only ids the content knows count (lib/ids.ts): the same items every other page counts.
import type { Course, TrackerContent } from "@/content/types";
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

/** Saves (progress_event rows of any kind) on one item on one IST day, counted in SQL. */
export interface InsightEventDay {
  itemId: string;
  /** IST date, "YYYY-MM-DD". */
  day: string;
  count: number;
}

export interface InsightsInput {
  /** The current time, epoch ms. */
  nowMs: number;
  progress: readonly InsightProgressRow[];
  /** Saves per item and IST day from activityWindowStart(nowMs) on; days outside the window are ignored. */
  events: readonly InsightEventDay[];
  /**
   * Distinct items with a note saved (a `note` event) since 00:00 IST on the 1st of this month
   * (monthStart(nowMs)). None when left out.
   */
  notedItems?: readonly string[];
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
  /**
   * Saves that day (ticks, unticks, notes, links). Up to and including EVENT_HISTORY_START, the
   * larger of the saves and the completions that day.
   */
  count: number;
  /** True up to and including EVENT_HISTORY_START: the count may be estimated from completion dates. */
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
  /**
   * The section settings these numbers were computed with (sections and the Scaler unlock only), so
   * the page's hidden-sections line always matches its charts.
   */
  settings: SectionSettings;
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
    /**
     * The window reaches EVENT_HISTORY_START or earlier: some days are estimates (say so on the
     * page). False once the window starts after the release day.
     */
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

/** The 1st of this month in IST, "YYYY-MM-DD". */
export const monthStartDay = (nowMs: number) => `${istDate(nowMs).slice(0, 7)}-01`;

/** The instant this month starts (00:00 IST on the 1st): the note query's lower bound. */
export const monthStart = (nowMs: number) => new Date(istDayStartMs(monthStartDay(nowMs)));

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

const monthIndex = (name: string) => MONTHS.indexOf(name);
/** A dash between the two ends of a range, with or without spaces. */
const DASH = "\\s*[–—-]\\s*";

/**
 * The target date a certification's date text names: the last day it names. A date text that
 * isn't a deadline, or can't be read one way only, gives null (no countdown):
 * - "December 2026" → 2026-12-31; "February–March 2027, after Phase 6" → 2027-03-31;
 * - "December 2026 – February 2027" → 2027-02-28; "February 10–15, 2027" → 2027-02-15;
 * - "April 2027 or later" → null: "or later" isn't a deadline;
 * - "After job applications are going" → null: no month and year;
 * - ambiguous → null: a range that runs backwards, a range whose end has no year
 *   ("December 2026 – February"), a choice ("December 2026 or January 2027"), a day that doesn't exist.
 */
export function targetDateOf(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (/\bor later\b/.test(t)) return null;
  const parse = (): { iso: string; rest: string } | null => {
    // "December 2026 – February 2027"
    let m = new RegExp(`^${MONTH}\\s+(\\d{4})${DASH}${MONTH}\\s+(\\d{4})\\b`).exec(t);
    if (m) {
      const [whole, m1, y1, m2, y2] = m;
      const [from, to] = [Number(y1) * 12 + monthIndex(m1), Number(y2) * 12 + monthIndex(m2)];
      return to > from ? { iso: lastDayOfMonth(Number(y2), monthIndex(m2)), rest: t.slice(whole.length) } : null;
    }
    // "February 10–15, 2027" or "February 15, 2027"
    m = new RegExp(`^${MONTH}\\s+(\\d{1,2})(?:${DASH}(\\d{1,2}))?,?\\s+(\\d{4})\\b`).exec(t);
    if (m) {
      const [whole, month, from, to, year] = m;
      const day = Number(to ?? from);
      const iso = `${year}-${String(monthIndex(month) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const ok = Number(from) >= 1 && day >= Number(from) && iso <= lastDayOfMonth(Number(year), monthIndex(month));
      return ok ? { iso, rest: t.slice(whole.length) } : null;
    }
    // "February–March 2027" or "December 2026"
    m = new RegExp(`^${MONTH}(?:${DASH}${MONTH})?\\s+(\\d{4})\\b`).exec(t);
    if (m) {
      const [whole, first, last, year] = m;
      if (last && monthIndex(last) <= monthIndex(first)) return null;
      return { iso: lastDayOfMonth(Number(year), monthIndex(last ?? first)), rest: t.slice(whole.length) };
    }
    return null;
  };
  const parsed = parse();
  // What follows the date mustn't extend it or offer another one: "– February", "or January 2027".
  if (!parsed || new RegExp(`^(?:${DASH}|\\s+(?:to|or|and|until|through)\\b)`).test(parsed.rest)) return null;
  return parsed.iso;
}

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

// ---- The whole page

interface Completion {
  itemId: string;
  kind: InsightKind;
  day: string;
  week: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function computeInsights({ nowMs, progress, events, notedItems = [], settings, content, courses }: InsightsInput): Insights {
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
  const add = (map: Map<string, number>, day: string, n: number) => map.set(day, (map.get(day) ?? 0) + n);
  const shownItem = (itemId: string) => itemId === JOURNAL_ID || shownKind(itemId) !== null;
  const savesPerDay = new Map<string, number>();
  for (const e of events) {
    if (!ISO_DAY.test(e.day) || e.day < windowStart || e.day > today || !shownItem(e.itemId)) continue;
    add(savesPerDay, e.day, Number.isInteger(e.count) && e.count > 0 ? e.count : 0);
  }
  const completionsPerDay = new Map<string, number>();
  for (const c of completions) if (c.day <= EVENT_HISTORY_START && c.day >= windowStart) add(completionsPerDay, c.day, 1);
  const days: ActivityDay[] = [];
  for (let day = windowStart; day <= today; day = addDays(day, 1)) {
    const saves = savesPerDay.get(day) ?? 0;
    const estimated = day <= EVENT_HISTORY_START;
    days.push({ date: day, count: estimated ? Math.max(saves, completionsPerDay.get(day) ?? 0) : saves, estimated });
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
  const monthFrom = monthStartDay(nowMs);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    today,
    kinds,
    settings: { sections: { ...settings.sections }, scalerUnlocked: settings.scalerUnlocked },
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
      reachesBeforeHistory: windowStart <= EVENT_HISTORY_START,
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
      monthStart: monthFrom,
      // Distinct items, not saves: notes autosave while typing, so one note can record many saves.
      notesSaved: new Set(notedItems.filter(shownItem)).size,
      resourcesDone: completions.filter((c) => c.kind === "resources" && c.day >= monthFrom).length,
    },
  };
}
