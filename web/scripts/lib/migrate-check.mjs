// Checks run by `npm run db:migrate` before it applies anything (scripts/db-migrate.mjs).
//
// Migration 0002 (progress per user) gives every existing progress row to the only user. The SQL
// itself checks there is exactly one user, but it can't read OWNER_GITHUB_ID, so it can't tell
// whether that user is the owner. This check can: when 0002 is still to be applied and progress
// has rows, it requires OWNER_GITHUB_ID and that the only user has the GitHub account with that
// id. Otherwise it refuses, before anything changes. Messages hold counts only, never ids or names.

export const OWNER_CHECK_MIGRATION = "0002_progress_per_user";
const GITHUB_ID = /^[1-9]\d{0,19}$/;

/**
 * @param {(text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>} query
 * @param {Record<string, string | undefined>} env
 * @param {{ entries: { tag: string, when: number }[] }} journal the migrations' meta/_journal.json
 * @returns {Promise<{ ok: true, checked: boolean } | { ok: false, reason: string }>}
 *   `checked` is true when the owner check ran (and passed).
 */
export async function checkBeforeMigrate(query, env, journal) {
  const entry = journal.entries.find((e) => e.tag === OWNER_CHECK_MIGRATION);
  if (!entry) return { ok: true, checked: false };

  const [{ present }] = await query("select to_regclass('drizzle.__drizzle_migrations') is not null as present");
  let lastApplied = null;
  if (present) {
    const [row] = await query("select max(created_at)::text as last from drizzle.__drizzle_migrations");
    lastApplied = row?.last == null ? null : Number(row.last);
  }
  // Drizzle applies every migration newer than the last one recorded.
  const pending = lastApplied === null || lastApplied < entry.when;
  if (!pending) return { ok: true, checked: false };

  const [{ exists }] = await query("select to_regclass('public.progress') is not null as exists");
  if (!exists) return { ok: true, checked: false };
  const [{ n: rows }] = await query("select count(*)::int as n from progress");
  if (rows === 0) return { ok: true, checked: false };

  const ownerId = env.OWNER_GITHUB_ID?.trim() ?? "";
  if (!GITHUB_ID.test(ownerId)) {
    return {
      ok: false,
      reason: `Migration ${OWNER_CHECK_MIGRATION} gives the ${rows} existing progress rows to the owner, so OWNER_GITHUB_ID must be set (the owner's numeric GitHub id). Nothing was changed.`,
    };
  }
  const [{ n: users }] = await query(`select count(*)::int as n from "user"`);
  if (users !== 1) {
    return {
      ok: false,
      reason: `Migration ${OWNER_CHECK_MIGRATION} gives the ${rows} existing progress rows to the only user, but there are ${users} users. Nothing was changed.`,
    };
  }
  const [{ n: owners }] = await query(
    `select count(*)::int as n from account a join "user" u on u.id = a.user_id where a.provider_id = 'github' and a.account_id = $1`,
    [ownerId],
  );
  if (owners !== 1) {
    return {
      ok: false,
      reason: `Migration ${OWNER_CHECK_MIGRATION} gives the ${rows} existing progress rows to the only user, but that user is not the owner (no GitHub account with OWNER_GITHUB_ID). Nothing was changed.`,
    };
  }
  return { ok: true, checked: true };
}
