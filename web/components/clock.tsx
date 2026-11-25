"use client";

// Values that depend on the current time: worked out in the browser in IST and refreshed every
// minute. The server render (and the first browser render) show "–" (design spec 4, Facts).
import { useSyncExternalStore } from "react";
import { CLASS_SCHEDULE, READINESS_REVIEW } from "@/content/schedule";
import { countdownLabel, daysLeftLabel, istDate, nextClassLabel } from "@/lib/dates";

const listeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  listeners.forEach((l) => l());
  timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (listeners.size === 1) {
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    document.addEventListener("visibilitychange", notifyAll);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", notifyAll);
    }
  };
}

function notifyAll() {
  listeners.forEach((l) => l());
}

/** The current minute (epoch ms, rounded down), or null before the browser has rendered. */
export function useCurrentMinute(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}

function Pending() {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="sr-only">Loading</span>
    </>
  );
}

export function NextClass() {
  const now = useCurrentMinute();
  return now === null ? <Pending /> : <>{nextClassLabel(now, CLASS_SCHEDULE)}</>;
}

export function Countdown() {
  const now = useCurrentMinute();
  return now === null ? <Pending /> : <>{countdownLabel(istDate(now), READINESS_REVIEW)}</>;
}

/** Sidebar footer: "82 days left". */
export function DaysLeft() {
  const now = useCurrentMinute();
  return now === null ? <Pending /> : <>{daysLeftLabel(istDate(now), READINESS_REVIEW)}</>;
}
