// Data for pages (the data access layer). Server-only. Every read takes the signed-in user from
// the server session (requireUser) and reads only that user's rows.
import "server-only";
import { cache } from "react";
import { getDb } from "@/db/client";
import type { ProgressMap } from "./progress";
import { readProgress } from "./progress-db";
import { withSafeErrors } from "./safe-log";
import { requireUser } from "./session";

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
export const getProgress = cache(async (): Promise<ProgressMap> => progressFor(await requireUser()));
