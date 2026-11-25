import { describe, expect, it } from "vitest";
import { trackerContent as c } from "@/content/tracker-data";
import { phaseTaskId, projectTaskId, resourceId, scalerClassId } from "@/lib/ids";
import type { ProgressMap, ProgressRecord } from "@/lib/progress";
import { dashboardModel, learningIds, milestoneIds, navCounts, percent, readingIds, scalerIds } from "@/lib/summary";

const rec = (done: boolean): ProgressRecord => ({ done, note: "", link: "", doneAt: null, updatedAt: null });
const done = (...ids: string[]): ProgressMap => new Map(ids.map((id) => [id, rec(true)]));
const empty: ProgressMap = new Map();

describe("navigation counts", () => {
  it("start at zero with the tracker's totals", () => {
    const n = navCounts(c, empty);
    expect(n.roadmap).toEqual({ done: 0, total: c.phases.reduce((s, p) => s + p.tasks.length, 0) });
    expect(n.reading).toEqual({ done: 0, total: c.papers.length + c.books.length });
    expect(n.scaler.total).toBe(c.scaler.reduce((s, m) => s + m.classes.length, 0));
    expect(n.certs).toEqual({ done: 0, total: 7 });
    expect(n.projects).toEqual({ done: 0, total: 3 });
    expect(n.career).toEqual({ done: 0, total: c.career.length });
  });

  it("count roadmap tasks only (not resources) for Roadmap", () => {
    expect(navCounts(c, done(phaseTaskId(1, 0), resourceId("l1-1", 0), resourceId("l1-1", 1))).roadmap.done).toBe(1);
  });

  it("count a project only when every step is done", () => {
    const steps = c.projects[0].tasks.map((_, j) => projectTaskId(0, j));
    expect(navCounts(c, done(...steps.slice(1))).projects.done).toBe(0);
    expect(navCounts(c, done(...steps)).projects.done).toBe(1);
  });
});

describe("Home", () => {
  it("shows zeros and empty bars before anything is ticked", () => {
    const m = dashboardModel(c, empty, "2026-11-25");
    expect(m.tiles.map((t) => t.value)).toEqual([
      "0%",
      `0/${learningIds(c).length}`,
      `0/${Object.values(c.resources).reduce((s, g) => s + g.items.length, 0)}`,
      `0/${scalerIds(c).length}`,
      "0/7",
      "0/3",
    ]);
    expect(m.tiles[0].label).toBe(`0 of ${milestoneIds(c).length} roadmap milestones`);
    expect(m.tiles[3].label).toBe("Scaler classes · now Module 1");
    expect(m.tiles.map((t) => t.href)).toEqual(["/roadmap", "/roadmap", "/roadmap", "/scaler", "/certs", "/projects"]);
    expect(m.hasProgress).toBe(false);
  });

  it("puts today's phase in the panel with its first three open tasks", () => {
    const m = dashboardModel(c, done(phaseTaskId(2, 1)), "2026-12-05");
    expect(m.now.phase.n).toBe(2);
    expect(m.now.phase.chip.label).toBe("This phase");
    expect(m.now.upNext.map((t) => t.id)).toEqual(["l2-1", "l2-3", "l2-4"]);
    expect(m.now.phase.done).toBe(1);
    expect(m.hasProgress).toBe(true);
  });

  it("says when a phase has nothing left", () => {
    const ids = c.phases[0].tasks.map((_, j) => phaseTaskId(1, j));
    const m = dashboardModel(c, done(...ids), "2026-11-26");
    expect(m.now.upNext).toEqual([]);
    expect(m.now.phase.chip.label).toBe("Complete");
  });

  it("names the next Scaler class", () => {
    const m = dashboardModel(c, done(scalerClassId(1, 0)), "2026-11-25");
    expect(m.now.module.n).toBe(1);
    expect(m.now.module.nextClass).toBe(c.scaler[0].classes[1]);
  });

  it("computes percentages safely", () => {
    expect(percent({ done: 1, total: 3 })).toBe(33);
    expect(percent({ done: 0, total: 0 })).toBe(0);
    expect(readingIds(c)[0]).toBe("pp1");
  });
});
