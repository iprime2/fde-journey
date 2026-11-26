# FDE Journey web app: plan (v0.1, for approval)

Status: approved on 2026-11-25 (decisions in section 11). M0 in progress. Facts marked "checked" were looked up on 2026-11-25 and can change.

## 1. Goal
One private web app, reachable from any device, that tracks the whole AI and FDE journey: roadmap, learning resources, Scaler classes, certifications, projects, career steps and notes. It replaces the current tracker (a single HTML page published as a Claude artifact) and leaves room for sections the artifact cannot hold.

## 2. What exists today
- `tracker/fde-journey-tracker.html`: one file with the content (phases, tasks, resources, Scaler modules, certifications, projects, career) and the UI.
- Progress is saved in the artifact's database, one record per item id (`l1-1`, `r1-1-3`, `s2-4`, `journal` and so on) with `done`, `note`, `link`, `doneAt`, `updatedAt`. Only a handful of records exist so far, so moving them is easy.
- Claude sessions can read that database directly. A self-hosted app loses this unless we rebuild it (see M3).

## 3. Is it worth building?
| | Stay on the artifact | Own Next.js app |
|---|---|---|
| Works today | Yes | No, must be built |
| Sign-in | Through claude.ai | Own sign-in, own address |
| New sections (job applications, learning log, weekly plan, charts) | Awkward in one HTML file | Natural |
| Private mentor notes reachable from cloud sessions | No | Yes, behind sign-in |
| Upkeep | None | Accounts, updates, free-tier changes |
| Claude can read progress | Built in | Needs an export endpoint |

Recommendation: build it, but keep the artifact live until the new app does everything the artifact does (M3).

## 4. Decisions proposed
| Topic | Proposal | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | Front end and server code in one project. 16.x is the active long-term-support line (checked). |
| Folder | `web/` in this repo | Keeps the app apart from skills and the old tracker. The hosting project points at this folder. |
| Styling | Tailwind CSS 4, carrying over the tracker's current look (teal accent, light and dark) | Familiar, and already tested on a phone. |
| Database | Postgres on Neon, added through the Vercel Marketplace | Free plan is enough for one user (checked: about 1 GB storage and 100 compute-hours a month, sleeps after 5 idle minutes). Postgres matches Scaler Module 1 and NexusRAG. |
| Database access | Drizzle ORM with SQL migrations kept in the repo | Typed queries, readable SQL. |
| Sign-in | Better Auth with GitHub sign-in, limited to the owner's account | Auth.js (NextAuth) is now maintained by the Better Auth team and its docs point to migration (checked), so a new app should start on Better Auth. |
| Hosting | Vercel Hobby | Free for personal, non-commercial use (checked). One build at a time. |
| Content | Roadmap content stays in typed files in the repo (`web/content/`) | It is not personal, and changes stay reviewable in pull requests, as today. |
| Personal data | Only in the database | This repo is public. No progress, notes or secrets in code. |
| Tests | Vitest for logic, Playwright for the main flows, an in-process Postgres (PGlite) for local runs | No database server needed to develop or test. |
| CI | GitHub Actions on pull requests that touch `web/`: lint, type check, tests, build | The repo has no CI today. |

Item ids do not change. A test will fail the build if any existing id is missing or duplicated.

## 5. Architecture
```
Browser (phone or laptop)
   |  HTTPS
Next.js on Vercel
   |- proxy.ts            sends signed-out visitors to /login
   |- Server Components   read content files + progress, render pages
   |- Server Actions      save ticks, notes, links (each one checks the session)
   |- /api/auth/*         Better Auth (GitHub sign-in)
   |- /api/export         read-only JSON for Claude sessions, token-protected (M3)
   |
Postgres (Neon)           progress, sign-in tables, later feature tables
```

Folder layout:
```
web/
  app/          pages: dashboard, roadmap, scaler, certs, projects, career, login
  components/   shared UI pieces
  content/      phases, resources, scaler, certs, projects, career (public data)
  db/           schema and migrations
  lib/          ids, progress logic, auth helpers
  tests/        unit and end-to-end tests
  docs/         this plan, design spec, setup guide
```

First tables:
```
progress(item_id text primary key, done boolean, note text, link text,
         done_at timestamptz, updated_at timestamptz)
user, session, account, verification   -- created and managed by Better Auth
```
Later tables arrive with their features (for example `applications`, `log_entries`, `quiz_results`).

## 6. Security and privacy rules
1. Every page and every save sits behind sign-in. Only the owner's account is accepted.
2. Saves are validated on the server. Links must be `https`.
3. Secrets live in the host's environment settings, never in the repo. `web/.env.example` lists the names only.
4. No personal content in the repo: no progress, notes, quiz answers or contact details. Test data is made up.
5. The export endpoint for Claude is read-only and needs its own token.

## 7. Milestones (one pull request each)
| # | Milestone | Done when |
|---|---|---|
| M0 | Plan approved; role agents, a conventions skill and the design spec added | This plan is approved, the agent files and `web/docs/DESIGN-SPEC.md` are merged |
| M1 | App skeleton and read-only parity: dashboard plus the six sections (roadmap, reading, Scaler, certifications, projects, career), rendered from `web/content/` | Runs locally, matches the tracker's content, id test passes, CI is green |
| M2 | Database, sign-in and saving: ticks, notes, links, weekly notes, resource ticks; import script for the existing records | End-to-end tests pass against the local database |
| M3 | Go live: hosting, database and sign-in set up; export endpoint for Claude; cut-over | The owner uses the new app for a week with no gaps; then the artifact is frozen and `CLAUDE.md` is updated |
| M4+ | New sections, one at a time | Each has its own short design note first |

Carried into M2 from the M1 code review:
- Make tick boxes and the weekly-notes field controlled components once they save (today they use default values).
- Wrap `getProgress()` in React `cache()` before it reads the database (about seven calls per request).
- Refresh the date-based chips ("This phase", "This week") when a tab stays open past midnight IST.

Carried into M3 from the M2 code review:
- Rate-limit sign-in (Vercel firewall or Better Auth's limiter). The sign-in Server Action calls `auth.api.signInSocial`, which skips Better Auth's limiter: it only runs inside the `/api/auth/*` HTTP router, is not exported for `auth.api` calls, and by default keeps its counts in each server instance's memory. Until then, expired sign-in attempts are deleted before each new one, so the `verification` table cannot grow without bound.
- Import of tracker records: a record dated in the future (a device clock running ahead) is capped and inserted once, but once real time passes that date, a re-run would treat it as newer than an app edit made in between. Run the import once at cut-over; before any re-run after the app is live, add an import log (item id plus source time already applied) or make re-runs insert-only.

Candidate new sections, in suggested order:
1. Job applications tracker (companies, roles, status, next step).
2. Weekly plan (classes, tasks due, revision due).
3. Learning log, quiz results and spaced revision, so the private mentor notes are reachable from cloud sessions.
4. Progress charts and study-hours log.
5. Installable phone app (PWA).

## 8. What only the owner can do (M3, about 30 to 45 minutes)
Claude cannot create accounts or enter secrets. With click-by-click steps provided at the time:
1. Create a Vercel account and import this repo with root directory `web`.
2. Add the Neon database from the Vercel Marketplace.
3. Create a GitHub OAuth app and paste its two values into Vercel.
4. Sign in once to confirm.

## 9. Who builds it: role agents
A job title does not make an agent better. A separate context, a narrow brief and an independent review do. So the proposal is four agents and one shared skill, not a full org chart.

| Role asked for | Proposal |
|---|---|
| Lead engineer | The main Claude session: owns this plan, splits the work, integrates, makes the final call. Not a separate agent. |
| Project manager | This plan and one pull request per milestone. Not an agent. |
| UI/UX designer | Agent `ux-designer`: writes the design spec (colours, type, layouts, empty and error states) and reviews screens at phone and desktop width, including accessibility. |
| Front-end engineer | Agent `frontend-engineer`: pages and components, following the design spec. |
| Senior engineer | Split in two: agent `backend-engineer` (schema, sign-in, saving, import, export) and agent `code-reviewer` (independent review for bugs, security and privacy, plus tests). |

Plus one skill, `journey-app-dev`: the shared conventions every agent reads (stack, folder layout, id rules, privacy rules, how to run tests).

The agent files live in `.claude/agents/` and the skill in `.claude/skills/`. A running session may not pick up a newly created agents folder (checked), so they take full effect from the next session after merge. Until then the same briefs can be handed to general-purpose agents.

## 10. Risks
- **Scope creep.** New sections wait until M3 is done.
- **Free plans change.** Limits were checked on the date above; check again at setup.
- **First load after idle is slow.** The free database sleeps after 5 idle minutes.
- **Ownership.** Claude builds this, so it is a personal tool, not a portfolio piece. It should not be presented as the owner's own work unless they can explain it. Scaler Module 4 (front end) is a good time to take over parts of it.
- **Two copies of the content during the move.** From M1 the content lives in both the old tracker and `web/content/`. Roadmap edits pause or are made in both until cut-over.

## 11. Decisions (2026-11-25)
The owner approved the plan with the proposed answers:
1. Sign-in: GitHub, limited to the owner's account.
2. First new section after go-live: job applications tracker.
3. Team: four agents (`ux-designer`, `frontend-engineer`, `backend-engineer`, `code-reviewer`) plus the `journey-app-dev` conventions skill, with the main session as lead.

Changes since v0.1: the tracker gained a Reading tab (papers and books, ids `pp{n}` and `bk{n}`), so M1 covers six sections.

## Sources (checked 2026-11-25)
- Next.js releases and support policy: https://nextjs.org/blog/next-16-4 , https://nextjs.org/support-policy
- Vercel plans, terms and monorepo settings: https://vercel.com/pricing , https://vercel.com/legal/terms , https://vercel.com/docs/monorepos/monorepo-faq
- Neon free plan: https://neon.com/docs/introduction/plans , https://neon.com/faqs/free-plan-limits-and-quotas
- Auth.js and Better Auth: https://better-auth.com/blog/authjs-joins-better-auth , https://authjs.dev/getting-started/installation?framework=next.js
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
