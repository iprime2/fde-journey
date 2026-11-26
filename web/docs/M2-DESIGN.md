# M2 part A: database, sign-in, saving and import (design note)

Status: built 2026-11-26 by the backend engineer. Front-end wiring (tick boxes, note editor, sign-in page, banners) is M2 part B.

## Schema (`db/schema.ts`, migration `db/migrations/0000_init.sql`)
- `progress`: `item_id` text primary key, `done` boolean not null default false, `note` text not null default '', `link` text not null default '', `done_at` timestamptz null, `updated_at` timestamptz not null default now(). No user column: one owner. Check constraints repeat the server rules (note at most 10,000 characters, link at most 2,000 and empty or `https://`, `done_at` only when done) as a last line of defence.
- Better Auth's `user`, `session`, `account`, `verification`, with timestamptz columns, plus a unique index on `account (provider_id, account_id)` so one GitHub account maps to one user.

## Sign-in and the owner check
GitHub sign-in through Better Auth (`lib/auth.ts`, route `app/api/auth/[...all]/route.ts`). Only the account whose numeric GitHub id equals `OWNER_GITHUB_ID` gets in (logins can be renamed, ids cannot). Enforced three times:
1. `user.validateUserInfo` (`lib/owner.ts`) runs before Better Auth creates a user, links an account, and on every GitHub sign-in, with GitHub's fresh profile. Anyone else is sent to `/login?next=…&error=not_owner` and no user, account or session row is written (proved end to end in `tests/unit/auth-flow.test.ts` with a fake GitHub).
2. `databaseHooks.session.create.before` refuses a session for any user without the owner's GitHub account, whatever path asks.
3. `getOwnerSession()` (`lib/session.ts`) re-checks the account on every request, so changing `OWNER_GITHUB_ID` locks the old account out at once.

Also: account linking off, OAuth tokens encrypted at rest, unused Better Auth endpoints answer 404, telemetry off, 30-day sessions refreshed daily. Better Auth turns its origin/CSRF check off when `NODE_ENV=test`; it is forced on so tests cover it.

`proxy.ts` sends visitors without a session cookie to `/login?next=…` before any page renders (no flash of content). It only checks that the cookie exists, as the Next docs advise; the real check is in the data layer. `next` is validated by `safeNextPath()` (same-site paths only; no `//`, backslashes, control characters, `/login` or `/api/`). Server Action requests pass the proxy and get a typed `signed-out` result instead of a redirect.

`getOwnerSession()` reads the request headers before anything else. Otherwise, when it can answer early (no `OWNER_GITHUB_ID` at build time), Next prerenders the result into the static shell. That happened during this milestone and caused a hydration error; a unit test now guards it.

## Neon driver: `drizzle-orm/neon-http`
Each query is one HTTPS request: no connection to open, pool or leak across serverless invocations, and the fastest option for one-off queries on Vercel. It has no interactive transactions, which nothing here needs (each save is one upsert; Better Auth runs without transactions). `npm run db:migrate` uses Neon's WebSocket `Pool` instead, so all pending migrations apply in one transaction.

## Migrations
`npm run db:generate` (drizzle-kit) writes SQL from `db/schema.ts` into `db/migrations/`. Never edit a merged migration; add a new one. PGlite (local and tests) applies migrations automatically on first use. Neon: `DATABASE_URL=… npm run db:migrate` before deploying (M3).

## Local database
No `DATABASE_URL`: PGlite in `.data/pglite` (or `PGLITE_DIR`; gitignored), in memory under Vitest. Two processes must never open the same folder (stop `npm run dev` before `db:import`). On Vercel without `DATABASE_URL` the app refuses to start rather than use a throwaway database.

## Test sign-in for e2e
There is no test sign-in code in the app. `playwright.config.ts` creates a random secret and session token for each run, then starts the server with `node scripts/e2e-seed.mjs && next start`. The seed writes a made-up owner, their GitHub account (made-up id) and one session into a fresh `.data/pglite-e2e`. The fixtures send that session as a cookie signed with the run's secret, as Better Auth would after a real sign-in. `test.use({ signedIn: false })` opts out.
Safety (`scripts/lib/e2e-guard.mjs`, unit-tested): the seed refuses unless `E2E_AUTH=1`, `VERCEL` is unset, `DATABASE_URL` is unset, and `PGLITE_DIR` is a `pglite-e2e*` folder directly inside `web/.data/`. The app refuses `DATABASE_URL` while `E2E_AUTH` is set, and Playwright blanks `DATABASE_URL`, `VERCEL` and the GitHub credentials for the test server. A unit test checks that no app code reads the e2e token. In production the secret is unknown and the seed cannot write to Neon, so the mechanism cannot be used there.

## Import (`npm run db:import -- <file-or-folder> [--dry-run]`)
Input: a folder of `*.json` files (one record each; id from the `id` field or the file name, e.g. `l1-1.json`), or one file with a record or an array of records with ids. A record is `{done, note, link, doneAt, updatedAt}`, optionally wrapped as `{data: {...}, version}`. Ids are checked against the content (`lib/ids.ts`); unknown ids, malformed records and unreadable files are counted, not imported. Links that are not valid `https://` addresses are dropped (the tick and note still import). A record replaces a saved row only when its `updatedAt` is newer (missing timestamps fall back to `doneAt`, then 1970), so a second run changes nothing and app changes are never overwritten. Prints counts only. Keep exported files outside the repo; the script warns if the input is inside it.

## Environment variables (`.env.example`)
`BETTER_AUTH_SECRET` (required), `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OWNER_GITHUB_ID`, `DATABASE_URL` (required on Vercel), `PGLITE_DIR` (optional). Test runner only: `E2E_AUTH`, `E2E_SESSION_TOKEN`, `E2E_AUTH_SECRET`.

## What the front end calls
- Data: `getProgress()` from `@/lib/data` (now redirects non-owners to `/login`); `isReadOnly()` from `@/lib/mode` replaces `READ_ONLY_PREVIEW` (server-only and async: call it inside `<Suspense>` and pass `readOnly` down). Pure helpers and types stay in `@/lib/progress`.
- Saving (`@/app/actions/progress`): `toggleDone(itemId, done)`, `saveNote(itemId, note)`, `saveLink(itemId, link)`, `saveJournal(note)`. Each returns `SaveResult` (`@/lib/save-result`): `{ ok: true, record }` or `{ ok: false, error }`, where `error.code` is `signed-out` (show the "signed out" banner), `invalid` (with `field` and a message ready to show, e.g. "Links must start with https://"), or `failed` (retry). Each success refreshes every page (`revalidatePath("/", "layout")`), and the current page re-renders in the same response.
- Shared link rule: `linkProblem()` in `@/lib/notes` (the same rule the server applies).
- Sign-in page: `parseLoginParams(searchParams)` from `@/lib/login` gives `next` and the notice (`not-owner`, `failed`, `signed-out`). Button: `<form action={signInWithGitHub}>` with a hidden `next` input (`@/app/actions/auth`). Sign out: `<form action={signOut}>`; it lands on `/login?status=signed-out`.
