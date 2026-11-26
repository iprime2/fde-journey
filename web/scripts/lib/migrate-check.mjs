// Checks run by `npm run db:migrate` before it applies anything (scripts/db-migrate.mjs).
//
// Migration 0002 (progress per user) gives every existing progress row to the only user. The SQL
// itself checks there is exactly one user, but it can't read OWNER_GITHUB_ID, so it can't tell
// whether that user is the owner. This check can: when 0002 is still to be applied and progress
// has rows, it requires OWNER_GITHUB_ID and that the only user has the GitHub account with that
// id. Otherwise it refuses, before anything changes. Messages hold counts only, never ids or names.
//
// Migration 0003 (M4b) gives the only user, when there is exactly one, the owner's settings: every
// section on and Scaler unlocked. Same rule: when 0003 is still to be applied and there is exactly
// one user, that user must be the owner.

export const OWNER_CHECK_MIGRATION = "0002_progress_per_user";
export const SETTINGS_CHECK_MIGRATION = "0003_m4b_signup_admin";
const GITHUB_ID = /^[1-9]\d{0,19}$/;

/**
 * @param {(text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>} query
 * @returns {Promise<number | null>} created_at of the last applied migration, or null for none.
 */
async function lastAppliedAt(query) {
  const [{ present }] = await query("select to_regclass('drizzle.__drizzle_migrations') is not null as present");
  if (!present) return null;
  const [row] = await query("select max(created_at)::text as last from drizzle.__drizzle_migrations");
  return row?.last == null ? null : Number(row.last);
}

/** How many users have the owner's GitHub account. */
async function ownerAccounts(query, ownerId) {
  const [{ n }] = await query(
    `select count(*)::int as n from account a join "user" u on u.id = a.user_id where a.provider_id = 'github' and a.account_id = $1`,
    [ownerId],
  );
  return n;
}

/**
 * @param {(text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>} query
 * @param {Record<string, string | undefined>} env
 * @param {{ entries: { tag: string, when: number }[] }} journal the migrations' meta/_journal.json
 * @returns {Promise<{ ok: true, checked: boolean } | { ok: false, reason: string }>}
 *   `checked` is true when an owner check ran (and passed).
 */
export async function checkBeforeMigrate(query, env, journal) {
  const lastApplied = await lastAppliedAt(query);
  // Drizzle applies every migration newer than the last one recorded.
  const pending = (tag) => {
    const entry = journal.entries.find((e) => e.tag === tag);
    return !!entry && (lastApplied === null || lastApplied < entry.when);
  };
  const first = pending(OWNER_CHECK_MIGRATION) ? await checkProgressOwner(query, env) : { ok: true, checked: false };
  if (!first.ok) return first;
  const second = pending(SETTINGS_CHECK_MIGRATION) ? await checkSettingsOwner(query, env) : { ok: true, checked: false };
  if (!second.ok) return second;
  return { ok: true, checked: first.checked || second.checked };
}

/** Before 0003: with exactly one user, that user gets the owner's settings, so must be the owner. */
async function checkSettingsOwner(query, env) {
  const [{ exists }] = await query(`select to_regclass('public."user"') is not null as exists`);
  if (!exists) return { ok: true, checked: false };
  const [{ n: users }] = await query(`select count(*)::int as n from "user"`);
  if (users !== 1) return { ok: true, checked: false };
  const ownerId = env.OWNER_GITHUB_ID?.trim() ?? "";
  if (!GITHUB_ID.test(ownerId)) {
    return {
      ok: false,
      reason: `Migration ${SETTINGS_CHECK_MIGRATION} gives the only user the owner's settings, so OWNER_GITHUB_ID must be set (the owner's numeric GitHub id). Nothing was changed.`,
    };
  }
  if ((await ownerAccounts(query, ownerId)) !== 1) {
    return {
      ok: false,
      reason: `Migration ${SETTINGS_CHECK_MIGRATION} gives the only user the owner's settings, but that user is not the owner (no GitHub account with OWNER_GITHUB_ID). Nothing was changed.`,
    };
  }
  return { ok: true, checked: true };
}

/** Before 0002: the existing progress rows go to the only user, who must be the owner. */
async function checkProgressOwner(query, env) {
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
  if ((await ownerAccounts(query, ownerId)) !== 1) {
    return {
      ok: false,
      reason: `Migration ${OWNER_CHECK_MIGRATION} gives the ${rows} existing progress rows to the only user, but that user is not the owner (no GitHub account with OWNER_GITHUB_ID). Nothing was changed.`,
    };
  }
  return { ok: true, checked: true };
}
