"use client";

// "This phase", "This week", the current phase on Home and the readiness countdown depend on
// today's date in India. When a tab stays open past midnight IST, refresh the page data so they
// move on. Timers can sleep with the tab, so also check whenever the tab becomes visible again.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { istDate, msUntilNextIstMidnight } from "@/lib/dates";

/** A second after midnight, so the server is sure to see the new date. */
const MARGIN_MS = 1_000;

export function MidnightRefresh() {
  const router = useRouter();
  useEffect(() => {
    let today = istDate(Date.now());
    let timer: number | undefined;
    const checkDate = () => {
      const now = istDate(Date.now());
      if (now === today) return;
      today = now;
      router.refresh();
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        checkDate();
        schedule();
      }, msUntilNextIstMidnight(Date.now()) + MARGIN_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkDate();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
