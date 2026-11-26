// Data for pages (the data access layer). Server-only. Every read checks the owner first.
import "server-only";
import { cache } from "react";
import { getDb } from "@/db/client";
import type { ProgressMap } from "./progress";
import { readProgress } from "./progress-db";
import { requireOwner } from "./session";

/**
 * The owner's saved progress, keyed by item id. Redirects to /login when the visitor is not the
 * signed-in owner. Request-time data: call it inside a <Suspense> boundary. Memoised per request,
 * so the seven or so callers on one page share a single database read.
 */
export const getProgress = cache(async (): Promise<ProgressMap> => {
  await requireOwner();
  return readProgress(await getDb());
});
