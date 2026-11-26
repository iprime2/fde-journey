# M4a rollout: migration 0002 (progress per user)

Status: written 2026-11-26 by the backend engineer for the lead. Nothing here has been run against Neon. Rehearse on a Neon branch first, then production.

## What changes
- `progress` gets `user_id` (text, not null, references `user(id)` on delete cascade). The primary key becomes `(user_id, item_id)`. The four check constraints stay.
- New table `progress_event` (id, user_id, item_id, kind, at), indexed on `(user_id, at)`. It holds no note or link text.
- Existing rows are assigned to the only user. If `progress` has rows and there is not exactly one user, the migration stops and changes nothing.
- No new environment variables. `npm run db:import` now also reads `OWNER_GITHUB_ID`.

Expected in production today: 1 user, 12 progress rows, 2 applied migrations.

## Order of the release
Vercel deploys `main` automatically, so **merging the pull request is the deploy**. Run the migration on production first, then merge.

1. Rehearse on a Neon branch (below).
2. On production, when the owner isn't using the app: take a backup branch, run the "Before" queries (required, right before applying; stop if any result differs from what is expected), then apply the migration and run the "After" queries.
3. Merge the pull request straight after. Vercel deploys it.

Between steps 2 and 3 the old code still reads, but its saves fail with the usual "That change wasn't saved" message: it upserts on `item_id` alone and doesn't send `user_id`.

**If the code ships first** (the pull request is merged before the migration runs), every signed-in page errors (`column "user_id" does not exist`) until the migration runs. No data is lost: run the migration, and the pages work again without a redeploy.

## Option A: `npm run db:migrate`
`DATABASE_URL=<production URL> OWNER_GITHUB_ID=<owner's numeric GitHub id> npm run db:migrate` applies exactly this, in one transaction, and records it.

Before migrating, it checks that the only user is the owner (`scripts/lib/migrate-check.mjs`): while 0002 is still to be applied and `progress` has rows, it needs `OWNER_GITHUB_ID`, and that the single user has the GitHub account with that id. Otherwise it prints `Migration refused: …`, exits with code 2 and changes nothing. On success it prints `Owner check passed: the only user is the owner.` then `Migrations: 1 applied now, 3 in total.`

Option B does not run this check, so with option B the "Before" queries 1 and 2 are the owner check: don't apply unless they give exactly 12 rows, 1 user and 1 owner.

## Option B: the Neon tools, by hand
Run these as **one transaction** (for example `run_sql_transaction`), in this order. Statement 3 is a single `DO` block: pass it as one statement.

```sql
-- 1
CREATE TABLE "progress_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "progress_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_event_kind" CHECK ("progress_event"."kind" IN ('done', 'undone', 'note', 'link')),
	CONSTRAINT "progress_event_item_id_length" CHECK (char_length("progress_event"."item_id") <= 64)
);
-- 2
ALTER TABLE "progress" ADD COLUMN "user_id" text;
-- 3
DO $$
DECLARE
	progress_rows bigint;
	user_count bigint;
BEGIN
	SELECT count(*) INTO progress_rows FROM "progress";
	IF progress_rows > 0 THEN
		SELECT count(*) INTO user_count FROM "user";
		IF user_count <> 1 THEN
			RAISE EXCEPTION 'Migration 0002 stopped: progress has % rows but there are % users. It assigns existing rows to the only user (the owner), so it needs exactly one. Nothing was changed.', progress_rows, user_count;
		END IF;
		UPDATE "progress" SET "user_id" = (SELECT "id" FROM "user");
	END IF;
END $$;
-- 4
ALTER TABLE "progress" ALTER COLUMN "user_id" SET NOT NULL;
-- 5
ALTER TABLE "progress" DROP CONSTRAINT "progress_pkey";
-- 6
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_item_id_pk" PRIMARY KEY("user_id","item_id");
-- 7
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
-- 8
ALTER TABLE "progress_event" ADD CONSTRAINT "progress_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
-- 9
CREATE INDEX "progress_event_user_at_idx" ON "progress_event" USING btree ("user_id","at");
-- 10: the record db:migrate would write (same transaction)
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
VALUES ('1cdb23685495524502a85b6470988268b991da96275259d2d80633795fa5f2cc', 1795673329674);
```

The record must match what `db:migrate` writes: `hash` is the SHA-256 of the file `db/migrations/0002_progress_per_user.sql`, byte for byte, and `created_at` is its `when` in `db/migrations/meta/_journal.json`. The hash above is for the file as written on 2026-11-26. **If the file changes in review, recompute it** (in `web/`):

```sh
node -e "const c=require('crypto'),fs=require('fs');console.log(c.createHash('sha256').update(fs.readFileSync('db/migrations/0002_progress_per_user.sql').toString()).digest('hex'))"
```

The migrator decides what to apply by `created_at` only, so a later `npm run db:migrate` will skip 0002 as long as this row is there.

## Rehearsal on a Neon branch
1. Create a branch from production (a copy of its data).
2. Run the "Before" queries on the branch and note the results. Stop if any differs from what is expected.
3. Apply option A (with the branch's URL) or option B on the branch.
4. Run the "After" queries. Compare.
5. Delete the branch when done.

These statements, the "Before" and "After" queries and the rollback were run on PGlite 0.6.0 (Postgres 19) with 1 made-up user and 12 made-up rows on 2026-11-26 (re-run after the review fixes): counts and the fingerprint matched before and after (the "After" queries ran in another session time zone), the rollback restored the 0001 state with the same fingerprint, and a fresh `migrate` re-applied 0002 afterwards.

On production, repeat the same steps right before applying (the "Before" queries are required there too, as the data may have changed since the rehearsal), after creating a branch from production as a backup point.

## Verification queries
They print counts, names and hashes only, never note or link text.

### Before
```sql
-- 1. Rows and users: expect 12 (or more, if the owner has saved since) and exactly 1.
SELECT (SELECT count(*) FROM progress) AS progress_rows, (SELECT count(*) FROM "user") AS users;
-- 2. That one user is the owner: expect 1. Replace <OWNER_GITHUB_ID> with the value from Vercel.
SELECT count(*) AS owners
FROM account a JOIN "user" u ON u.id = a.user_id
WHERE a.provider_id = 'github' AND a.account_id = '<OWNER_GITHUB_ID>';
-- 3. Applied migrations: expect 2 rows, created_at 1795654351646 and 1795660912022.
SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
-- 4. The old primary key's name: expect progress_pkey (statement 5 drops it by this name).
SELECT conname FROM pg_constraint WHERE conrelid = 'public.progress'::regclass AND contype = 'p';
-- 5. A fingerprint of the data (hashes only): note the value. Times are epoch seconds, so the
--    result doesn't depend on the session's time zone.
SELECT md5(string_agg(item_id || '|' || done::text || '|' || md5(note) || '|' || md5(link) || '|'
  || coalesce(extract(epoch FROM done_at)::text, '-') || '|' || extract(epoch FROM updated_at)::text, ',' ORDER BY item_id)) AS fingerprint
FROM progress;
```

### After
```sql
-- 1. Same row count (12), none without a user, all owned by the one user.
SELECT count(*) AS progress_rows,
       count(*) FILTER (WHERE user_id IS NULL) AS without_user,
       count(DISTINCT user_id) AS owners,
       bool_and(user_id = (SELECT id FROM "user")) AS all_owner
FROM progress;
-- 2. Same fingerprint as before (the query ignores user_id).
SELECT md5(string_agg(item_id || '|' || done::text || '|' || md5(note) || '|' || md5(link) || '|'
  || coalesce(extract(epoch FROM done_at)::text, '-') || '|' || extract(epoch FROM updated_at)::text, ',' ORDER BY item_id)) AS fingerprint
FROM progress;
-- 3. Primary key on (user_id, item_id): expect progress_user_id_item_id_pk | {user_id,item_id}.
SELECT c.conname, array_agg(a.attname ORDER BY k.n) AS columns
FROM pg_constraint c
CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, n)
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.conrelid = 'public.progress'::regclass AND c.contype = 'p'
GROUP BY c.conname;
-- 4. Check, key and foreign-key constraints on progress: expect exactly
--    progress_done_at, progress_link_https, progress_link_length, progress_note_length,
--    progress_user_id_item_id_pk, progress_user_id_user_id_fk.
--    (Filtered by type: Postgres 18 and later also list NOT NULL constraints here.)
SELECT conname FROM pg_constraint WHERE conrelid = 'public.progress'::regclass AND contype IN ('c', 'p', 'f') ORDER BY conname;
-- 5. user_id is not null: expect NO.
SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'progress' AND column_name = 'user_id';
-- 6. The event table: empty, with its index.
SELECT (SELECT count(*) FROM progress_event) AS events,
       (SELECT count(*) FROM pg_indexes WHERE indexname = 'progress_event_user_at_idx') AS index_present;
-- 7. Migrations: expect 3 rows, the last with created_at 1795673329674 and the hash above.
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
```

After the deploy, tick and untick one item in the app, then: `SELECT kind, count(*) FROM progress_event GROUP BY kind;` should show one `done` and one `undone`.

## If it fails
- **`db:migrate` refuses** (the owner check): nothing was run. Check the "Before" queries and `OWNER_GITHUB_ID`.
- **The migration stops** (wrong user count, or `progress_pkey` has another name): the transaction rolls back by itself and nothing changes. Check the "Before" queries, fix the cause, and run it again.
- **After applying, before merging**: the old app still reads, but saves fail. Either merge M4a or roll back as below.
- **Merged before migrating**: signed-in pages error until the migration runs; no data is lost. Run the migration.

## Rollback
Only while there is one user (M4a keeps sign-in owner-only, so this holds until M4b). Event history recorded since the release is lost.
1. Roll the app back to the previous deployment in Vercel (instant rollback; revert the merge on `main` afterwards so the next push doesn't redeploy M4a). Reads keep working against the new schema; saves fail until step 2.
2. Run in one transaction:
   ```sql
   DROP TABLE "progress_event";
   ALTER TABLE "progress" DROP CONSTRAINT "progress_user_id_user_id_fk";
   ALTER TABLE "progress" DROP CONSTRAINT "progress_user_id_item_id_pk";
   ALTER TABLE "progress" DROP COLUMN "user_id";
   ALTER TABLE "progress" ADD CONSTRAINT "progress_pkey" PRIMARY KEY ("item_id");
   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795673329674;
   ```
   Adding `progress_pkey` back fails (and the whole rollback with it) if two rows share an item id, which can only happen once a second user has saved progress.
3. Run the "Before" queries: 12 rows (plus any saved since), 2 migrations, the same fingerprint if nothing was saved in between.
4. Last resort: restore from the backup branch taken before the migration, or Neon's point-in-time restore within the plan's history window (check the current limit in the Neon console).
