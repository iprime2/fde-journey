// Finds whose Claude export key this is (`/api/export`). Server-only.
//
// The one query on export_token without a user filter: the request carries a key, not a user, so
// the key's hash is what identifies the user. It is listed, word for word, as a reviewed statement
// in tests/unit/isolation-guard.test.ts. It returns the key's user id only, and only for a key
// that isn't revoked and belongs to an active user (the owner is always active). Everything the
// endpoint then reads goes through the scoped data layer with that id.
//
// It also counts the request for the rate limit, in the same statement: a fixed window of one hour
// per key. A key over the limit still identifies its user, with `limited` set.
import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";

/** Requests per key per hour. Claude sessions need a handful. */
export const EXPORT_REQUESTS_PER_HOUR = 60;

export type KeyLookup = { userId: string; limited: boolean } | null;

export async function claimExportKey(db: Db, tokenHash: string): Promise<KeyLookup> {
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
  const result = (await db.execute(sql`update "export_token" t set "last_used_at" = now(), "window_start" = case when t."window_start" is null or t."window_start" < now() - interval '1 hour' then now() else t."window_start" end, "window_count" = case when t."window_start" is null or t."window_start" < now() - interval '1 hour' then 1 else t."window_count" + 1 end from "user" u where t."token_hash" = ${tokenHash} and t."revoked_at" is null and u."id" = t."user_id" and u."status" = 'active' returning t."user_id", t."window_count"`)) as unknown as {
    rows: { user_id: string; window_count: number | string }[];
  };
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.user_id, limited: Number(row.window_count) > EXPORT_REQUESTS_PER_HOUR };
}
