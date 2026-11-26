import { describe, expect, it } from "vitest";
import { COURSES, COURSE_GROUPS, COURSE_PHASE_NAMES } from "@/content/courses";
import { trackerContent as c } from "@/content/tracker-data";
import { JOURNAL_ID, certTaskId, listItems, projectTaskId, scalerClassId } from "@/lib/ids";
import type { ProgressMap, ProgressRecord } from "@/lib/progress";
import {
  careerView,
  certsView,
  coursesView,
  filterEntries,
  journalEntry,
  projectsView,
  readingView,
  resourceMeta,
  roadmapView,
  rowSearchText,
  scalerView,
} from "@/lib/views";

const empty: ProgressMap = new Map();
const rec = (patch: Partial<ProgressRecord>): ProgressRecord => ({
  done: false,
  note: "",
  link: "",
  doneAt: null,
  updatedAt: null,
  ...patch,
});
// Made-up example note from the design spec.
const NOTE = "Finished the quickstart. Next: try hybrid search on the sample set.";
const LINK = "https://example.com/demo";

const TODAY = "2026-11-25";

function allPageEntries(progress: ProgressMap) {
  return [
    ...filterEntries(roadmapView(c, progress, TODAY)),
    ...filterEntries(readingView(c, progress, TODAY)),
    ...filterEntries(scalerView(c, progress)),
    ...filterEntries(certsView(c, progress)),
    ...filterEntries(projectsView(c, progress)),
    ...filterEntries([careerView(c, progress).milestones]),
    ...filterEntries(coursesView(COURSES, COURSE_GROUPS, COURSE_PHASE_NAMES, progress)),
    journalEntry(careerView(c, progress).journalNote),
  ];
}

describe("pages show every item, under its tracker id", () => {
  it("cover exactly the tracker's ids and the courses, once each", () => {
    const shown = allPageEntries(empty).map((e) => e.id);
    expect(new Set(shown).size).toBe(shown.length);
    expect(new Set(shown)).toEqual(new Set([...listItems(c, COURSES).map((i) => i.id), JOURNAL_ID]));
  });

  it("show each item with the tracker's title", () => {
    const titles = new Map(listItems(c, COURSES).map((i) => [i.id, i.title]));
    const rows = [
      ...roadmapView(c, empty, TODAY).flatMap((card) => card.rows.flatMap((r) => [r, ...(r.resources?.rows ?? [])])),
      ...readingView(c, empty, TODAY).flatMap((card) => card.rows),
      ...scalerView(c, empty).flatMap((card) => card.rows),
      ...certsView(c, empty).flatMap((card) => card.rows),
      ...projectsView(c, empty).flatMap((card) => card.rows),
      ...careerView(c, empty).milestones.rows,
      ...coursesView(COURSES, COURSE_GROUPS, COURSE_PHASE_NAMES, empty).flatMap((card) => card.rows),
    ];
    for (const r of rows) expect(r.title, r.id).toBe(titles.get(r.id));
  });
});

describe("roadmap", () => {
  const cards = roadmapView(c, empty, TODAY);

  it("has one card per phase with the phase dates", () => {
    expect(cards.map((x) => x.key)).toEqual(c.phases.map((p) => `phase-${p.n}`));
    expect(cards[0].title).toBe("Phase 1 · Foundations");
    expect(cards[0].sub).toBe("24 Nov – 1 Dec 2026");
    expect(cards[0].chip).toEqual({ label: "This phase", variant: "now" });
    expect(cards[1].chip?.label).toBe("Upcoming");
  });

  it("attaches learning resources to their task, numbered from 1", () => {
    const task = cards[0].rows[0];
    expect(task.id).toBe("l1-1");
    expect(task.resources?.rows[0].id).toBe("r1-1-1");
    expect(task.resources?.rows[0].index).toBe("1.");
    expect(task.resources?.start).toBe(c.resources["l1-1"].start);
  });

  it("lets search find a task by its resources", () => {
    const task = cards[1].rows[0];
    expect(rowSearchText(task)).toContain("qdrant beginner course");
  });

  it("formats resource meta like the tracker", () => {
    expect(resourceMeta({ title: "t", url: "https://x", by: "Qdrant", type: "docs", length: "~20 min", level: "beginner", why: "" })).toBe(
      "Qdrant · Docs · ~20 min · Beginner",
    );
    expect(resourceMeta({ title: "t", url: "https://x", by: "Pinecone", type: "article", length: "", level: "intermediate", why: "" })).toBe(
      "Pinecone · Article · Intermediate",
    );
  });
});

describe("reading", () => {
  it("indexes papers by week and marks this week's", () => {
    const [papers] = readingView(c, empty, "2026-12-02");
    expect(papers.rows[0].index).toBe("Week of 30 Nov");
    expect(papers.rows[0].meta).toMatch(/· Core · This week$/);
    expect(papers.rows[2].meta).not.toContain("This week");
  });

  it("marks nothing before the first reading week", () => {
    const [papers] = readingView(c, empty, TODAY);
    expect(papers.rows.some((r) => r.meta?.includes("This week"))).toBe(false);
  });
});

describe("scaler", () => {
  it("numbers classes M{n}·{01} and opens the first unfinished module", () => {
    const cards = scalerView(c, empty);
    expect(cards[0].rows[0].index).toBe("M1·01");
    expect(cards[0].isCurrent).toBe(true);
    expect(cards[0].chip?.label).toBe("Current");
    expect(cards.filter((m) => m.kind === "core")).toHaveLength(10);
    expect(cards.filter((m) => m.kind === "elective")).toHaveLength(4);
  });

  it("moves to the next module once every class is done", () => {
    const progress = new Map(c.scaler[0].classes.map((_, j) => [scalerClassId(1, j), rec({ done: true })]));
    const cards = scalerView(c, progress);
    expect(cards[0].chip?.label).toBe("Complete");
    expect(cards[1].isCurrent).toBe(true);
  });
});

describe("certifications", () => {
  it("are in rank order but keep ids from their array position", () => {
    const cards = certsView(c, empty);
    expect(cards[0].title).toContain("AIF-C01");
    expect(cards[0].key).toBe("cert-0");
    const saa = cards.findIndex((x) => x.title.includes("SAA-C03"));
    expect(saa).toBe(1); // second in display order
    expect(cards[saa].key).toBe("cert-6");
    expect(cards[saa].rows[0].id).toBe("c7-1");
  });

  it("count as passed only when the last step is ticked", () => {
    const steps = c.certs[0].tasks.length;
    const someDone = new Map([[certTaskId(0, 0), rec({ done: true })]]);
    expect(certsView(c, someDone)[0].chip).toEqual({ label: "First", variant: "neutral" });
    const lastDone = new Map([[certTaskId(0, steps - 1), rec({ done: true })]]);
    expect(certsView(c, lastDone)[0].chip).toEqual({ label: "Passed", variant: "ok" });
  });
});

describe("notes and search", () => {
  it("include a row's note and link in its search text and mark it noted", () => {
    const progress = new Map([[projectTaskId(0, 0), rec({ note: NOTE, link: LINK })]]);
    const entry = filterEntries(projectsView(c, progress)).find((e) => e.id === "p1-1");
    expect(entry?.noted).toBe(true);
    expect(entry?.text).toContain("hybrid search on the sample set");
    expect(entry?.text).toContain("example.com/demo");
  });

  it("give resources their task as parent", () => {
    const entry = filterEntries(roadmapView(c, empty, TODAY)).find((e) => e.id === "r1-1-1");
    expect(entry?.parent).toBe("l1-1");
    expect(entry?.section).toBe("phase-1");
  });

  it("only link https URLs", () => {
    const rows = roadmapView(c, empty, TODAY).flatMap((card) => card.rows.flatMap((r) => r.resources?.rows ?? []));
    for (const r of rows) expect(r.url?.startsWith("https://"), r.id).toBe(true);
  });
});
