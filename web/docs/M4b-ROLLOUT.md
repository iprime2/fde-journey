# M4b rollout: migration 0003 (sign-up, waitlist, admin, settings, export keys)

Status: written 2026-11-26 by the backend engineer for the lead. Nothing here has been run against Neon. Rehearse on a Neon branch first, then production.

## What changes
- `user` gets five columns: `github_login` (refreshed at every sign-in), `status` (`active`, `waitlisted` or `suspended`; default `active`, so every existing user keeps their place), `activated_at` (set to `created_at` for existing users), `waitlisted_at` and `last_active_at`. Two check constraints (`user_status`, `user_github_login`) and two indexes.
- New tables:
  - `user_permission` (admin permissions; primary key `(user_id, permission)`),
  - `app_setting` (seeded with `user_cap = 100`; later also the Scaler access code's hash),
  - `admin_audit` (who did what to whom; user ids set to null when a user is deleted),
  - `user_settings` (sections and the Scaler unlock, one row per user),
  - `export_token` (Claude export keys, SHA-256 hash only).
- The owner's `user_settings` row: every section on, Scaler unlocked. SQL can't read `OWNER_GITHUB_ID`, so the migration adds it only when there is exactly one user (sign-in has been owner-only until now). With any other number of users it adds nothing, and the row is made at the owner's next sign-in.
- `github_login` stays empty for the owner until their next sign-in.
- No data is changed or removed in `progress`, `progress_event`, `session`, `account` or `verification`.

## Release notes (what changes for people)
With `SIGNUP_MODE` unset (this release), only the owner can sign in, as before. For the owner:
- **Settings** (`/settings`): section switches, "Download my data", Claude export keys. The owner's account can't be deleted there.
- **Admin** (`/admin`): overview, users, waitlist, sign-up (the cap and the Scaler access code), admins, audit log.
- **Hidden sections are not found.** A section switched off in Settings leaves the navigation and Home, and its page (`/reading`, `/certs`, `/projects`, `/career`) shows the not-found page until it is switched back on. Its progress is kept. Roadmap can't be hidden.
- **Scaler is locked until unlocked.** For everyone but the owner, `/scaler` is not found until the user enters the Scaler access code in Settings. While it is locked, the server also refuses ticks, notes and links on Scaler items, and "Download my data" and `/api/export` leave Scaler items out. The owner always has Scaler.
- **Claude export** (`/api/export`) needs a key made in Settings (one user's data per key).

New environment variable: `SIGNUP_MODE` (empty by default, which keeps sign-in owner-only; see "Switching on capped sign-up"). Nothing to set for this release.

Expected in production today: 1 user (the owner), 3 applied migrations, and the owner's progress rows (12 at M4a's release, more if saved since).

## Order of the release
Vercel deploys `main` automatically, so **merging the pull request is the deploy**. Run the migration on production first, then merge.

1. Rehearse on a Neon branch (below).
2. On production, when the owner isn't using the app: take a backup branch, run the "Before" queries (required, right before applying; stop if any result differs from what is expected), then apply the migration and run the "After" queries.
3. Merge the pull request straight after. Vercel deploys it.
4. Sign in once as the owner, then run the "After the first sign-in" query.

Between steps 2 and 3 the old code keeps working: it never reads the new columns or tables, and the owner's user row already has the defaults it would need (`status = 'active'`).

**If the code ships first** (merged before the migration runs), every signed-in page and sign-in itself fail (`column "status" does not exist`) until the migration runs. No data is lost: run the migration and the app works again without a redeploy.

## Option A: `npm run db:migrate`
`DATABASE_URL=<production URL> OWNER_GITHUB_ID=<owner's numeric GitHub id> npm run db:migrate` applies exactly this, in one transaction, and records it.

Before migrating, it checks the owner (`scripts/lib/migrate-check.mjs`): while 0003 is still to be applied and there is exactly one user, it needs `OWNER_GITHUB_ID`, and that user must have the GitHub account with that id (it gets the owner's settings). Otherwise it prints `Migration refused: …`, exits with code 2 and changes nothing. On success it prints `Owner check passed: the only user is the owner.` then `Migrations: 1 applied now, 4 in total.`

Option B does not run this check, so with option B the "Before" queries 1 and 2 are the owner check: don't apply unless they give exactly 1 user and 1 owner.

## Option B: the Neon tools, by hand
Run these as **one transaction** (for example `run_sql_transaction`), in this order. They are the statements of `db/migrations/0003_m4b_signup_admin.sql`, split at each `--> statement-breakpoint`. Statement 28 is a single `DO` block: pass it as one statement.

```sql
-- 1
CREATE TABLE "admin_audit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_user_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_action" CHECK ("admin_audit"."action" IN ('let_in', 'let_in_many', 'waitlist_removed', 'suspended', 'reactivated', 'reactivated_to_waitlist', 'cap_changed', 'admin_added', 'permissions_changed', 'admin_removed', 'scaler_code_set', 'scaler_code_failed', 'account_deleted')),
	CONSTRAINT "admin_audit_details_object" CHECK (jsonb_typeof("admin_audit"."details") = 'object')
);
-- 2
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_setting_key" CHECK ("app_setting"."key" IN ('user_cap', 'scaler_code_hash')),
	CONSTRAINT "app_setting_user_cap" CHECK (CASE WHEN "app_setting"."key" <> 'user_cap' THEN true WHEN "app_setting"."value" !~ '^[0-9]{1,4}$' THEN false ELSE "app_setting"."value"::int <= 1000 END),
	CONSTRAINT "app_setting_value_length" CHECK (char_length("app_setting"."value") <= 512)
);
-- 3
CREATE TABLE "export_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"window_start" timestamp with time zone,
	"window_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "export_token_hash_format" CHECK ("export_token"."token_hash" ~ '^[0-9a-f]{64}$')
);
-- 4
CREATE TABLE "user_permission" (
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permission_user_id_permission_pk" PRIMARY KEY("user_id","permission"),
	CONSTRAINT "user_permission_permission" CHECK ("user_permission"."permission" IN ('metrics.view', 'users.view', 'users.manage', 'waitlist.manage', 'settings.manage', 'admins.manage', 'audit.view'))
);
-- 5
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"show_reading" boolean DEFAULT true NOT NULL,
	"show_scaler" boolean DEFAULT false NOT NULL,
	"show_certs" boolean DEFAULT true NOT NULL,
	"show_projects" boolean DEFAULT false NOT NULL,
	"show_career" boolean DEFAULT false NOT NULL,
	"scaler_unlocked_at" timestamp with time zone,
	"scaler_attempts" integer DEFAULT 0 NOT NULL,
	"scaler_attempts_since" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_scaler_unlocked" CHECK (NOT "user_settings"."show_scaler" OR "user_settings"."scaler_unlocked_at" IS NOT NULL),
	CONSTRAINT "user_settings_scaler_attempts" CHECK ("user_settings"."scaler_attempts" >= 0)
);
-- 6
ALTER TABLE "user" ADD COLUMN "github_login" text;
-- 7
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;
-- 8
ALTER TABLE "user" ADD COLUMN "activated_at" timestamp with time zone;
-- 9
ALTER TABLE "user" ADD COLUMN "waitlisted_at" timestamp with time zone;
-- 10
ALTER TABLE "user" ADD COLUMN "last_active_at" timestamp with time zone;
-- 11
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
-- 12
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
-- 13
ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
-- 14
ALTER TABLE "export_token" ADD CONSTRAINT "export_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
-- 15
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
-- 16
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
-- 17
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
-- 18
CREATE INDEX "admin_audit_at_idx" ON "admin_audit" USING btree ("at");
-- 19
CREATE INDEX "admin_audit_action_at_idx" ON "admin_audit" USING btree ("action","at");
-- 20
CREATE UNIQUE INDEX "export_token_hash_idx" ON "export_token" USING btree ("token_hash");
-- 21
CREATE INDEX "export_token_user_idx" ON "export_token" USING btree ("user_id");
-- 22
CREATE INDEX "user_status_waitlisted_idx" ON "user" USING btree ("status","waitlisted_at");
-- 23
CREATE INDEX "user_github_login_idx" ON "user" USING btree (lower("github_login"));
-- 24
ALTER TABLE "user" ADD CONSTRAINT "user_status" CHECK ("user"."status" IN ('active', 'waitlisted', 'suspended'));
-- 25
ALTER TABLE "user" ADD CONSTRAINT "user_github_login" CHECK ("user"."github_login" IS NULL OR "user"."github_login" ~ '^[A-Za-z0-9-]{1,39}$');
-- 26
UPDATE "user" SET "activated_at" = "created_at" WHERE "status" = 'active' AND "activated_at" IS NULL;
-- 27
INSERT INTO "app_setting" ("key", "value") VALUES ('user_cap', '100');
-- 28
DO $$
BEGIN
	IF (SELECT count(*) FROM "user") = 1 THEN
		INSERT INTO "user_settings" ("user_id", "show_reading", "show_scaler", "show_certs", "show_projects", "show_career", "scaler_unlocked_at")
		SELECT "id", true, true, true, true, true, now() FROM "user";
	END IF;
END $$;
-- 29: the record db:migrate would write (same transaction)
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
VALUES ('6a19cd9d8dc20e5f492359d575d894758ecae475618060b8cbc95f53180c1043', 1795680699243);
```

The record must match what `db:migrate` writes: `hash` is the SHA-256 of the file `db/migrations/0003_m4b_signup_admin.sql`, byte for byte, and `created_at` is its `when` in `db/migrations/meta/_journal.json`. The hash above is for the file as written on 2026-11-26. **If the file changes in review, recompute it and regenerate the statements above** (in `web/`):

```sh
node -e "const c=require('crypto'),fs=require('fs');console.log(c.createHash('sha256').update(fs.readFileSync('db/migrations/0003_m4b_signup_admin.sql').toString()).digest('hex'))"
```

The migrator decides what to apply by `created_at` only, so a later `npm run db:migrate` will skip 0003 as long as this row is there.

## Rehearsal on a Neon branch
1. Create a branch from production (a copy of its data).
2. Run the "Before" queries on the branch and note the results. Stop if any differs from what is expected.
3. Apply option A (with the branch's URL) or option B on the branch.
4. Run the "After" queries. Compare.
5. Optionally, point a local `npm run dev` at the branch (`DATABASE_URL`) and sign in as the owner: Home and every section should look exactly as before.
6. **Capped mode on the branch** (this is where the cap lock meets a real Postgres server; the unit tests run on PGlite, which is one connection). Run `npm run dev` locally with `DATABASE_URL=<branch URL>`, `SIGNUP_MODE=capped`, and a GitHub OAuth app whose callback is `http://localhost:3000/api/auth/callback/github`:
   1. As the owner, on Admin > Sign-up, save the cap at the number of places taken (0 while you are the only user), so the next sign-up must wait.
   2. In a private window, sign in with a second GitHub test account: it lands on `/waitlist`, place 1.
   3. As the owner, Admin > Waitlist: "Let in" the test account (with no free place you get "All places are taken"; raise the cap by one first). Its next page load goes to Home.
   4. Admin > Users: suspend the test account (its window goes to `/login` on the next page load), then reactivate it.
   5. Run on the branch, and check the rows (counts and actions only):
      ```text
      SELECT action, details FROM admin_audit ORDER BY id;
      -- expect, in order: cap_changed ({"from": 100, "to": …}), let_in (or cap_changed with "admitted": 1), suspended, reactivated
      SELECT status, count(*) FROM "user" GROUP BY status;
      -- expect active 2
      ```
   6. Delete the test account from its own Settings (type its GitHub username), and check that `admin_audit` gained an `account_deleted` row and the earlier rows now have no target.
7. Delete the branch when done.

These statements, the "Before" and "After" queries and the rollback were run on PGlite 0.6.0 with 1 made-up owner and 12 made-up progress rows on 2026-11-26: option B applied in one transaction, the "After" queries gave the expected results, the fingerprint matched before and after, a following `migrate` applied nothing, the rollback restored the 0002 state with the same fingerprint, and a fresh `migrate` re-applied 0003 afterwards.

On production, repeat the same steps right before applying (the "Before" queries are required there too, as the data may have changed since the rehearsal), after creating a branch from production as a backup point.

## Verification queries
They print counts, names and hashes only, never note or link text, emails or ids.

### Before
```sql
-- 1. Users: expect exactly 1.
SELECT count(*) AS users FROM "user";
-- 2. That one user is the owner: expect 1. Replace <OWNER_GITHUB_ID> with the value from Vercel.
SELECT count(*) AS owners
FROM account a JOIN "user" u ON u.id = a.user_id
WHERE a.provider_id = 'github' AND a.account_id = '<OWNER_GITHUB_ID>';
-- 3. Applied migrations: expect 3 rows, created_at 1795654351646, 1795660912022 and 1795673329674.
SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
-- 4. None of the new tables or columns exist yet: expect 0 and 0.
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'
          AND table_name IN ('user_permission', 'app_setting', 'admin_audit', 'user_settings', 'export_token')) AS new_tables,
       (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user'
          AND column_name IN ('github_login', 'status', 'activated_at', 'waitlisted_at', 'last_active_at')) AS new_columns;
-- 5. A fingerprint of the progress data (hashes only): note the value and the row count.
SELECT count(*) AS progress_rows,
       md5(string_agg(user_id || '|' || item_id || '|' || done::text || '|' || md5(note) || '|' || md5(link) || '|'
         || coalesce(extract(epoch FROM done_at)::text, '-') || '|' || extract(epoch FROM updated_at)::text, ',' ORDER BY user_id, item_id)) AS fingerprint
FROM progress;
```

### After
```sql
-- 1. Same progress rows and fingerprint as before.
SELECT count(*) AS progress_rows,
       md5(string_agg(user_id || '|' || item_id || '|' || done::text || '|' || md5(note) || '|' || md5(link) || '|'
         || coalesce(extract(epoch FROM done_at)::text, '-') || '|' || extract(epoch FROM updated_at)::text, ',' ORDER BY user_id, item_id)) AS fingerprint
FROM progress;
-- 2. Every user is active, with activated_at = created_at: expect 1 | 1 | 1.
SELECT count(*) AS users,
       count(*) FILTER (WHERE status = 'active') AS active,
       count(*) FILTER (WHERE activated_at = created_at) AS activated_at_sign_up
FROM "user";
-- 3. The cap: expect exactly one row, user_cap | 100.
SELECT key, value FROM app_setting ORDER BY key;
-- 4. The owner's settings: expect 1 row, all t, unlocked t.
SELECT count(*) AS rows, bool_and(show_reading AND show_scaler AND show_certs AND show_projects AND show_career) AS all_on,
       bool_and(scaler_unlocked_at IS NOT NULL) AS unlocked
FROM user_settings;
-- 5. The settings row belongs to the owner: expect 1. Replace <OWNER_GITHUB_ID>.
SELECT count(*) AS owner_settings
FROM user_settings s JOIN account a ON a.user_id = s.user_id
WHERE a.provider_id = 'github' AND a.account_id = '<OWNER_GITHUB_ID>';
-- 6. The other new tables are empty: expect 0 | 0 | 0.
SELECT (SELECT count(*) FROM user_permission) AS permissions,
       (SELECT count(*) FROM admin_audit) AS audit,
       (SELECT count(*) FROM export_token) AS export_keys;
-- 7. Constraints on the new tables and on "user" (check, key, foreign key): expect exactly
--    admin_audit_action, admin_audit_actor_user_id_user_id_fk, admin_audit_details_object, admin_audit_pkey,
--    admin_audit_target_user_id_user_id_fk, app_setting_key, app_setting_pkey, app_setting_updated_by_user_id_fk,
--    app_setting_user_cap, app_setting_value_length, export_token_hash_format, export_token_pkey,
--    export_token_user_id_user_id_fk, user_email_unique, user_github_login, user_permission_granted_by_user_id_fk,
--    user_permission_permission, user_permission_user_id_permission_pk, user_permission_user_id_user_id_fk,
--    user_pkey, user_settings_pkey, user_settings_scaler_attempts, user_settings_scaler_unlocked,
--    user_settings_user_id_user_id_fk, user_status
--    (Filtered by type: Postgres 18 and later also list NOT NULL constraints here.)
SELECT conname FROM pg_constraint
WHERE conrelid IN ('public.user'::regclass, 'public.user_permission'::regclass, 'public.app_setting'::regclass,
                   'public.admin_audit'::regclass, 'public.user_settings'::regclass, 'public.export_token'::regclass)
  AND contype IN ('c', 'p', 'f', 'u')
ORDER BY conname;
-- 8. The new indexes: expect 6.
SELECT count(*) AS indexes FROM pg_indexes
WHERE indexname IN ('admin_audit_at_idx', 'admin_audit_action_at_idx', 'export_token_hash_idx', 'export_token_user_idx',
                    'user_status_waitlisted_idx', 'user_github_login_idx');
-- 9. Migrations: expect 4 rows, the last with created_at 1795680699243 and the hash above.
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
```

### After the first sign-in (step 4 of the release)
```sql
-- The owner's GitHub username is now stored, and the sign-in counted as activity: expect 1 | 1.
SELECT count(*) FILTER (WHERE github_login IS NOT NULL) AS with_login,
       count(*) FILTER (WHERE last_active_at IS NOT NULL) AS active
FROM "user";
```

## If it fails
- **`db:migrate` refuses** (the owner check): nothing was run. Check the "Before" queries and `OWNER_GITHUB_ID`.
- **The migration stops** (an error part-way): the transaction rolls back by itself and nothing changes. Check the "Before" queries, fix the cause, and run it again.
- **After applying, before merging**: the old app works unchanged. Either merge M4b or roll back as below.
- **Merged before migrating**: sign-in and signed-in pages fail until the migration runs; no data is lost. Run the migration.

## Rollback
Safe while `SIGNUP_MODE` has never been `capped` in production (then the owner is the only user, and the new tables hold only the owner's settings, export keys, any audit rows and the cap). Anything stored in the new tables and columns since the release is lost: section choices, export keys (Claude sessions need a new key after a later re-release), the audit log and the Scaler access code.
1. Roll the app back to the previous deployment in Vercel (instant rollback; revert the merge on `main` afterwards so the next push doesn't redeploy M4b). The old app works against the new schema.
2. Run in one transaction:
   ```sql
   DROP TABLE "export_token";
   DROP TABLE "user_settings";
   DROP TABLE "admin_audit";
   DROP TABLE "app_setting";
   DROP TABLE "user_permission";
   DROP INDEX "user_github_login_idx";
   DROP INDEX "user_status_waitlisted_idx";
   ALTER TABLE "user" DROP CONSTRAINT "user_status";
   ALTER TABLE "user" DROP CONSTRAINT "user_github_login";
   ALTER TABLE "user" DROP COLUMN "github_login", DROP COLUMN "status", DROP COLUMN "activated_at", DROP COLUMN "waitlisted_at", DROP COLUMN "last_active_at";
   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795680699243;
   ```
3. Run the "Before" queries: 1 user, the owner, 3 migrations, no new tables or columns, the same progress fingerprint if nothing was saved in between.
4. Last resort: restore from the backup branch taken before the migration, or Neon's point-in-time restore within the plan's history window (check the current limit in the Neon console).

If `capped` was ever on, other users exist: don't drop the columns (the old owner-only code would then let nobody but the owner in anyway, and their sessions are revoked). Roll the app back only, and fix forward.

## Switching on capped sign-up (after the release, not part of it)
The release keeps sign-in owner-only: nothing changes for anyone until `SIGNUP_MODE=capped` is set.
1. Try it first away from production: locally (`SIGNUP_MODE=capped npm run dev`, with a GitHub OAuth app whose callback is `http://localhost:3000/api/auth/callback/github`), signing in with a second GitHub account. Check: a place under the cap, the waitlist once the cap is reached (set it low on the admin Sign-up page), suspend and reactivate, delete the account.
2. Set the Scaler access code on the admin Sign-up page before inviting Scaler learners.
3. In Vercel, set `SIGNUP_MODE=capped` for Production and redeploy. Change `ACCESS_MODE` in `lib/login.ts` to `"capped"` in the same release, so the sign-in page's wording matches.
4. To switch it off again: clear `SIGNUP_MODE` and redeploy. Everyone but the owner is then signed out on their next request; their data stays.
