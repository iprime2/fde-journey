// "Last active" for the admin counts (M4-DESIGN 10.4: active means signed in or saved anything).
// Server-only. Written at most once an hour per user, so a burst of saves costs one write.
import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { describeError } from "./safe-log";

/**
 * Marks the user as active now, unless that was already recorded in the last hour. Never fails the
 * caller: activity is a statistic, so a failure is logged (names and codes only) and ignored.
 */
export async function touchActivity(db: Db, userId: string): Promise<void> {
  try {
    await db.execute(sql`
      update "user" set "last_active_at" = now()
      where "id" = ${userId} and ("last_active_at" is null or "last_active_at" < now() - interval '1 hour')`);
  } catch (error) {
    console.error(`Recording activity failed (${describeError(error)})`);
  }
}
