import { describe, expect, it } from "vitest";
import { SAVE_FAILED_BANNER, signedOutBanner, pickBanners, READ_ONLY_BANNER, OFFLINE_BANNER } from "@/lib/banners";
import { msUntilNextIstMidnight } from "@/lib/dates";
import {
  SESSION_REFRESH_INTERVAL_MS,
  combineStatus,
  isRefreshDue,
  noteButtonLabel,
  parseTimestamp,
  statusText,
} from "@/lib/save-state";

const at = (isoUtc: string) => Date.parse(isoUtc);

describe("next midnight in India", () => {
  it("is when 18:30 UTC comes round", () => {
    expect(msUntilNextIstMidnight(at("2026-11-30T18:29:59.000Z"))).toBe(1_000);
    expect(msUntilNextIstMidnight(at("2026-11-30T12:30:00.000Z"))).toBe(6 * 3_600_000);
  });

  it("is a full day away exactly at midnight IST", () => {
    expect(msUntilNextIstMidnight(at("2026-11-30T18:30:00.000Z"))).toBe(86_400_000);
  });

  it("works across the UTC date line and the year end", () => {
    // 23:00 UTC on 31 Dec is already 04:30 on 1 Jan in India: 19.5 hours to go.
    expect(msUntilNextIstMidnight(at("2026-12-31T23:00:00.000Z"))).toBe(19.5 * 3_600_000);
    expect(msUntilNextIstMidnight(at("2027-01-01T00:00:00.001Z"))).toBe(18.5 * 3_600_000 - 1);
  });
});

describe("save status", () => {
  it("shows a failure first, then saving, then saved", () => {
    expect(combineStatus(["saved", "error"])).toBe("error");
    expect(combineStatus(["saving", "saved"])).toBe("saving");
    expect(combineStatus(["idle", "saved"])).toBe("saved");
    expect(combineStatus([])).toBe("idle");
  });

  it("uses the spec's words", () => {
    expect(statusText("saving")).toBe("Saving…");
    expect(statusText("saved")).toBe("Saved");
    expect(statusText("error")).toBe("Not saved");
    expect(statusText("idle")).toBe("");
  });

  it("labels the note button", () => {
    expect(noteButtonLabel(false, false)).toBe("Add note");
    expect(noteButtonLabel(false, true)).toBe("Edit note");
    expect(noteButtonLabel(true, true)).toBe("Hide note");
    expect(noteButtonLabel(true, false)).toBe("Hide note");
  });
});

describe("banners for saving", () => {
  it("put errors first and send Sign in back to the page", () => {
    const signedOut = signedOutBanner("/login?next=%2Froadmap");
    expect(signedOut.action).toEqual({ label: "Sign in", href: "/login?next=%2Froadmap" });
    expect(pickBanners([READ_ONLY_BANNER, OFFLINE_BANNER, SAVE_FAILED_BANNER, signedOut]).map((b) => b.id)).toEqual([
      "save-failed",
      "signed-out",
    ]);
  });
});

describe("daily sign-in renewal", () => {
  const now = at("2026-11-26T10:00:00Z");

  it("reads only plain stored timestamps", () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("-5")).toBeNull();
    expect(parseTimestamp("1.5")).toBeNull();
    expect(parseTimestamp(String(now))).toBe(now);
  });

  it("is due when never done or a day has passed", () => {
    expect(isRefreshDue(null, now)).toBe(true);
    expect(isRefreshDue(now - SESSION_REFRESH_INTERVAL_MS, now)).toBe(true);
    expect(isRefreshDue(now - SESSION_REFRESH_INTERVAL_MS + 1, now)).toBe(false);
    expect(isRefreshDue(now - 60_000, now)).toBe(false);
  });

  it("is due when the stored time is in the future (a changed clock)", () => {
    expect(isRefreshDue(now + 60_000, now)).toBe(true);
  });
});
