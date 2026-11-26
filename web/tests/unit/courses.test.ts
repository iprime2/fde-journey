// Courses & badges (web/docs/COURSES.md): the content matches the approved plan, the ids are
// `cr{n}`, saving accepts them, and the page's helpers and tag filter work. Progress is made up.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COURSES, COURSE_GROUPS, COURSE_PHASE_NAMES, COURSE_PHASE_SHORT_NAMES, COURSE_SOURCES, COURSES_DISCLAIMER } from "@/content/courses";
import { COURSES_DESCRIPTION, SEARCH_PLACEHOLDERS } from "@/content/page-copy";
import { trackerContent as c } from "@/content/tracker-data";
import type { Course } from "@/content/types";
import {
  EMPTY_FILTER,
  type FilterEntry,
  computeVisibility,
  filterFromParams,
  filterFromRecord,
  filterKey,
  filterSearch,
  isFilterActive,
  matchesEntry,
} from "@/lib/filter";
import { courseId, listCourseItems } from "@/lib/ids";
import type { ProgressMap, ProgressRecord } from "@/lib/progress";
import { ITEM_IDS, NOTE_IDS, noteIdSchema, parseField, tickableIdSchema } from "@/lib/validation";
import {
  BADGE_CHIP,
  TOP_PICK_LEAD,
  courseFacts,
  courseMeta,
  courseTagOptions,
  coursesView,
  filterEntries,
  formatHours,
  knownHours,
  phaseLabel,
  rowSearchText,
  statedLength,
} from "@/lib/views";

const PHASES = { full: COURSE_PHASE_NAMES, short: COURSE_PHASE_SHORT_NAMES };

const rec = (patch: Partial<ProgressRecord>): ProgressRecord => ({ done: false, note: "", link: "", doneAt: null, updatedAt: null, ...patch });
const done = (...ids: string[]): ProgressMap => new Map(ids.map((id) => [id, rec({ done: true })]));
const empty: ProgressMap = new Map();

/** The plan's table, parsed: | id | Provider | [Title](url) (Level) | Length | Badge | Phase | */
function planRows() {
  const md = readFileSync(path.join(process.cwd(), "docs", "COURSES.md"), "utf8");
  return md
    .split("\n")
    .filter((line) => /^\| cr\d+ \|/.test(line))
    .map((line) => {
      const [id, provider, course, length, badge, phase] = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const m = course.match(/^\[(.+)\]\((https:[^)]+)\)(?: \((Beginner|Intermediate|Advanced)\))?$/);
      if (!m) throw new Error(`Unreadable course cell: ${course}`);
      const [phaseNumber, ...phaseWords] = phase.split(" ");
      return {
        id,
        provider,
        title: m[1],
        url: m[2],
        level: m[3],
        length: length === "—" ? "" : length,
        badge: badge === "✓",
        phase: Number(phaseNumber),
        phaseName: phaseWords.join(" "),
      };
    });
}

describe("course content", () => {
  const plan = planRows();

  it("copies the approved plan's table exactly, in its order", () => {
    expect(plan).toHaveLength(27);
    expect(COURSES).toHaveLength(plan.length);
    COURSES.forEach((course, i) => {
      const row = plan[i];
      expect(courseId(i)).toBe(row.id);
      expect(
        { provider: course.provider, title: course.title, url: course.url, length: course.length, level: course.level, badge: course.badge, phase: course.phase },
        row.id,
      ).toEqual({ provider: row.provider, title: row.title, url: row.url, length: row.length, level: row.level, badge: row.badge, phase: row.phase });
    });
  });

  it("places each course in a real roadmap phase, under the plan's name for it", () => {
    for (const row of plan) {
      const phase = c.phases.find((p) => p.n === row.phase);
      expect(phase, row.id).toBeDefined();
      expect(COURSE_PHASE_NAMES[row.phase], row.id).toBe(row.phaseName);
      // The plan shortens some titles ("Project 2" for "Project 2 — AI SRE Agent").
      expect(phase!.title.startsWith(row.phaseName), row.id).toBe(true);
    }
  });

  it("marks the mentor's five top picks, and only those", () => {
    const picks = COURSES.flatMap((course, i) => (course.topPick ? [courseId(i)] : []));
    expect(new Set(picks)).toEqual(new Set(["cr4", "cr27", "cr5", "cr26", "cr25"]));
  });

  it("gives each top pick the reason in the plan's list, word for word", () => {
    // "- cr5 and cr26: evals, the tests …." under "Mentor's top picks".
    const md = readFileSync(path.join(process.cwd(), "docs", "COURSES.md"), "utf8");
    const reasons = new Map<string, string>();
    for (const m of md.matchAll(/^- (cr\d+(?: and cr\d+)*): (.+)\.$/gm)) {
      for (const id of m[1].split(" and ")) reasons.set(id, m[2]);
    }
    expect(reasons.size).toBe(5);
    COURSES.forEach((course, i) => {
      if (course.topPick) expect(course.topPick, courseId(i)).toBe(reasons.get(courseId(i)));
    });
  });

  it("has a short name for every phase with a course, at most 24 characters as a chip", () => {
    for (const course of COURSES) {
      const label = phaseLabel(COURSE_PHASE_SHORT_NAMES, course.phase);
      expect(COURSE_PHASE_SHORT_NAMES[course.phase], course.title).toBeDefined();
      // The narrowest text column (320 px) fits about 24 characters of chip text.
      expect(label.length, label).toBeLessThanOrEqual(24);
      // A short name starts the plan's full name, so search on the full name still finds it.
      expect(COURSE_PHASE_NAMES[course.phase].startsWith(COURSE_PHASE_SHORT_NAMES[course.phase]), label).toBe(true);
    }
  });

  it("labels the sources with the card titles", () => {
    expect(COURSE_SOURCES.map((s) => s.label)).toEqual(COURSE_GROUPS.map((g) => g.title));
  });

  it("has https links only", () => {
    for (const course of COURSES) expect(course.url.startsWith("https://"), course.title).toBe(true);
  });

  it("puts every course in exactly one provider card", () => {
    for (const course of COURSES) expect(COURSE_GROUPS.filter((g) => g.provider === course.provider), course.title).toHaveLength(1);
    expect(new Set(COURSE_GROUPS.map((g) => g.key)).size).toBe(COURSE_GROUPS.length);
  });

  it("says the counts the page header and copy repeat", () => {
    expect(COURSES_DESCRIPTION.startsWith(`${COURSES.length} courses`)).toBe(true);
    expect(COURSES_DISCLAIMER).toContain("checked 26 Nov 2026");
    // Fits beside the status filter at 390 px (design spec 4, Toolbar): about 16 characters.
    expect(SEARCH_PLACEHOLDERS.courses.length).toBeLessThanOrEqual(16);
  });
});

describe("course ids", () => {
  const items = listCourseItems(COURSES);

  it("are cr1 to cr27, unique, with the course titles", () => {
    expect(items.map((i) => i.id)).toEqual(Array.from({ length: 27 }, (_, n) => `cr${n + 1}`));
    for (const item of items) expect(item.id).toMatch(/^cr[1-9]\d*$/);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items[3]).toEqual({ id: "cr4", title: "Scope AI Solutions", group: "course" });
  });

  it("can be ticked, noted and linked", () => {
    expect(ITEM_IDS.has("cr1")).toBe(true);
    expect(ITEM_IDS.has("cr27")).toBe(true);
    expect(NOTE_IDS.has("cr12")).toBe(true);
    expect(parseField(tickableIdSchema, "cr1", "itemId")).toEqual({ ok: true, value: "cr1" });
    expect(parseField(tickableIdSchema, "cr27", "itemId")).toEqual({ ok: true, value: "cr27" });
    expect(parseField(noteIdSchema, "cr5", "itemId")).toEqual({ ok: true, value: "cr5" });
  });

  it("are refused when they don't exist or are malformed", () => {
    for (const bad of ["cr0", "cr28", "cr", "cr01", "CR1", "cr1 ", " cr1", "cr-1", "cr1.5", "crx", 1, null]) {
      const result = parseField(tickableIdSchema, bad, "itemId");
      expect(result.ok, String(bad)).toBe(false);
    }
  });
});

describe("Courses page model", () => {
  const cards = coursesView(COURSES, COURSE_GROUPS, PHASES, empty);
  const rows = cards.flatMap((card) => card.rows);
  const rowOf = (id: string) => rows.find((r) => r.id === id)!;

  it("groups the courses by provider, keeping each course's id", () => {
    expect(cards.map((card) => card.title)).toEqual(["OpenAI developer tracks", "OpenAI Academy", "Anthropic Claude Academy"]);
    expect(cards.map((card) => card.rows.length)).toEqual([3, 8, 16]);
    expect(cards[1].rows[0].id).toBe("cr4");
    expect(cards[2].rows.at(-1)?.id).toBe("cr27");
    expect(rows).toHaveLength(27);
  });

  it("shows length and level as meta, and nothing when the provider gives neither", () => {
    expect(rowOf("cr1").meta).toBe("2–4 h · Intermediate");
    expect(rowOf("cr12").meta).toBe("67 lessons · 9 h");
    expect(rowOf("cr4").meta).toBeUndefined();
    expect(courseMeta({ ...COURSES[0], length: "", level: undefined })).toBe("");
  });

  it("adds the chips: Badge as an outlined tag, then the phase with its short name", () => {
    expect(BADGE_CHIP).toEqual({ label: "Badge", variant: "tag" });
    expect(rowOf("cr4").chips).toEqual([BADGE_CHIP, { label: "Phase 8 · Portfolio", variant: "neutral" }]);
    expect(rowOf("cr25").chips?.map((x) => x.label)).toEqual(["Badge", "Phase 6 · AWS"]);
    expect(rowOf("cr5").chips?.at(-1)?.label).toBe("Phase 7 · Evaluation");
    expect(rowOf("cr1").chips).toEqual([{ label: "Phase 1 · Foundations", variant: "neutral" }]);
    expect(rowOf("cr21").chips?.map((x) => x.label)).toEqual(["Phase 4 · Agents"]);
    // No chip says "Top pick", and no chip uses a status style that means done or current.
    for (const r of rows) for (const chip of r.chips ?? []) expect(["tag", "neutral"]).toContain(chip.variant);
    expect(rows.flatMap((r) => r.chips ?? []).some((chip) => chip.label === "Top pick")).toBe(false);
    expect(phaseLabel(COURSE_PHASE_NAMES, 3)).toBe("Phase 3");
  });

  it("starts a top pick's why line with the bold lead-in, links the title and offers a note", () => {
    expect(TOP_PICK_LEAD).toBe("Top pick for the FDE role:");
    expect(rowOf("cr25")).toMatchObject({ whyLead: TOP_PICK_LEAD, why: "it pairs with the AWS certifications." });
    expect(rowOf("cr4").why).toBe("scoping a customer's problem into a solution plan.");
    expect(rowOf("cr5").why).toBe("evals, the tests that show whether an AI app's answers are good enough.");
    expect(rowOf("cr27").why).toBe("rolling Claude out at a customer.");
    expect(rowOf("cr1").why).toBeUndefined();
    expect(rowOf("cr1").whyLead).toBeUndefined();
    expect(rowOf("cr1").url).toBe(COURSES[0].url);
    expect(rowOf("cr1").notePlaceholder).toBe("What did you learn? Key points, questions… Put your badge link in the link field.");
  });

  it("makes the provider, the chips, the full phase name and top picks searchable", () => {
    expect(rowSearchText(rowOf("cr12"))).toContain("anthropic");
    expect(rowSearchText(rowOf("cr12"))).toContain("badge");
    expect(rowSearchText(rowOf("cr25"))).toContain("top pick");
    expect(rowSearchText(rowOf("cr25"))).toContain("aws cloud and deployment");
    expect(rowSearchText(rowOf("cr7"))).toContain("rag and retrieval");
  });

  it("counts done per card", () => {
    const withDone = coursesView(COURSES, COURSE_GROUPS, PHASES, done("cr1", "cr13", "cr14"));
    expect(withDone.map((card) => card.done)).toEqual([1, 0, 2]);
  });
});

describe("course facts", () => {
  it("counts done courses and badges earned (done and awarding a badge)", () => {
    expect(courseFacts(COURSES, empty)).toEqual({ total: 27, done: 0, badges: 21, badgesEarned: 0 });
    // cr1 gives no badge; cr4 and cr12 do. A note alone is not done.
    const progress: ProgressMap = new Map([
      ["cr1", rec({ done: true })],
      ["cr4", rec({ done: true })],
      ["cr12", rec({ done: true })],
      ["cr13", rec({ note: "Halfway through." })],
    ]);
    expect(courseFacts(COURSES, progress)).toEqual({ total: 27, done: 3, badges: 21, badgesEarned: 2 });
  });

  it("adds up the stated hours, ranges and minutes included", () => {
    const made = (length: string): Course => ({ provider: "Anthropic", title: "Made up", url: "https://example.com/", length, badge: false, phase: 1 });
    expect(knownHours([made("2–4 h"), made("5 lessons · 45 min"), made("12 lessons · 1.5 h"), made("")])).toEqual({ low: 4.25, high: 6.25, courses: 3 });
    expect(knownHours(COURSES)).toEqual({ low: 44, high: 49, courses: 19 });
    expect(formatHours(knownHours(COURSES))).toBe("44–49 h");
    expect(formatHours({ low: 40, high: 40 })).toBe("40 h");
    // The header fact: the total, and how many of all the courses state a length.
    expect(statedLength(knownHours(COURSES), COURSES.length)).toBe("44–49 h (19 of 27 courses)");
  });
});

describe("tag filter (badges, top picks, phases)", () => {
  const options = courseTagOptions(COURSES, COURSE_PHASE_SHORT_NAMES);
  const tags = options.map((o) => o.value).filter(Boolean);

  it("offers everything, badges, top picks, then the phases that have courses", () => {
    expect(options.slice(0, 3)).toEqual([
      { value: "", label: "All courses" },
      { value: "badge", label: "With a badge" },
      { value: "top-pick", label: "Top picks" },
    ]);
    expect(options.slice(3).map((o) => o.value)).toEqual(["phase-1", "phase-2", "phase-4", "phase-5", "phase-6", "phase-7", "phase-8"]);
    // The same short phase names as the chips.
    expect(options.slice(3).map((o) => o.label)).toEqual([
      "Phase 1 · Foundations",
      "Phase 2 · RAG",
      "Phase 4 · Agents",
      "Phase 5 · Project 2",
      "Phase 6 · AWS",
      "Phase 7 · Evaluation",
      "Phase 8 · Portfolio",
    ]);
  });

  it("reads ?tag= only when the page offers it", () => {
    expect(filterFromRecord({ tag: "badge" }, tags)).toEqual({ q: "", status: "all", tag: "badge" });
    expect(filterFromRecord({ tag: "nonsense" }, tags)).toEqual(EMPTY_FILTER);
    // Pages without a tag filter ignore it.
    expect(filterFromRecord({ tag: "badge" })).toEqual(EMPTY_FILTER);
    expect(filterFromParams(new URLSearchParams("q=evals&tag=phase-7"), tags)).toEqual({ q: "evals", status: "all", tag: "phase-7" });
  });

  it("writes it to the URL, counts it as a filter and keys it", () => {
    expect(filterSearch({ q: "", status: "all", tag: "badge" }, "")).toBe("?tag=badge");
    expect(filterSearch(EMPTY_FILTER, "?tag=badge&q=x")).toBe("");
    expect(isFilterActive({ q: "", status: "all", tag: "badge" })).toBe(true);
    expect(isFilterActive({ q: "", status: "all", tag: "" })).toBe(false);
    expect(filterKey({ q: "", status: "all", tag: "badge" })).not.toBe(filterKey(EMPTY_FILTER));
    expect(filterKey({ q: "a", status: "all" })).toBe(filterKey({ q: "a", status: "all", tag: "" }));
  });

  it("shows only the matching rows and cards", () => {
    const entries = filterEntries(coursesView(COURSES, COURSE_GROUPS, PHASES, done("cr5")));
    const shown = (tag: string, status: "all" | "done" = "all") => [...computeVisibility(entries, { q: "", status, tag }).items];
    expect(shown("badge")).toHaveLength(21);
    expect(new Set(shown("top-pick"))).toEqual(new Set(["cr4", "cr5", "cr25", "cr26", "cr27"]));
    expect(new Set(shown("phase-7"))).toEqual(new Set(["cr3", "cr5", "cr8", "cr26"]));
    expect(shown("phase-7", "done")).toEqual(["cr5"]);
    expect(computeVisibility(entries, { q: "", status: "all", tag: "phase-6" }).sections).toEqual(new Set(["anthropic"]));
    // Rows without tags (every other page) never match a tag.
    const plain: FilterEntry = { id: "l1-1", text: "python", done: false, noted: false, section: "phase-1" };
    expect(matchesEntry(plain, { q: "", status: "all", tag: "badge" })).toBe(false);
    expect(matchesEntry(plain, EMPTY_FILTER)).toBe(true);
  });
});
