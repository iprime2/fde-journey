import { describe, expect, it } from "vitest";
import { countDone, getProgress, isDone, type ProgressRecord } from "@/lib/progress";

const rec = (done: boolean): ProgressRecord => ({ done, note: "", link: "", doneAt: null, updatedAt: null });

describe("progress helpers", () => {
  it("returns no saved progress before the database exists (M1)", async () => {
    expect((await getProgress()).size).toBe(0);
  });

  it("counts only items marked done", () => {
    const p = new Map([
      ["l1-1", rec(true)],
      ["l1-2", rec(false)],
    ]);
    expect(isDone(p, "l1-1")).toBe(true);
    expect(isDone(p, "l1-2")).toBe(false);
    expect(isDone(p, "l9-9")).toBe(false);
    expect(countDone(p, ["l1-1", "l1-2", "l1-3"])).toBe(1);
  });
});
