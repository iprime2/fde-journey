// Server-only: the current time and today's date in India Standard Time, read at request time.
import { connection } from "next/server";
import { cache } from "react";
import { istDate } from "./dates";

/**
 * The current time at request time (epoch ms), for "Today", "Yesterday" and the like. Waits for the
 * incoming request (Cache Components never prerender the current time). Read ONCE per request
 * (React cache): every caller in one request, getTodayIst() and getInsights() included, sees the same
 * instant, so two parts of a page can't disagree across midnight IST. Callers sit inside a
 * <Suspense> boundary.
 */
export const getNowMs = cache(async (): Promise<number> => {
  await connection();
  return Date.now();
});

/** Today's date in IST, "YYYY-MM-DD", from the request's one clock reading (getNowMs). */
export async function getTodayIst(): Promise<string> {
  return istDate(await getNowMs());
}
