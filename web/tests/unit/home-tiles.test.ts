// Home tile grids by tile count (design spec 5, "Tile grid by count", v0.7): with an odd count the
// first tile (roadmap milestones) spans two columns so every row fills; with an even count nothing
// spans. The Home skeleton uses the same helpers.
import { describe, expect, it } from "vitest";
import { tileGridClass, tileSpanClass } from "@/components/home";

const spans = (count: number) => Array.from({ length: count }, (_, i) => tileSpanClass(count, i));

describe("Home tile grid", () => {
  it("uses the spec's columns for 4 to 7 tiles", () => {
    expect(tileGridClass(7)).toBe("grid-cols-2 md:grid-cols-4");
    expect(tileGridClass(6)).toBe("grid-cols-2 md:grid-cols-3");
    expect(tileGridClass(5)).toBe("grid-cols-2 md:grid-cols-3");
    expect(tileGridClass(4)).toBe("grid-cols-2 xl:grid-cols-4");
  });

  it("falls back to the 6-tile grid for any other count (the 3-tile branch is gone)", () => {
    for (const count of [0, 1, 2, 3, 8, 9]) expect(tileGridClass(count), String(count)).toBe(tileGridClass(6));
    for (const count of [3, 9]) expect(spans(count).every((s) => s === undefined), String(count)).toBe(true);
  });

  it("spans the first tile across two columns only with 5 or 7 tiles", () => {
    expect(spans(7)).toEqual(["col-span-2", ...Array(6).fill(undefined)]);
    expect(spans(5)).toEqual(["col-span-2", ...Array(4).fill(undefined)]);
    expect(spans(6).every((s) => s === undefined)).toBe(true);
    expect(spans(4).every((s) => s === undefined)).toBe(true);
  });

  it("fills every row: no hole in 2 columns, nor in the wider grid", () => {
    const columns = (cls: string) => Number(cls.match(/(?:md|xl):grid-cols-(\d)/)![1]);
    for (const count of [4, 5, 6, 7]) {
      const cells = count + (tileSpanClass(count, 0) ? 1 : 0);
      expect(cells % 2, `${count} tiles, 2 columns`).toBe(0);
      expect(cells % columns(tileGridClass(count)), `${count} tiles, wide`).toBe(0);
    }
  });
});
