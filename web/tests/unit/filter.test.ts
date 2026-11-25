import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER,
  type FilterEntry,
  computeVisibility,
  emptyKind,
  filterFromParams,
  filterFromRecord,
  filterKey,
  filterSearch,
  isFilterActive,
  matchesEntry,
  parseStatus,
  syncFromUrl,
} from "@/lib/filter";

const e = (id: string, text: string, extra: Partial<FilterEntry> = {}): FilterEntry => ({
  id,
  text: text.toLowerCase(),
  done: false,
  noted: false,
  section: "s1",
  ...extra,
});

describe("filter state in the URL", () => {
  it("accepts only known statuses", () => {
    expect(parseStatus("done")).toBe("done");
    expect(parseStatus("noted")).toBe("noted");
    expect(parseStatus("bogus")).toBe("all");
    expect(parseStatus(null)).toBe("all");
  });

  it("reads a page's searchParams, taking the first of repeated values", () => {
    expect(filterFromRecord({ q: ["rag", "x"], status: "open" })).toEqual({ q: "rag", status: "open" });
    expect(filterFromRecord({})).toEqual(EMPTY_FILTER);
  });

  it("reads URLSearchParams", () => {
    expect(filterFromParams(new URLSearchParams("q=qdrant&status=done"))).toEqual({ q: "qdrant", status: "done" });
  });

  it("writes only what is set and keeps other parameters", () => {
    expect(filterSearch({ q: "rag", status: "all" }, "")).toBe("?q=rag");
    expect(filterSearch({ q: "", status: "open" }, "?q=old")).toBe("?status=open");
    expect(filterSearch(EMPTY_FILTER, "?q=old&status=done")).toBe("");
    expect(filterSearch({ q: "a b", status: "done" }, "?x=1")).toBe("?x=1&q=a+b&status=done");
  });

  it("knows when a filter is active", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ q: "   ", status: "all" })).toBe(false);
    expect(isFilterActive({ q: "rag", status: "all" })).toBe(true);
    expect(isFilterActive({ q: "", status: "noted" })).toBe(true);
    expect(filterKey({ q: "a", status: "all" })).not.toBe(filterKey({ q: "a", status: "open" }));
  });
});

describe("matching", () => {
  it("matches case-insensitively and ignores surrounding spaces", () => {
    const row = e("l1-1", "Python for AI, FastAPI");
    expect(matchesEntry(row, { q: "  fastapi ", status: "all" })).toBe(true);
    expect(matchesEntry(row, { q: "qdrant", status: "all" })).toBe(false);
  });

  it("applies the status filter", () => {
    const done = e("a", "x", { done: true });
    const open = e("b", "x");
    const noted = e("c", "x", { noted: true });
    expect(matchesEntry(done, { q: "", status: "done" })).toBe(true);
    expect(matchesEntry(open, { q: "", status: "done" })).toBe(false);
    expect(matchesEntry(open, { q: "", status: "open" })).toBe(true);
    expect(matchesEntry(done, { q: "", status: "open" })).toBe(false);
    expect(matchesEntry(noted, { q: "", status: "noted" })).toBe(true);
    expect(matchesEntry(open, { q: "", status: "noted" })).toBe(false);
  });

  it("shows weekly notes under All items and With notes only", () => {
    const journal = e("journal", "weekly notes journal", { journal: true });
    expect(matchesEntry(journal, { q: "", status: "all" })).toBe(true);
    expect(matchesEntry(journal, { q: "", status: "noted" })).toBe(true);
    expect(matchesEntry(journal, { q: "", status: "open" })).toBe(false);
    expect(matchesEntry(journal, { q: "", status: "done" })).toBe(false);
    expect(matchesEntry(journal, { q: "blocker", status: "all" })).toBe(false);
  });
});

describe("visibility", () => {
  const entries: FilterEntry[] = [
    e("l2-1", "Embeddings and vector databases", { section: "phase-2" }),
    e("r2-1-1", "Vector Databases simply explained", { section: "phase-2", parent: "l2-1" }),
    e("r2-1-3", "Qdrant Beginner Course", { section: "phase-2", parent: "l2-1" }),
    e("l3-1", "FastAPI architecture", { section: "phase-3", done: true }),
    e("s1-1", "Your Playbook", { section: "mod-1", group: "core" }),
    e("s11-1", "Designing Your Cloud Network", { section: "mod-11", group: "elective" }),
  ];

  it("shows everything without a filter", () => {
    const v = computeVisibility(entries, EMPTY_FILTER);
    expect(v.items.size).toBe(entries.length);
    expect([...v.groups].sort()).toEqual(["core", "elective"]);
  });

  it("keeps a task visible, and its list open, when only a resource matches", () => {
    const v = computeVisibility(entries, { q: "qdrant", status: "all" });
    expect([...v.items].sort()).toEqual(["l2-1", "r2-1-3"]);
    expect(v.openParents.has("l2-1")).toBe(true);
    expect([...v.sections]).toEqual(["phase-2"]);
  });

  it("does not show a resource just because its task matches", () => {
    const v = computeVisibility(entries, { q: "embeddings", status: "all" });
    expect([...v.items]).toEqual(["l2-1"]);
    expect(v.openParents.size).toBe(0);
  });

  it("hides group labels with nothing under them", () => {
    const v = computeVisibility(entries, { q: "cloud", status: "all" });
    expect([...v.groups]).toEqual(["elective"]);
  });

  it("combines search and status", () => {
    const v = computeVisibility(entries, { q: "fastapi", status: "open" });
    expect(v.items.size).toBe(0);
    expect(v.sections.size).toBe(0);
  });

  it("explains an empty result", () => {
    expect(emptyKind({ q: "", status: "noted" }, false)).toBe("no-notes");
    expect(emptyKind({ q: "", status: "noted" }, true)).toBe("no-match");
    expect(emptyKind({ q: "zzz", status: "all" }, false)).toBe("no-match");
  });
});

describe("following the URL", () => {
  const k = (q: string) => filterKey({ q, status: "all" });

  it("does nothing when the URL has not changed", () => {
    expect(syncFromUrl({ seen: k("rag"), pending: null }, k("rag"))).toBeNull();
  });

  it("does not follow the page's own write, and clears it once it lands", () => {
    expect(syncFromUrl({ seen: k(""), pending: k("rag") }, k("rag"))).toEqual({
      sync: { seen: k("rag"), pending: null },
      follow: false,
    });
  });

  it("follows Back, Forward or a link to the plain page", () => {
    expect(syncFromUrl({ seen: k("rag"), pending: null }, k(""))).toEqual({ sync: { seen: k(""), pending: null }, follow: true });
    // An earlier own write that already landed doesn't block returning to it later.
    const afterOwnWrite = syncFromUrl({ seen: k(""), pending: k("kafka") }, k("kafka"))!.sync;
    const afterLink = syncFromUrl(afterOwnWrite, k(""))!.sync;
    expect(syncFromUrl(afterLink, k("kafka"))?.follow).toBe(true);
  });
});
