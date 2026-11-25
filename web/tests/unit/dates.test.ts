import { describe, expect, it } from "vitest";
import { CLASS_SCHEDULE } from "@/content/schedule";
import {
  addDays,
  countdownLabel,
  daysBetween,
  daysLeftLabel,
  formatDate,
  formatDayMonth,
  formatRange,
  formatWeekdayDate,
  isInWeek,
  istClock,
  istDate,
  nextClassLabel,
} from "@/lib/dates";

const at = (isoUtc: string) => Date.parse(isoUtc);

describe("IST clock", () => {
  it("is UTC+05:30", () => {
    expect(istClock(at("2026-11-30T03:30:00Z"))).toEqual({ date: "2026-11-30", weekday: 1, minutes: 9 * 60 });
  });

  it("starts a new IST day at 18:30 UTC, before the UTC date changes", () => {
    expect(istDate(at("2026-11-30T18:29:59Z"))).toBe("2026-11-30");
    expect(istDate(at("2026-11-30T18:30:00Z"))).toBe("2026-12-01");
    expect(istClock(at("2026-11-30T18:30:00Z")).minutes).toBe(0);
  });

  it("crosses the year boundary in IST first", () => {
    expect(istDate(at("2026-12-31T18:30:00Z"))).toBe("2027-01-01");
  });
});

describe("date arithmetic and formats", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-11-25", "2027-02-15")).toBe(82);
    expect(daysBetween("2027-02-16", "2027-02-15")).toBe(-1);
  });

  it("formats like the tracker", () => {
    expect(formatDayMonth("2026-11-30")).toBe("30 Nov");
    expect(formatDate("2027-02-15")).toBe("15 Feb 2027");
    expect(formatWeekdayDate("2026-11-30")).toBe("Mon 30 Nov");
    expect(formatRange("2026-11-24", "2026-12-01")).toBe("24 Nov – 1 Dec 2026");
  });

  it("shows both years when a range crosses a year", () => {
    expect(formatRange("2026-12-23", "2027-01-05")).toBe("23 Dec 2026 – 5 Jan 2027");
  });

  it("knows which week a day falls in", () => {
    expect(isInWeek("2026-11-30", "2026-11-30")).toBe(true);
    expect(isInWeek("2026-12-06", "2026-11-30")).toBe(true);
    expect(isInWeek("2026-12-07", "2026-11-30")).toBe(false);
    expect(isInWeek("2026-11-29", "2026-11-30")).toBe(false);
  });
});

describe("next class (Mon, Wed, Fri, 09:00–11:30 IST)", () => {
  const label = (isoUtc: string) => nextClassLabel(at(isoUtc), CLASS_SCHEDULE);

  it("says today before 09:00 IST on a class day", () => {
    expect(label("2026-11-30T03:29:00Z")).toBe("Today, 09:00 IST"); // Mon 08:59 IST
  });

  it("says in class from 09:00 until 11:29 IST", () => {
    expect(label("2026-11-30T03:30:00Z")).toBe("In class now (until 11:30 IST)"); // 09:00
    expect(label("2026-11-30T05:59:00Z")).toBe("In class now (until 11:30 IST)"); // 11:29
  });

  it("moves on to the next class at 11:30 IST", () => {
    expect(label("2026-11-30T06:00:00Z")).toBe("Wed 2 Dec, 09:00 IST"); // Mon 11:30
  });

  it("uses the IST date, not the UTC date, around midnight", () => {
    // Sunday 20:00 UTC is already Monday 01:30 in India.
    expect(label("2026-11-29T20:00:00Z")).toBe("Today, 09:00 IST");
    // Sunday 18:29 UTC is still Sunday 23:59 in India.
    expect(label("2026-11-29T18:29:00Z")).toBe("Mon 30 Nov, 09:00 IST");
  });

  it("skips the weekend", () => {
    expect(label("2026-12-04T07:00:00Z")).toBe("Mon 7 Dec, 09:00 IST"); // Fri 12:30
    expect(label("2026-12-05T04:00:00Z")).toBe("Mon 7 Dec, 09:00 IST"); // Sat
  });
});

describe("readiness countdown", () => {
  it("counts the days left", () => {
    expect(countdownLabel("2026-11-25", "2027-02-15")).toBe("15 Feb 2027 · 82 days left");
    expect(countdownLabel("2027-02-14", "2027-02-15")).toBe("15 Feb 2027 · 1 day left");
  });

  it("says today on the day, then passed", () => {
    expect(countdownLabel("2027-02-15", "2027-02-15")).toBe("Today");
    expect(countdownLabel("2027-02-16", "2027-02-15")).toBe("15 Feb 2027 (passed)");
  });

  it("has a short form for the sidebar", () => {
    expect(daysLeftLabel("2026-11-25", "2027-02-15")).toBe("82 days left");
    expect(daysLeftLabel("2027-02-15", "2027-02-15")).toBe("today");
    expect(daysLeftLabel("2027-03-01", "2027-02-15")).toBe("passed");
  });
});
