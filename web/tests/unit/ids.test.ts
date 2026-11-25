import { describe, expect, it } from "vitest";
import { trackerContent } from "@/content/tracker-data";
import { listItems, resourceId, certsInDisplayOrder } from "@/lib/ids";
import { extractContent, extractTrackerItems, readTrackerHtml } from "../../scripts/tracker-source.mjs";
import baseline from "./baseline-ids.json";

const html = readTrackerHtml();
const items = listItems(trackerContent);

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
    expect(new Set(items.map((i) => i.id))).toEqual(new Set(tracker.keys()));
    for (const item of items) expect(item.title, item.id).toBe(tracker.get(item.id));
  });

  it("keep every id from the baseline (lists are append-only)", () => {
    const current = new Set(items.map((i) => i.id));
    const missing = baseline.ids.filter((id) => !current.has(id));
    expect(missing).toEqual([]);
  });

  it("use the documented formats", () => {
    const formats = [/^l\d+-\d+$/, /^c\d+-\d+$/, /^p\d+-\d+$/, /^k\d+$/, /^s\d+-\d+$/, /^r\d+-\d+-\d+$/, /^pp\d+$/, /^bk\d+$/];
    for (const item of items) expect(formats.some((f) => f.test(item.id)), item.id).toBe(true);
    expect(resourceId("l2-8", 0)).toBe("r2-8-1");
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
    ];
    for (const u of urls) expect(u.startsWith("https://"), u).toBe(true);
  });
});
