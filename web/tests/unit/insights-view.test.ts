// Insights view logic (design spec 10): kinds and labels, the bar chart's scale and segments, the
// calendar's steps and labels, summaries, table rows and copy. All progress here is made up.
import { describe, expect, it } from "vitest";
import { trackerContent } from "@/content/tracker-data";
import { DEFAULT_SECTIONS, OWNER_SECTIONS } from "@/lib/access-types";
import { addDays } from "@/lib/dates";
import { type ActivityDay, type CertInsight, INSIGHT_KINDS, type InsightKind, type KindCounts, type PhaseInsight, type WeekCompletions, computeInsights } from "@/lib/insights";
import {
  CHART_KINDS,
  MIN_SEGMENT,
  PLOT_HEIGHTS,
  SEGMENT_GAP,
  TOTALS_ROOM,
  activityRows,
  activitySummary,
  andList,
  barLayout,
  certLine,
  chartCounts,
  chartKinds,
  glanceTiles,
  hasWeeklyCompletions,
  heatCells,
  heatStep,
  hiddenSectionsLine,
  homeStreakText,
  keyKinds,
  monthLabels,
  monthText,
  outsideRoadmap,
  paceLine,
  passedCount,
  phaseEndsText,
  plural,
  projectionText,
  scaleMax,
  weekGlance,
  weekLabels,
  weekRangeText,
  weeklyRows,
  weeklySummary,
} from "@/lib/insights-view";
import type { ProgressRecord } from "@/lib/progress";
import type { SectionSettings } from "@/lib/sections";

const zero = (): KindCounts => ({ roadmap: 0, resources: 0, reading: 0, scaler: 0, certs: 0, courses: 0, projects: 0, career: 0 });
const week = (weekStart: string, counts: Partial<KindCounts> = {}): WeekCompletions => {
  const byKind = { ...zero(), ...counts };
  return { weekStart, total: Object.values(byKind).reduce((a, b) => a + b, 0), byKind };
};
/** 12 Mondays ending with THIS_WEEK. */
const THIS_WEEK = "2026-11-23";
const MONDAYS = Array.from({ length: 12 }, (_, i) => addDays(THIS_WEEK, -7 * (11 - i)));
const weeks = (counts: Record<number, Partial<KindCounts>> = {}) => MONDAYS.map((m, i) => week(m, counts[i]));

const ALL_KINDS = chartKinds(INSIGHT_KINDS);
const OWNER: SectionSettings = { sections: OWNER_SECTIONS, scalerUnlocked: true };

describe("words", () => {
  it("pluralises and joins lists with 'and'", () => {
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(0, "day")).toBe("0 days");
    expect(plural(3, "active day")).toBe("3 active days");
    expect(andList([])).toBe("");
    expect(andList(["A"])).toBe("A");
    expect(andList(["A", "B"])).toBe("A and B");
    expect(andList(["A", "B", "C"])).toBe("A, B and C");
  });

  it("names the week in the header", () => {
    expect(weekRangeText("2026-11-23")).toBe("Mon 23 Nov – Sun 29 Nov");
    expect(weekRangeText("2026-12-28")).toBe("Mon 28 Dec – Sun 3 Jan");
  });
});

describe("chart kinds (spec 10, Kinds)", () => {
  it("lists every kind for the owner, in stack order, with projects and career as one", () => {
    expect(ALL_KINDS.map((k) => k.key)).toEqual(CHART_KINDS);
    expect(ALL_KINDS.map((k) => k.label)).toEqual([
      "Roadmap tasks",
      "Learning resources",
      "Reading",
      "Scaler classes",
      "Certification prep",
      "Courses",
      "Projects and career",
    ]);
    expect(ALL_KINDS.find((k) => k.key === "scaler")?.lower).toBe("Scaler classes");
    expect(ALL_KINDS[0].lower).toBe("roadmap tasks");
  });

  it("names the seventh kind after whichever of Projects and Career is shown", () => {
    const without = (...drop: InsightKind[]) => chartKinds(INSIGHT_KINDS.filter((k) => !drop.includes(k)));
    expect(without("career").at(-1)?.label).toBe("Projects");
    expect(without("projects").at(-1)?.label).toBe("Career");
    expect(without("projects", "career").map((k) => k.key)).not.toContain("projects");
  });

  it("leaves hidden kinds out", () => {
    expect(chartKinds(["roadmap", "resources", "reading", "certs", "courses"]).map((k) => k.key)).toEqual(["roadmap", "resources", "reading", "certs", "courses"]);
  });

  it("adds projects and career together", () => {
    expect(chartCounts({ ...zero(), projects: 2, career: 3, roadmap: 1 })).toEqual({ roadmap: 1, resources: 0, reading: 0, scaler: 0, certs: 0, courses: 0, projects: 5 });
  });

  it("puts only kinds with a completion in the key, in stack order", () => {
    const w = weeks({ 3: { courses: 1 }, 11: { roadmap: 2, career: 1 } });
    expect(keyKinds(w, ALL_KINDS).map((k) => k.key)).toEqual(["roadmap", "courses", "projects"]);
    expect(hasWeeklyCompletions(w)).toBe(true);
    expect(hasWeeklyCompletions(weeks())).toBe(false);
  });
});

describe("the weekly bar chart (spec 10.4)", () => {
  it("scales to the busiest week, never below 5", () => {
    expect(scaleMax(weeks())).toBe(5);
    expect(scaleMax(weeks({ 2: { roadmap: 3 } }))).toBe(5);
    expect(scaleMax(weeks({ 2: { roadmap: 6, reading: 3 } }))).toBe(9);
  });

  it("stacks segments from the baseline in kind order, with 2 px gaps and the total's room on top", () => {
    const H = PLOT_HEIGHTS.wide;
    const usable = H - TOTALS_ROOM;
    const bars = barLayout(weeks({ 11: { reading: 5, roadmap: 5 } }), ALL_KINDS, H, THIS_WEEK);
    const bar = bars[11];
    expect(bar.current).toBe(true);
    expect(bars.filter((b) => b.current)).toHaveLength(1);
    expect(bar.total).toBe(10);
    // The busiest week fills the usable height exactly.
    expect(bar.height).toBe(usable);
    const [bottom, top] = bar.segments;
    expect(bottom.kind).toBe("roadmap");
    expect(top.kind).toBe("reading");
    // Bottom segment sits on the baseline; the gap is between the two.
    expect(bottom.y + bottom.height).toBe(H);
    expect(bottom.y - (top.y + top.height)).toBe(SEGMENT_GAP);
    expect(top.y).toBe(H - usable);
  });

  it("keeps one item visible and draws nothing for an empty week", () => {
    const bars = barLayout(weeks({ 0: { roadmap: 1, resources: 1 }, 5: {} }), ALL_KINDS, PLOT_HEIGHTS.phone, THIS_WEEK);
    expect(bars[5].segments).toEqual([]);
    expect(bars[5].height).toBe(0);
    for (const s of bars[0].segments) expect(s.height).toBeGreaterThanOrEqual(MIN_SEGMENT);
    // A tiny share of a large scale still gets its minimum.
    const busy = barLayout(weeks({ 0: { roadmap: 200, courses: 1 } }), ALL_KINDS, PLOT_HEIGHTS.phone, THIS_WEEK)[0];
    expect(busy.segments.find((s) => s.kind === "courses")?.height).toBe(MIN_SEGMENT);
  });

  it("labels each Monday's day, and the month where it changes", () => {
    const labels = weekLabels(MONDAYS);
    expect(MONDAYS[0]).toBe("2026-09-07");
    expect(labels.map((l) => l.day)).toEqual(["7", "14", "21", "28", "5", "12", "19", "26", "2", "9", "16", "23"]);
    expect(labels.map((l) => l.month)).toEqual(["Sep", null, null, null, "Oct", null, null, null, "Nov", null, null, null]);
  });

  it("drops the first column's month when the second already has one", () => {
    const labels = weekLabels(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(labels.map((l) => l.month)).toEqual([null, "Oct", null]);
  });

  it("summarises the chart in one sentence", () => {
    const w = weeks({ 2: { roadmap: 4, resources: 5 }, 6: { roadmap: 9 }, 10: { courses: 7 }, 11: { roadmap: 5 } });
    expect(weeklySummary(w, keyKinds(w, ALL_KINDS), THIS_WEEK)).toBe(
      "Over the last 12 weeks you marked 30 items done. This week so far: 5; last week: 7. Busiest week: week of Mon 19 Oct, with 9. Most were roadmap tasks (18).",
    );
  });

  it("gives ties for the busiest week to the most recent, and drops 'Most were' with one kind", () => {
    const w = weeks({ 1: { roadmap: 1 }, 4: { roadmap: 1 } });
    expect(weeklySummary(w, keyKinds(w, ALL_KINDS), THIS_WEEK)).toBe(
      "Over the last 12 weeks you marked 2 items done. This week so far: 0; last week: 0. Busiest week: week of Mon 5 Oct, with 1.",
    );
    const one = weeks({ 11: { reading: 1 } });
    expect(weeklySummary(one, keyKinds(one, ALL_KINDS), THIS_WEEK)).toContain("you marked 1 item done.");
  });

  it("gives table rows newest first, with the kinds that week in stack order", () => {
    const rows = weeklyRows(weeks({ 11: { resources: 3, roadmap: 2 }, 10: {} }), ALL_KINDS, THIS_WEEK);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ weekStart: THIS_WEEK, label: "23 Nov", current: true, total: 5, byKind: "Roadmap tasks 2 · Learning resources 3" });
    expect(rows[1]).toMatchObject({ label: "16 Nov", current: false, total: 0, byKind: null });
    expect(rows.at(-1)?.weekStart).toBe(MONDAYS[0]);
  });
});

describe("the activity calendar (spec 10.4)", () => {
  it("steps saves per day at fixed thresholds", () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 40].map(heatStep)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  const START = "2026-06-01"; // a Monday
  const TODAY = "2026-11-26"; // Thursday of the 26th week
  const days: ActivityDay[] = [];
  for (let d = START; d <= TODAY; d = addDays(d, 1)) days.push({ date: d, count: 0, estimated: true });
  const withCounts = (counts: Record<string, number>) => days.map((d) => ({ ...d, count: counts[d.date] ?? 0 }));

  it("places days in week columns, Monday at the top, and marks today", () => {
    const cells = heatCells(withCounts({ [TODAY]: 3 }), START, TODAY);
    expect(cells).toHaveLength(179);
    expect(cells[0]).toMatchObject({ date: START, col: 0, row: 0, today: false });
    expect(cells.at(-1)).toMatchObject({ date: TODAY, col: 25, row: 3, step: 2, today: true });
  });

  it("puts each month on the column holding its 1st, the first column's only when there is room", () => {
    // 1 Jun is the first day, so June sits on column 0.
    expect(monthLabels(days, START).map((m) => `${m.label}@${m.col}`)).toEqual(["Jun@0", "Jul@4", "Aug@8", "Sep@13", "Oct@17", "Nov@21"]);
    // Starting Mon 25 May: 1 Jun is in column 1, too close for "May" on column 0.
    const early = [{ date: "2026-05-25", count: 0, estimated: true }, ...days.slice(0, 20)].map((d, i) => ({ ...d, date: addDays("2026-05-25", i) }));
    expect(monthLabels(early, "2026-05-25")[0]).toEqual({ col: 1, label: "Jun" });
    // Starting Mon 8 Jun: the next 1st (1 Jul) is 3 columns away, so June gets column 0.
    const later = days.slice(7, 40);
    expect(monthLabels(later, "2026-06-08").slice(0, 2)).toEqual([
      { col: 0, label: "Jun" },
      { col: 3, label: "Jul" },
    ]);
  });

  it("summarises the calendar, ties going to the most recent day", () => {
    const counts = withCounts({ "2026-11-02": 14, "2026-11-20": 14, "2026-11-25": 1 });
    expect(activitySummary(counts, 3, TODAY)).toBe(
      "3 of the last 179 days were active. Last 30 days: 3 active days. Busiest day: Fri 20 Nov, with 14 saves. Today: no saves yet.",
    );
    expect(activitySummary(withCounts({ [TODAY]: 1 }), 1, TODAY)).toBe(
      "1 of the last 179 days were active. Last 30 days: 1 active day. Busiest day: Thu 26 Nov, with 1 save. Today: 1 save so far.",
    );
  });

  it("gives one table row per week, newest first", () => {
    const rows = activityRows(withCounts({ "2026-11-23": 3, "2026-11-25": 1, "2026-11-28": 5 }), START, TODAY);
    expect(rows).toHaveLength(26);
    expect(rows[0]).toEqual({ weekStart: "2026-11-23", label: "23 Nov", current: true, activeDays: 2, savesByDay: "Mon 3 · Wed 1" });
    expect(rows[1]).toMatchObject({ weekStart: "2026-11-16", current: false, activeDays: 0, savesByDay: null });
    expect(rows.at(-1)?.weekStart).toBe(START);
  });
});

describe("at a glance (spec 10.2 A)", () => {
  it("reads the week, the streaks and their hints", () => {
    const [w, current, longest] = glanceTiles({ weekStart: THIS_WEEK, done: 5, lastWeek: 7, currentStreak: 3, longestStreak: 1 });
    expect(w).toEqual({ value: "5", label: "done this week · 7 last week", sr: "5 items done this week, 7 last week" });
    expect(current).toEqual({ value: "3", label: "weeks in your current streak", hint: undefined });
    expect(longest).toEqual({ value: "1", label: "week in your longest streak" });
    expect(glanceTiles({ weekStart: THIS_WEEK, done: 0, lastWeek: 2, currentStreak: 1, longestStreak: 4 })[1]).toEqual({
      value: "1",
      label: "week in your current streak",
      hint: "Mark something done this week to keep it going.",
    });
    expect(glanceTiles({ weekStart: THIS_WEEK, done: 0, lastWeek: 0, currentStreak: 0, longestStreak: 0 })[1].hint).toBe("Mark something done this week to start one.");
    expect(glanceTiles({ weekStart: THIS_WEEK, done: 1, lastWeek: 0, currentStreak: 1, longestStreak: 1 })[0].sr).toBe("1 item done this week, 0 last week");
  });

  it("lists the sections a person switched off, never a locked Scaler", () => {
    expect(hiddenSectionsLine(OWNER)).toBeNull();
    // New users: Scaler locked, Projects and Career off by default.
    expect(hiddenSectionsLine({ sections: DEFAULT_SECTIONS, scalerUnlocked: false })).toEqual({
      text: "Hidden sections aren't counted here: Projects and Career.",
      link: "Show them in Settings",
    });
    expect(hiddenSectionsLine({ sections: { ...OWNER_SECTIONS, scaler: false, projects: false }, scalerUnlocked: true })).toEqual({
      text: "Hidden sections aren't counted here: Scaler course and Projects.",
      link: "Show them in Settings",
    });
    expect(hiddenSectionsLine({ sections: { ...OWNER_SECTIONS, reading: false }, scalerUnlocked: true })?.link).toBe("Show it in Settings");
  });

  it("words Home's line", () => {
    expect(homeStreakText(3)).toBe("3-week streak");
    expect(homeStreakText(1)).toBe("1-week streak");
    expect(homeStreakText(0)).toBe("no streak yet");
  });
});

describe("current phase (spec 10.2 D)", () => {
  const phase = (p: Partial<PhaseInsight>): PhaseInsight => ({
    n: 2,
    title: "Phase two",
    start: "2026-12-02",
    end: "2026-12-15",
    inDates: true,
    done: 3,
    total: 9,
    daysLeft: 6,
    recentCompletions: 6,
    projection: { status: "not-enough-activity" },
    ...p,
  });

  it("says when the phase ends", () => {
    expect(phaseEndsText(phase({}))).toBe("Tue 15 Dec · 6 days left");
    expect(phaseEndsText(phase({ daysLeft: 1 }))).toBe("Tue 15 Dec · 1 day left");
    expect(phaseEndsText(phase({ daysLeft: 0 }))).toBe("Tue 15 Dec · last day");
  });

  it("words the projection against the phase's end", () => {
    const projected = (finish: string) => phase({ projection: { status: "projected", finish, daysNeeded: 1, perWeek: 1.5, onTrack: finish <= "2026-12-15" } });
    expect(projectionText(projected("2026-12-12"))).toBe("Sat 12 Dec · 3 days before it ends");
    expect(projectionText(projected("2026-12-14"))).toBe("Mon 14 Dec · 1 day before it ends");
    expect(projectionText(projected("2026-12-15"))).toBe("Tue 15 Dec · on its last day");
    expect(projectionText(projected("2026-12-18"))).toBe("Fri 18 Dec · 3 days after it ends");
    expect(projectionText(phase({}))).toBe("Not enough recent activity");
    expect(projectionText(phase({ projection: { status: "complete" } }))).toBeNull();
  });

  it("explains the pace, or how to get a projection", () => {
    expect(paceLine(phase({ projection: { status: "projected", finish: "2026-12-12", daysNeeded: 16, perWeek: 1.5, onTrack: true } }))).toBe(
      "At your pace over the last 4 weeks: 6 roadmap tasks done.",
    );
    expect(paceLine(phase({}))).toBe("Mark at least 2 roadmap tasks done within 4 weeks to see a projected finish.");
    expect(paceLine(phase({ projection: { status: "complete" } }))).toBe("All tasks in this phase are done.");
  });

  it("says when today is before or after the roadmap", () => {
    const phases = trackerContent.phases;
    expect(outsideRoadmap(addDays(phases[0].start, -1))?.text).toMatch(/^The roadmap starts on \d+ \w{3} \d{4}\.$/);
    expect(outsideRoadmap(addDays(phases[phases.length - 1].end, 1))?.text).toMatch(/^The roadmap's last phase ended on \d+ \w{3} \d{4}\.$/);
    expect(outsideRoadmap(phases[0].start)).toBeNull();
  });
});

describe("this month and certifications (spec 10.2 E and F)", () => {
  it("words the month's numbers and lines", () => {
    expect(monthText({ monthStart: "2026-11-01", notesSaved: 0, resourcesDone: 0 })).toEqual({
      since: "Since 1 Nov",
      notesLabel: "items with a note saved",
      resourcesLabel: "learning resources finished",
      historyLine: "Notes are counted from 26 Nov 2026, when the app started recording them.",
      emptyLine: "Notes you save and learning resources you finish this month will show here.",
    });
    expect(monthText({ monthStart: "2026-12-01", notesSaved: 1, resourcesDone: 1 })).toEqual({
      since: "Since 1 Dec",
      notesLabel: "item with a note saved",
      resourcesLabel: "learning resource finished",
      historyLine: null,
      emptyLine: null,
    });
  });

  const cert = (c: Partial<CertInsight>): CertInsight => ({ index: 0, name: "Cert", dateText: "December 2026", targetDate: "2026-12-31", daysLeft: 35, done: 1, total: 3, passed: false, ...c });

  it("adds days left only with a target date, and never once passed", () => {
    expect(certLine(cert({}))).toBe("December 2026 · 35 days left");
    expect(certLine(cert({ daysLeft: 1 }))).toBe("December 2026 · 1 day left");
    expect(certLine(cert({ daysLeft: 0 }))).toBe("December 2026 · today");
    expect(certLine(cert({ daysLeft: -4 }))).toBe("December 2026 · date passed");
    expect(certLine(cert({ dateText: "After joining a partner company", targetDate: null, daysLeft: null }))).toBe("After joining a partner company");
    expect(certLine(cert({ passed: true, done: 3 }))).toBe("December 2026");
    expect(passedCount([cert({ passed: true }), cert({}), cert({ passed: true })])).toBe(2);
  });
});

describe("Home's line uses the Insights page's numbers", () => {
  // Thursday 26 Nov 2026, 10:00 IST. This week starts Mon 23 Nov.
  const NOW = Date.parse("2026-11-26T04:30:00Z");
  const rec = (doneAt: string | null, done = true): ProgressRecord => ({ done, note: "", link: "", doneAt, updatedAt: doneAt });
  const progress = new Map<string, ProgressRecord>([
    ["l1-1", rec("2026-11-24T05:00:00Z")],
    ["pp1", rec("2026-11-25T05:00:00Z")],
    ["p1-1", rec("2026-11-25T06:00:00Z")], // Projects: hidden for new users
    ["l1-2", rec("2026-11-17T05:00:00Z")],
    ["l1-3", rec("2026-11-10T05:00:00Z")],
    ["l1-4", rec("2026-11-25T05:00:00Z", false)], // unticked: never counts
    ["zz9-9", rec("2026-11-25T05:00:00Z")], // not an item the content knows
  ]);

  it("matches computeInsights for the same rows", () => {
    const settings: SectionSettings = { sections: DEFAULT_SECTIONS, scalerUnlocked: false };
    const glance = weekGlance(progress, settings, NOW);
    const rows = [...progress].map(([itemId, r]) => ({ itemId, done: r.done, doneAt: r.doneAt }));
    const page = computeInsights({ nowMs: NOW, progress: rows, events: [], settings, content: trackerContent, courses: [] });
    expect(glance).toEqual(page.thisWeek);
    expect(glance).toEqual({ weekStart: "2026-11-23", done: 2, lastWeek: 1, currentStreak: 3, longestStreak: 3 });
  });

  it("counts a section's items once it is shown", () => {
    expect(weekGlance(progress, OWNER, NOW).done).toBe(3);
  });
});
