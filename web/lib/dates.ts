// Dates for the journey, always worked out in India Standard Time (Asia/Kolkata), whatever time
// zone the server or browser runs in. IST is UTC+05:30 all year with no daylight saving, so a
// fixed offset is exact. Every function here is pure: pass the current time in as epoch ms.

export const TIME_ZONE = "Asia/Kolkata";

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface IstClock {
  /** Calendar date in IST, "YYYY-MM-DD". */
  date: string;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
  /** Minutes since midnight IST. */
  minutes: number;
}

/** What a wall clock in India shows at the given instant. */
export function istClock(nowMs: number): IstClock {
  const shifted = new Date(nowMs + IST_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Today's date in IST, "YYYY-MM-DD". */
export const istDate = (nowMs: number) => istClock(nowMs).date;

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const toIso = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (iso: string, days: number) => toIso(new Date(parseIso(iso).getTime() + days * DAY_MS));

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export const daysBetween = (fromIso: string, toIsoDate: string) =>
  Math.round((parseIso(toIsoDate).getTime() - parseIso(fromIso).getTime()) / DAY_MS);

/** "30 Nov" */
export function formatDayMonth(iso: string): string {
  const d = parseIso(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "15 Feb 2027" */
export const formatDate = (iso: string) => `${formatDayMonth(iso)} ${parseIso(iso).getUTCFullYear()}`;

/** "Mon 30 Nov" */
export const formatWeekdayDate = (iso: string) => `${WEEKDAYS[parseIso(iso).getUTCDay()]} ${formatDayMonth(iso)}`;

/** "24 Nov – 1 Dec 2026", or "23 Dec 2026 – 5 Jan 2027" when the range crosses a year. */
export function formatRange(startIso: string, endIso: string): string {
  const sameYear = parseIso(startIso).getUTCFullYear() === parseIso(endIso).getUTCFullYear();
  return `${sameYear ? formatDayMonth(startIso) : formatDate(startIso)} – ${formatDate(endIso)}`;
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export interface ClassSchedule {
  weekdays: readonly number[];
  startMinutes: number;
  endMinutes: number;
}

/**
 * "In class now (until 11:30 IST)", "Today, 09:00 IST" or "Mon 30 Nov, 09:00 IST".
 * A class has ended at its end minute exactly, so 11:30 already points at the next class.
 */
export function nextClassLabel(nowMs: number, schedule: ClassSchedule): string {
  const now = istClock(nowMs);
  for (let ahead = 0; ahead < 8; ahead++) {
    if (!schedule.weekdays.includes((now.weekday + ahead) % 7)) continue;
    if (ahead === 0) {
      if (now.minutes >= schedule.endMinutes) continue;
      if (now.minutes >= schedule.startMinutes) return `In class now (until ${hhmm(schedule.endMinutes)} IST)`;
      return `Today, ${hhmm(schedule.startMinutes)} IST`;
    }
    return `${formatWeekdayDate(addDays(now.date, ahead))}, ${hhmm(schedule.startMinutes)} IST`;
  }
  return "–";
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "15 Feb 2027 · 82 days left", "Today" or "15 Feb 2027 (passed)". */
export function countdownLabel(todayIso: string, targetIso: string): string {
  const days = daysBetween(todayIso, targetIso);
  if (days > 0) return `${formatDate(targetIso)} · ${plural(days, "day")} left`;
  if (days === 0) return "Today";
  return `${formatDate(targetIso)} (passed)`;
}

/** Short form for the sidebar: "82 days left", "today" or "passed". */
export function daysLeftLabel(todayIso: string, targetIso: string): string {
  const days = daysBetween(todayIso, targetIso);
  if (days > 0) return `${plural(days, "day")} left`;
  return days === 0 ? "today" : "passed";
}

/** True when `todayIso` falls in the seven days that start on `weekStartIso`. */
export function isInWeek(todayIso: string, weekStartIso: string): boolean {
  const d = daysBetween(weekStartIso, todayIso);
  return d >= 0 && d < 7;
}

/**
 * Milliseconds from `nowMs` until the next midnight in India (00:00 IST), when "today" changes.
 * Exactly at midnight it returns a full day.
 */
export function msUntilNextIstMidnight(nowMs: number): number {
  const sinceMidnight = (nowMs + IST_OFFSET_MS) % DAY_MS;
  return DAY_MS - sinceMidnight;
}
