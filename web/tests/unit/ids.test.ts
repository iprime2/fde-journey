import { describe, expect, it } from "vitest";
import { COURSES } from "@/content/courses";
import { trackerContent } from "@/content/tracker-data";
import { courseId, listItems, listTrackerItems, resourceId, certsInDisplayOrder } from "@/lib/ids";
import { extractContent, extractTrackerItems, readTrackerHtml } from "../../scripts/tracker-source.mjs";
import baseline from "./baseline-ids.json";

const html = readTrackerHtml();
/** Every item the app saves progress for: the tracker's, then the courses (app only). */
const items = listItems(trackerContent, COURSES);
/** The tracker's items: the parity check below compares exactly these with the tracker. */
const trackerItems = listTrackerItems(trackerContent);

describe("content stays in sync with the tracker", () => {
  it("content/tracker-data.ts matches the tracker (run `npm run content:sync` after roadmap changes)", () => {
    expect(trackerContent).toEqual(extractContent(html));
  });
});

describe("item ids (saved progress depends on them)", () => {
  it("are unique", () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("match the tracker's ids exactly, with the same titles", () => {
    const tracker = extractTrackerItems(html) as Map<string, string>;
    expect(new Set(trackerItems.map((i) => i.id))).toEqual(new Set(tracker.keys()));
    for (const item of trackerItems) expect(item.title, item.id).toBe(tracker.get(item.id));
  });

  it("are the tracker's items plus the courses, and nothing else (the tracker never had courses)", () => {
    const courses = items.filter((i) => i.group === "course");
    expect(courses.map((i) => i.id)).toEqual(COURSES.map((_, n) => courseId(n)));
    expect(items.filter((i) => i.group !== "course")).toEqual(trackerItems);
    expect(trackerItems.some((i) => i.id.startsWith("cr"))).toBe(false);
  });

  it("keep every baseline id with its baseline title (catches deletes, reorders and mid-list inserts)", () => {
    const current = new Map(items.map((i) => [i.id, i.title]));
    const missing = Object.keys(baseline.items).filter((id) => !current.has(id));
    expect(missing, "ids removed").toEqual([]);
    const moved = Object.entries(baseline.items)
      .filter(([id, title]) => current.get(id) !== title)
      .map(([id, title]) => `${id}: was "${title}", now "${current.get(id)}"`);
    expect(moved, "an id now points at a different title: items were inserted or reordered, which would move saved progress").toEqual([]);
  });

  it("use the documented formats", () => {
    const formats = [/^l\d+-\d+$/, /^c\d+-\d+$/, /^p\d+-\d+$/, /^k\d+$/, /^s\d+-\d+$/, /^r\d+-\d+-\d+$/, /^pp\d+$/, /^bk\d+$/, /^cr\d+$/];
    for (const item of items) expect(formats.some((f) => f.test(item.id)), item.id).toBe(true);
    expect(resourceId("l2-8", 0)).toBe("r2-8-1");
    expect(courseId(0)).toBe("cr1");
    expect(courseId(26)).toBe("cr27");
  });

  it("keep certification ids tied to array position, not display rank", () => {
    const ordered = certsInDisplayOrder(trackerContent);
    expect(ordered[0].cert.name).toContain("AIF-C01");
    const saa = ordered.find((x) => x.cert.name.includes("SAA-C03"));
    expect(saa?.index).toBe(6); // saved as c7-*
  });
});

describe("content links", () => {
  it("are all https", () => {
    const urls = [
      ...Object.values(trackerContent.resources).flatMap((g) => g.items.map((r) => r.url)),
      ...trackerContent.papers.map((p) => p.url),
      ...trackerContent.books.map((b) => b.url),
      ...COURSES.map((x) => x.url),
    ];
    for (const u of urls) expect(u.startsWith("https://"), u).toBe(true);
  });
});
