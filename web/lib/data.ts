// Data for pages (the data access layer). Server-only. Every read takes the signed-in user from
// the server session (requireUser) and reads only that user's rows.
import "server-only";
import { cache } from "react";
import { COURSES } from "@/content/courses";
import { trackerContent } from "@/content/tracker-data";
import { getDb } from "@/db/client";
import { type Insights, activityWindowStart, computeInsights, monthStart } from "./insights";
import type { ProgressMap } from "./progress";
import { readInsightRows, readProgress } from "./progress-db";
import { withSafeErrors } from "./safe-log";
import { requireUser } from "./session";
import { getMySettings } from "./settings";
import { getNowMs } from "./today";

/**
 * One user's progress, memoised per request and per user id. A failed read throws a SafeError:
 * the database error would quote the query's parameters in the server log.
 */
const progressFor = cache(
  async (userId: string): Promise<ProgressMap> => withSafeErrors("Reading progress", async () => readProgress(userId, await getDb())),
);

/**
 * The signed-in user's saved progress, keyed by item id. Redirects to /login when nobody is signed
 * in. Request-time data: call it inside a <Suspense> boundary. Memoised per request, so the seven
 * or so callers on one page share a single database read.
 */
export const getProgress = cache(async (): Promise<ProgressMap> => progressFor((await requireUser()).userId));

/**
 * The signed-in user's Insights (M5a; lib/insights.ts has the rules). Redirects as requireUser()
 * does: signed out to /login, waitlisted to /waitlist. One round of queries, all scoped to the
 * session user: their done items, their saves in the 26-week window counted per item and IST day,
 * the items they noted this month (ids, times and counts only, never note or link text), and their
 * section settings through getMySettings(), the per-request read the navigation shares. The time is
 * the request's one clock reading (getNowMs). `settings` in the result is what the numbers used.
 * Request-time data: call it inside a <Suspense> boundary. Memoised per request.
 */
export const getInsights = cache(async (): Promise<Insights> => {
  const me = await requireUser();
  const nowMs = await getNowMs();
  const window = { since: activityWindowStart(nowMs), notesSince: monthStart(nowMs) };
  const [rows, settings] = await Promise.all([
    withSafeErrors("Reading insights", async () => readInsightRows(me.userId, await getDb(), window)),
    getMySettings(),
  ]);
  return computeInsights({ nowMs, progress: rows.done, events: rows.events, notedItems: rows.notedItems, settings, content: trackerContent, courses: COURSES });
});
