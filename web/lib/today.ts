// Server-only: today's date in India Standard Time, read at request time.
import { connection } from "next/server";
import { istDate } from "./dates";

/**
 * Waits for the incoming request (Cache Components never prerender the current time), then
 * returns today's IST date as "YYYY-MM-DD". Callers sit inside a <Suspense> boundary.
 */
export async function getTodayIst(): Promise<string> {
  await connection();
  return istDate(Date.now());
}

/** The current time at request time (epoch ms), for "Today", "Yesterday" and the like. */
export async function getNowMs(): Promise<number> {
  await connection();
  return Date.now();
}
