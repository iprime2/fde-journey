// Insights (M5a): the IST week model and the pure numbers in lib/insights.ts. All content and
// progress here is made up.
import { describe, expect, it } from "vitest";
import { COURSES } from "@/content/courses";
import { trackerContent } from "@/content/tracker-data";
import type { Course, TrackerContent } from "@/content/types";
import { OWNER_SECTIONS, type SectionChoices } from "@/lib/access-types";
import { addDays, istDate, istDayStartMs, istMonth, istWeekStart, weekStartOf } from "@/lib/dates";
import { itemKind, listItems } from "@/lib/ids";
import {
  ACTIVITY_WEEKS,
  EVENT_HISTORY_START,
  INSIGHT_KINDS,
  type InsightEvent,
  type InsightProgressRow,
  type InsightsInput,
  activityWindowStart,
  activityWindowStartDay,
  computeInsights,
  shownKinds,
  targetDateOf,
  weeklyStreaks,
} from "@/lib/insights";
import { type SectionSettings, effectiveSections } from "@/lib/sections";

const at = (isoUtc: string) => Date.parse(isoUtc);
/** An instant at the given IST wall-clock time ("2026-12-03", "10:00"). */
const ist = (day: string, time = "10:00") => new Date(at(`${day}T${time}:00+05:30`)).toISOString();

// ---- Made-up content: small, so every number below can be checked by hand.
const CONTENT: TrackerContent = {
  phases: [
    { n: 1, title: "Phase one", start: "2026-11-24", end: "2026-12-14", tasks: [["T1", "x"], ["T2", "x"], ["T3", "x"], ["T4", "x"], ["T5", "x"]] },
    { n: 2, title: "Phase two", start: "2026-12-15", end: "2026-12-31", tasks: [["U1", "x"], ["U2", "x"]] },
  ],
  certs: [
    { name: "Cert A", rank: 2, priority: "Second", date: "December 2026", desc: "", status: "", tasks: ["a1", "a2", "a3"] },
    { name: "Cert B", rank: 1, priority: "First", date: "After something else happens", desc: "", status: "", tasks: ["b1", "b2"] },
  ],
  projects: [{ name: "Project", subtitle: "", desc: "", tasks: ["p1", "p2"] }],
  career: [
    { title: "Career one", date: "", desc: "" },
    { title: "Career two", date: "", desc: "" },
  ],
  scaler: [{ n: 1, title: "Module", sub: "", months: 1, kind: "core", classes: ["s1", "s2", "s3"] }],
  resources: {
    "l1-1": {
      start: "",
      items: [1, 2, 3].map((i) => ({ title: `R${i}`, url: "https://example.com/r", by: "", type: "video" as const, length: "", level: "beginner" as const, why: "" })),
    },
  },
  papers: [
    { week: "2026-11-30", core: true, title: "Paper 1", url: "https://example.com/p", by: "", why: "" },
    { week: "2026-12-07", core: true, title: "Paper 2", url: "https://example.com/p", by: "", why: "" },
  ],
  books: [{ core: true, title: "Book 1", by: "", url: "https://example.com/b", why: "" }],
};
const COURSE_LIST: Course[] = [
  { provider: "Anthropic", title: "Course 1", url: "https://example.com/c1", length: "", badge: false, phase: 1 },
  { provider: "OpenAI", title: "Course 2", url: "https://example.com/c2", length: "", badge: true, phase: 1 },
];

/** Thursday 3 Dec 2026, 10:00 IST. This week starts Mon 30 Nov; last week Mon 23 Nov. */
const NOW = at("2026-12-03T04:30:00Z");
const THIS_WEEK = "2026-11-30";
const LAST_WEEK = "2026-11-23";

const ALL: SectionSettings = { sections: OWNER_SECTIONS, scalerUnlocked: true };
const done = (itemId: string, doneAt: string | null): InsightProgressRow => ({ itemId, done: true, doneAt });
const ev = (itemId: string, kind: InsightEvent["kind"], when: string): InsightEvent => ({ itemId, kind, at: when });

function run(partial: Partial<InsightsInput> = {}) {
  return computeInsights({ nowMs: NOW, progress: [], events: [], settings: ALL, content: CONTENT, courses: COURSE_LIST, ...partial });
}

describe("the IST week model (lib/dates.ts)", () => {
  it("a week starts Monday 00:00 IST, which is Sunday 18:30 UTC", () => {
    expect(istWeekStart(at("2026-11-29T18:29:59.999Z"))).toBe("2026-11-23");
    expect(istWeekStart(at("2026-11-29T18:30:00.000Z"))).toBe("2026-11-30");
    expect(istDayStartMs("2026-11-30")).toBe(at("2026-11-29T18:30:00Z"));
    // Sunday evening in UTC is already Monday in India.
    expect(istDate(at("2026-11-29T20:00:00Z"))).toBe("2026-11-30");
  });

  it("every day of a week maps to its Monday, across a year boundary too", () => {
    for (let i = 0; i < 7; i++) expect(weekStartOf(addDays("2026-11-30", i))).toBe("2026-11-30");
    expect(weekStartOf("2026-12-06")).toBe("2026-11-30");
    expect(weekStartOf("2026-12-07")).toBe("2026-12-07");
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
    expect(weekStartOf("2027-01-03")).toBe("2026-12-28");
  });

  it("a month starts at 00:00 IST on the 1st, 18:30 UTC the day before", () => {
    expect(istMonth(at("2026-11-30T18:29:59.999Z"))).toBe("2026-11");
    expect(istMonth(at("2026-11-30T18:30:00.000Z"))).toBe("2026-12");
    expect(istMonth(at("2026-12-31T18:30:00.000Z"))).toBe("2027-01");
  });
});

describe("classifying ids by kind (lib/ids.ts itemKind)", () => {
  it("never takes a course (cr) for a certification step (c), or a paper (pp) for a project (p)", () => {
    expect(itemKind("cr1")).toBe("courses");
    expect(itemKind("cr12")).toBe("courses");
    expect(itemKind("c1-1")).toBe("certs");
    expect(itemKind("c12-3")).toBe("certs");
    expect(itemKind("pp3")).toBe("reading");
    expect(itemKind("bk2")).toBe("reading");
    expect(itemKind("p1-2")).toBe("projects");
    expect(itemKind("l3-4")).toBe("roadmap");
    expect(itemKind("r1-1-3")).toBe("resources");
    expect(itemKind("s2-4")).toBe("scaler");
    expect(itemKind("k7")).toBe("career");
  });

  it("returns null for the journal and anything malformed", () => {
    for (const id of ["journal", "", "cr", "c1", "cr1-1", "l1", "x1-1", "k0", "pp", "L1-1", " l1-1"]) expect(itemKind(id)).toBeNull();
  });

  it("agrees with the content's own grouping for every real id", () => {
    const expected = { roadmap: "roadmap", cert: "certs", project: "projects", career: "career", scaler: "scaler", resource: "resources", paper: "reading", book: "reading", course: "courses" } as const;
    const items = listItems(trackerContent, COURSES);
    expect(items.length).toBeGreaterThan(100);
    for (const item of items) expect([item.id, itemKind(item.id)]).toEqual([item.id, expected[item.group]]);
  });
});

describe("this week and streaks", () => {
  it("counts this week's and last week's completions, split exactly at Monday 00:00 IST", () => {
    const i = run({
      progress: [
        done("l1-1", "2026-11-29T18:29:59.999Z"), // Sunday 23:59 IST: last week
        done("l1-2", "2026-11-29T18:30:00.000Z"), // Monday 00:00 IST: this week
        done("l1-3", ist("2026-12-03")),
        done("l1-4", ist("2026-11-23", "00:00")),
      ],
    });
    expect(i.thisWeek).toEqual({ weekStart: THIS_WEEK, done: 2, lastWeek: 2, currentStreak: 2, longestStreak: 2 });
    expect(i.weekly.at(-1)).toMatchObject({ weekStart: THIS_WEEK, total: 2 });
    expect(i.weekly.at(-2)).toMatchObject({ weekStart: LAST_WEEK, total: 2 });
  });

  it("an empty current week doesn't break a streak that ran up to last week", () => {
    expect(weeklyStreaks(new Set([LAST_WEEK, "2026-11-16", "2026-11-09"]), THIS_WEEK)).toEqual({ current: 3, longest: 3 });
  });

  it("the current week counts once it has a completion", () => {
    expect(weeklyStreaks(new Set([THIS_WEEK]), THIS_WEEK)).toEqual({ current: 1, longest: 1 });
    expect(weeklyStreaks(new Set([THIS_WEEK, LAST_WEEK]), THIS_WEEK)).toEqual({ current: 2, longest: 2 });
  });

  it("a missed week ends the streak; the longest one is kept", () => {
    // Nothing this week or last week: the run three and four weeks ago is over.
    expect(weeklyStreaks(new Set(["2026-11-16", "2026-11-09"]), THIS_WEEK)).toEqual({ current: 0, longest: 2 });
    // A gap: this week, then two weeks ago.
    expect(weeklyStreaks(new Set([THIS_WEEK, "2026-11-16"]), THIS_WEEK)).toEqual({ current: 1, longest: 1 });
    // An older, longer run.
    const old = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"];
    expect(weeklyStreaks(new Set([...old, LAST_WEEK]), THIS_WEEK)).toEqual({ current: 1, longest: 4 });
  });

  it("streaks run across a year boundary and ignore weeks after this one", () => {
    expect(weeklyStreaks(new Set(["2026-12-21", "2026-12-28", "2027-01-04"]), "2027-01-04")).toEqual({ current: 3, longest: 3 });
    expect(weeklyStreaks(new Set(["2026-12-07", "2026-12-14"]), THIS_WEEK)).toEqual({ current: 0, longest: 0 });
  });

  it("several completions in one week count as one streak week", () => {
    const i = run({ progress: [done("l1-1", ist("2026-12-01")), done("l1-2", ist("2026-12-02")), done("pp1", ist("2026-11-24"))] });
    expect(i.thisWeek).toMatchObject({ done: 2, lastWeek: 1, currentStreak: 2, longestStreak: 2 });
  });
});

describe("completions per week", () => {
  it("covers the last 12 weeks, oldest first, split by kind (courses never counted as certifications)", () => {
    const i = run({
      progress: [
        done("l1-1", ist("2026-12-01")),
        done("r1-1-1", ist("2026-12-01")),
        done("pp1", ist("2026-12-01")),
        done("bk1", ist("2026-12-02")),
        done("s1-1", ist("2026-12-02")),
        done("c1-1", ist("2026-12-02")),
        done("cr1", ist("2026-12-02")),
        done("cr2", ist("2026-12-02")),
        done("p1-1", ist("2026-12-03")),
        done("k1", ist("2026-12-03")),
        done("l1-2", ist("2026-09-14")), // week 12: still in the chart
        done("l1-3", ist("2026-09-13")), // week 13: in no bar
      ],
    });
    expect(i.weekly).toHaveLength(12);
    expect(i.weekly[0].weekStart).toBe("2026-09-14");
    expect(i.weekly.map((w) => w.weekStart)).toEqual(Array.from({ length: 12 }, (_, k) => addDays("2026-09-14", 7 * k)));
    expect(i.weekly[0].byKind.roadmap).toBe(1);
    expect(i.weekly.at(-1)).toEqual({
      weekStart: THIS_WEEK,
      total: 10,
      byKind: { roadmap: 1, resources: 1, reading: 2, scaler: 1, certs: 1, courses: 2, projects: 1, career: 1 },
    });
    expect(i.kinds).toEqual([...INSIGHT_KINDS]);
    // The week-13 completion is in no bar but still counts towards streaks: weeks 13 and 12 in a row.
    expect(i.thisWeek.longestStreak).toBe(2);
    expect(i.thisWeek.currentStreak).toBe(1);
  });

  it("counts only items done now: a tick followed by an untick doesn't count", () => {
    const i = run({
      progress: [{ itemId: "l1-1", done: false, doneAt: null }, done("l1-2", ist("2026-12-01"))],
      events: [ev("l1-1", "done", ist("2026-12-01", "09:00")), ev("l1-1", "undone", ist("2026-12-01", "09:05")), ev("l1-2", "done", ist("2026-12-01"))],
    });
    expect(i.thisWeek.done).toBe(1);
    expect(i.weekly.at(-1)?.byKind.roadmap).toBe(1);
    // The untick was still a save: the day was active.
    expect(i.activity.days.find((d) => d.date === "2026-12-01")?.count).toBe(3);
  });

  it("leaves out items done without a date, dated after today, or unknown to the content", () => {
    const i = run({ progress: [done("l1-1", null), done("l1-2", ist("2026-12-04")), done("l9-9", ist("2026-12-01")), done("cr99", ist("2026-12-01"))] });
    expect(i.thisWeek.done).toBe(0);
    expect(i.hasCompletions).toBe(false);
    // The undated item still counts as done for the phase.
    expect(i.phase.done).toBe(2);
  });
});

describe("hidden and locked sections", () => {
  const progress = [
    done("l1-1", ist("2026-12-01")),
    done("pp1", ist("2026-12-01")),
    done("s1-1", ist("2026-12-01")),
    done("c1-1", ist("2026-12-01")),
    done("cr1", ist("2026-12-01")),
    done("p1-1", ist("2026-12-01")),
    done("k1", ist("2026-12-01")),
  ];
  const events = progress.map((p) => ev(p.itemId, "done", p.doneAt!)).concat([ev("p1-1", "note", ist("2026-12-02")), ev("journal", "note", ist("2026-12-02"))]);

  it("a new user's defaults: Reading and Certifications shown; Scaler, Projects and Career left out everywhere", () => {
    const settings = effectiveSections(null, false);
    const i = run({ progress, events, settings });
    expect(i.kinds).toEqual(["roadmap", "resources", "reading", "certs", "courses"]);
    expect(i.weekly.at(-1)).toMatchObject({ total: 4, byKind: { roadmap: 1, reading: 1, certs: 1, courses: 1, scaler: 0, projects: 0, career: 0 } });
    expect(i.thisWeek.done).toBe(4);
    // Activity and notes leave them out too; the weekly notes always count.
    expect(i.activity.days.find((d) => d.date === "2026-12-01")?.count).toBe(4);
    expect(i.activity.days.find((d) => d.date === "2026-12-02")?.count).toBe(1);
    expect(i.thisMonth.notesSaved).toBe(1);
    expect(i.certs.map((c) => c.name)).toEqual(["Cert B", "Cert A"]);
  });

  it("Scaler switched on but not unlocked is still left out", () => {
    const stored = { reading: true, scaler: true, certs: true, projects: true, career: true, scalerUnlockedAt: null };
    expect(shownKinds(effectiveSections(stored, false))).not.toContain("scaler");
    // Even if a caller passed the raw choice, the lock wins.
    expect(shownKinds({ sections: OWNER_SECTIONS, scalerUnlocked: false })).not.toContain("scaler");
    const i = run({ progress, events, settings: { sections: OWNER_SECTIONS, scalerUnlocked: false } });
    expect(i.weekly.at(-1)?.byKind.scaler).toBe(0);
    expect(i.thisWeek.done).toBe(6);
  });

  it("Scaler unlocked but switched off is left out; unlocked and on is counted", () => {
    const off: SectionChoices = { ...OWNER_SECTIONS, scaler: false };
    expect(shownKinds({ sections: off, scalerUnlocked: true })).not.toContain("scaler");
    expect(run({ progress, settings: { sections: OWNER_SECTIONS, scalerUnlocked: true } }).weekly.at(-1)?.byKind.scaler).toBe(1);
  });

  it("hidden Certifications: no certification cards and no cert prep in the charts; courses still count", () => {
    const i = run({ progress, events, settings: { sections: { ...OWNER_SECTIONS, certs: false }, scalerUnlocked: true } });
    expect(i.certs).toEqual([]);
    expect(i.kinds).not.toContain("certs");
    expect(i.weekly.at(-1)?.byKind).toMatchObject({ certs: 0, courses: 1 });
  });

  it("roadmap and courses have no switch and always show", () => {
    const none: SectionChoices = { roadmap: true, reading: false, scaler: false, certs: false, projects: false, career: false };
    expect(shownKinds({ sections: none, scalerUnlocked: false })).toEqual(["roadmap", "resources", "courses"]);
  });
});

describe("active days", () => {
  it("covers 26 whole weeks, from a Monday to today, and starts the event query at 00:00 IST that Monday", () => {
    const i = run();
    expect(ACTIVITY_WEEKS).toBe(26);
    expect(i.activity.windowStart).toBe("2026-06-08");
    expect(activityWindowStartDay(NOW)).toBe("2026-06-08");
    expect(activityWindowStart(NOW).toISOString()).toBe("2026-06-07T18:30:00.000Z");
    expect(i.activity.days[0].date).toBe("2026-06-08");
    expect(i.activity.days.at(-1)?.date).toBe("2026-12-03");
    expect(i.activity.days).toHaveLength(25 * 7 + 4);
  });

  it("counts every save per IST day, any kind, and the days with one in the last 30", () => {
    const i = run({
      events: [
        ev("l1-1", "done", "2026-12-02T18:29:59Z"), // 2 Dec, 23:59 IST
        ev("l1-1", "note", "2026-12-02T18:30:00Z"), // 3 Dec, 00:00 IST
        ev("l1-1", "link", ist("2026-12-03")),
        ev("journal", "note", ist("2026-11-04")), // today − 29: in the 30 days
        ev("l1-2", "done", ist("2026-11-03")), // today − 30: not
        ev("l1-3", "done", ist("2026-06-07", "23:59")), // before the window
        ev("x9", "note", ist("2026-12-01")), // not an item
      ],
    });
    const count = (date: string) => i.activity.days.find((d) => d.date === date)?.count;
    expect(count("2026-12-02")).toBe(1);
    expect(count("2026-12-03")).toBe(2);
    expect(count("2026-12-01")).toBe(0);
    expect(count("2026-11-03")).toBe(1);
    expect(i.activity.activeDays30).toBe(3);
    expect(i.activity.days.reduce((n, d) => n + d.count, 0)).toBe(5);
    expect(i.activity.hasActivity).toBe(true);
  });

  it("before the event history, a done_at completion counts as one save, marked as estimated", () => {
    expect(EVENT_HISTORY_START).toBe("2026-11-26");
    const i = run({ progress: [done("l1-1", ist("2026-11-25", "23:59")), done("l1-2", ist("2026-11-26", "00:00"))] });
    const day = (date: string) => i.activity.days.find((d) => d.date === date);
    expect(day("2026-11-25")).toEqual({ date: "2026-11-25", count: 1, estimated: true });
    // From the release on, only events count (this tick has none).
    expect(day("2026-11-26")).toEqual({ date: "2026-11-26", count: 0, estimated: false });
    expect(i.activity.reachesBeforeHistory).toBe(true);
  });

  it("once the window starts after the release, nothing is estimated", () => {
    const later = at("2027-07-01T04:30:00Z");
    const i = run({ nowMs: later });
    expect(i.activity.windowStart > EVENT_HISTORY_START).toBe(true);
    expect(i.activity.reachesBeforeHistory).toBe(false);
    expect(i.activity.days.some((d) => d.estimated)).toBe(false);
  });
});

describe("current phase and projection", () => {
  it("picks the phase whose dates include today, with done, total and days left", () => {
    const i = run({ progress: [done("l1-1", null), done("l2-1", ist("2026-12-01"))] });
    expect(i.phase).toMatchObject({ n: 1, title: "Phase one", start: "2026-11-24", end: "2026-12-14", inDates: true, done: 1, total: 5, daysLeft: 11 });
    expect(run({ nowMs: at("2026-12-14T12:00:00Z") }).phase).toMatchObject({ n: 1, daysLeft: 0 });
  });

  it("falls back as Home does when today is in no phase", () => {
    const after = run({ nowMs: at("2027-01-10T04:30:00Z") });
    expect(after.phase).toMatchObject({ n: 1, inDates: false, daysLeft: -27 });
  });

  it("needs at least 2 of the phase's completions in the last 28 days to project", () => {
    const one = run({ progress: [done("l1-1", ist("2026-12-01"))] });
    expect(one.phase.recentCompletions).toBe(1);
    expect(one.phase.projection).toEqual({ status: "not-enough-activity" });
    // Day 29 back (today − 28) is outside the window; day 28 back (today − 27) is inside.
    const edge = run({ progress: [done("l1-1", ist("2026-11-05")), done("l1-2", ist("2026-11-06", "00:00"))] });
    expect(edge.phase.recentCompletions).toBe(1);
    expect(edge.phase.projection.status).toBe("not-enough-activity");
  });

  it("projects the finish at the recent pace", () => {
    // 2 done in 28 days; 3 left → ceil(3 × 28 / 2) = 42 days.
    const i = run({ progress: [done("l1-1", ist("2026-11-20")), done("l1-2", ist("2026-12-03", "09:00"))] });
    expect(i.phase.projection).toEqual({ status: "projected", finish: "2027-01-14", daysNeeded: 42, perWeek: 0.5, onTrack: false });
    // Other kinds and other phases' tasks don't set the pace.
    const others = run({ progress: [done("l1-1", ist("2026-12-01")), done("l2-1", ist("2026-12-01")), done("r1-1-1", ist("2026-12-01"))] });
    expect(others.phase.projection.status).toBe("not-enough-activity");
  });

  it("on track when the projection falls by the phase's end", () => {
    const progress = ["l1-1", "l1-2", "l1-3", "l1-4"].map((id) => done(id, ist("2026-12-02")));
    // 4 in 28 days, 1 left → 7 days → 10 Dec, before 14 Dec.
    expect(run({ progress }).phase.projection).toEqual({ status: "projected", finish: "2026-12-10", daysNeeded: 7, perWeek: 1, onTrack: true });
  });

  it("a finished phase says so instead of projecting", () => {
    const progress = [1, 2, 3, 4, 5].map((n) => done(`l1-${n}`, ist("2026-12-02")));
    expect(run({ progress }).phase).toMatchObject({ done: 5, total: 5, projection: { status: "complete" } });
  });
});

describe("certifications", () => {
  it("reads target dates from the content's date text", () => {
    expect(targetDateOf("December 2026")).toBe("2026-12-31");
    expect(targetDateOf("February–March 2027, after Phase 6")).toBe("2027-03-31");
    expect(targetDateOf("February-March 2027")).toBe("2027-03-31");
    expect(targetDateOf("April 2027 or later, when practice exams say ready")).toBe("2027-04-30");
    expect(targetDateOf("February 2028")).toBe("2028-02-29");
    expect(targetDateOf("February 10–15, 2027")).toBe("2027-02-15");
    expect(targetDateOf("After joining a Claude partner company")).toBeNull();
    expect(targetDateOf("")).toBeNull();
    expect(targetDateOf("Some time in December 2026")).toBeNull();
  });

  it("every real certification's date text either parses or clearly names no date", () => {
    for (const cert of trackerContent.certs) {
      const target = targetDateOf(cert.date);
      if (target === null) expect(cert.date).toMatch(/^After /);
      else expect(target).toMatch(/^20\d\d-\d\d-\d\d$/);
    }
  });

  it("lists each in display order with days left and prep done out of total", () => {
    const i = run({ progress: [done("c1-1", null), done("c1-2", ist("2026-12-01")), done("c2-1", null), done("c2-2", null), done("cr1", ist("2026-12-01"))] });
    expect(i.certs).toEqual([
      { index: 1, name: "Cert B", dateText: "After something else happens", targetDate: null, daysLeft: null, done: 2, total: 2, passed: true },
      { index: 0, name: "Cert A", dateText: "December 2026", targetDate: "2026-12-31", daysLeft: 28, done: 2, total: 3, passed: false },
    ]);
  });
});

describe("this month", () => {
  it("counts note saves and learning resources finished since 00:00 IST on the 1st", () => {
    const i = run({
      progress: [done("r1-1-1", "2026-11-30T18:29:59Z"), done("r1-1-2", "2026-11-30T18:30:00Z"), done("r1-1-3", ist("2026-12-03")), done("l1-1", ist("2026-12-02"))],
      events: [
        ev("l1-1", "note", "2026-11-30T18:29:59Z"), // 30 Nov IST
        ev("l1-1", "note", "2026-11-30T18:30:00Z"), // 1 Dec IST
        ev("journal", "note", ist("2026-12-02")),
        ev("l1-1", "link", ist("2026-12-02")),
        ev("l1-1", "done", ist("2026-12-02")),
      ],
    });
    expect(i.thisMonth).toEqual({ monthStart: "2026-12-01", notesSaved: 2, resourcesDone: 2 });
  });

  it("counts each item's note once a month, however many times it autosaved", () => {
    const i = run({
      events: [
        ev("l1-1", "note", ist("2026-12-02")),
        ev("l1-1", "note", ist("2026-12-02")),
        ev("l1-1", "note", ist("2026-12-03")),
        ev("l1-2", "note", ist("2026-12-03")),
      ],
    });
    expect(i.thisMonth.notesSaved).toBe(2);
  });
});

describe("users with little or old data", () => {
  it("an empty user: zeros everywhere and the empty-state flags, never an error", () => {
    const i = run();
    expect(i.hasCompletions).toBe(false);
    expect(i.thisWeek).toEqual({ weekStart: THIS_WEEK, done: 0, lastWeek: 0, currentStreak: 0, longestStreak: 0 });
    expect(i.weekly).toHaveLength(12);
    expect(i.weekly.every((w) => w.total === 0)).toBe(true);
    expect(i.activity).toMatchObject({ activeDays30: 0, hasActivity: false, reachesBeforeHistory: true });
    expect(i.phase).toMatchObject({ n: 1, done: 0, total: 5, recentCompletions: 0, projection: { status: "not-enough-activity" } });
    expect(i.certs.every((c) => c.done === 0 && !c.passed)).toBe(true);
    expect(i.thisMonth).toEqual({ monthStart: "2026-12-01", notesSaved: 0, resourcesDone: 0 });
    expect(i.today).toBe("2026-12-03");
    expect(i.generatedAt).toBe("2026-12-03T04:30:00.000Z");
  });

  it("only imported done_at data from before the event history: charts, streaks and estimated activity", () => {
    const progress = [
      done("l1-1", ist("2026-11-02")),
      done("l1-2", ist("2026-11-10")),
      done("pp1", ist("2026-11-10", "20:00")),
      done("r1-1-1", ist("2026-11-17")),
      done("l1-3", ist("2026-01-05")), // before the window: streak history only
    ];
    const i = run({ progress, nowMs: at("2026-11-25T04:30:00Z") });
    expect(i.today).toBe("2026-11-25");
    expect(i.thisWeek).toEqual({ weekStart: "2026-11-23", done: 0, lastWeek: 1, currentStreak: 3, longestStreak: 3 });
    expect(i.weekly.map((w) => w.total).slice(-4)).toEqual([1, 2, 1, 0]);
    expect(i.activity.days.filter((d) => d.count > 0)).toEqual([
      { date: "2026-11-02", count: 1, estimated: true },
      { date: "2026-11-10", count: 2, estimated: true },
      { date: "2026-11-17", count: 1, estimated: true },
    ]);
    expect(i.activity.activeDays30).toBe(3);
    expect(i.activity.reachesBeforeHistory).toBe(true);
    expect(i.thisMonth).toEqual({ monthStart: "2026-11-01", notesSaved: 0, resourcesDone: 1 });
  });

  it("is deterministic: the same input gives the same output", () => {
    const input = { progress: [done("l1-1", ist("2026-12-01"))], events: [ev("l1-1", "done", ist("2026-12-01"))] };
    expect(run(input)).toEqual(run(input));
  });

  it("works on the real content too", () => {
    const i = computeInsights({ nowMs: NOW, progress: [done("cr1", ist("2026-12-01")), done("c1-1", ist("2026-12-01"))], events: [], settings: ALL, content: trackerContent, courses: COURSES });
    expect(i.weekly.at(-1)?.byKind).toMatchObject({ courses: 1, certs: 1 });
    expect(i.certs.length).toBe(trackerContent.certs.length);
    expect(i.phase.total).toBeGreaterThan(0);
  });
});
