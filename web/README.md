# FDE Journey web app

Private tracker for the AI engineering and FDE learning journey. Plan: [`docs/PLAN.md`](docs/PLAN.md). Conventions: [`../.claude/skills/journey-app-dev/SKILL.md`](../.claude/skills/journey-app-dev/SKILL.md).

Status: milestone M2 in progress. Database, sign-in and saving are built and wired to the pages: ticks, notes, links and weekly notes save as you go (see [`docs/M2-DESIGN.md`](docs/M2-DESIGN.md) and [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md)).

## Run it locally
Requires Node 22 or later.

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:3000. Every page except `/login` needs the owner's sign-in. Copy `.env.example` to `.env.local` and fill in `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (http://localhost:3000), `OWNER_GITHUB_ID` and a GitHub OAuth app's `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (callback http://localhost:3000/api/auth/callback/github).

Without `DATABASE_URL` the app uses an in-process Postgres (PGlite) stored in `.data/pglite`, so no database server is needed.

## Database
| Command | What it does |
|---|---|
| `npm run db:generate` | Writes a new SQL migration in `db/migrations/` after a change to `db/schema.ts` |
| `npm run db:migrate` | Applies migrations to the Neon database in `DATABASE_URL` (PGlite migrates itself) |
| `npm run db:import -- <file-or-folder> [--dry-run]` | Imports records exported from the tracker artifact. Safe to run twice; prints counts only. Stop `npm run dev` first |

## Checks
```bash
npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e
```

## Roadmap content
Until cut-over, the roadmap content comes from `../tracker/fde-journey-tracker.html`. After changing the tracker, run `npm run content:sync`. A unit test fails if the two drift apart or if any saved-progress id disappears.
