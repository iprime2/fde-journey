---
name: journey-app-dev
description: Conventions for building the FDE Journey web app in `web/` (Next.js, Postgres, Better Auth). Use whenever you work on files under `web/`, plan or review a milestone of the app, or brief the ux-designer, frontend-engineer, backend-engineer or code-reviewer agents.
---

# FDE Journey web app: shared conventions

Every agent working on `web/` follows this page. If it conflicts with `web/docs/PLAN.md`, the plan wins; raise the conflict with the lead.

## Read first
1. `web/docs/PLAN.md`: goal, decisions, milestones, privacy rules.
2. `web/docs/DESIGN-SPEC.md`: look, layout, states and accessibility targets.
3. `tracker/fde-journey-tracker.html`: the current tracker. Until cut-over (M3) it holds the content and the saved-progress ids the app must match.

## Who does what
| Role | Who | Owns |
|---|---|---|
| Lead engineer | The main Claude session | Plan, task split, integration, commits, pull requests, final decisions |
| UX designer | `ux-designer` agent | Design spec; screen reviews at phone and desktop width |
| Front-end engineer | `frontend-engineer` agent | Pages, components, styling, client interactions |
| Back-end engineer | `backend-engineer` agent | Schema, migrations, sign-in, Server Actions, import and export |
| Reviewer | `code-reviewer` agent | Independent review before every pull request. Read-only |

Loop per milestone: design (if UI changes) → build → review → the lead fixes or sends work back → one pull request. Agents never commit, push, merge or deploy; the lead does that.

## Stack
- Next.js 16 (App Router), React 19, TypeScript in strict mode, Tailwind CSS 4.
- Postgres (Neon in production). Drizzle ORM with SQL migrations committed in `web/db/migrations/`.
- Better Auth with GitHub sign-in, limited to the owner's GitHub account.
- Local development and tests use an in-process Postgres (PGlite), so no database server is needed.
- Vitest for logic, Playwright for end-to-end flows.
- Pin exact versions in `web/package.json`. Check npm for current versions before adding a dependency, and say why it is needed.
- Fonts: do not use `next/font/google`, because the cloud sandbox cannot reach Google Fonts. Use `@fontsource` packages from npm or a system font stack.
- Next.js 16 changed many APIs. Before writing Next.js code, read the relevant guide in `web/node_modules/next/dist/docs/` (see `web/AGENTS.md`). The scaffold enables Cache Components.

## Folder layout
```
web/
  app/          routes (dashboard, roadmap, reading, scaler, certs, projects, career, login)
  components/   shared UI
  content/      public roadmap content as typed TypeScript files
  db/           schema and migrations
  lib/          ids, progress logic, auth helpers
  tests/        unit (Vitest) and end-to-end (Playwright)
  docs/         plan, design spec, setup guide
```

## Ids and content (do not break saved progress)
- Item ids are exactly those of the tracker: `l{phase}-{task}`, `c{cert}-{task}`, `p{project}-{task}`, `k{n}`, `s{module}-{class}`, `r{phase}-{task}-{n}`, `pp{n}`, `bk{n}`, `journal`.
- Ids come from positions in lists. Only append items; never reorder or delete them. To hide an item, add a flag.
- A test must fail if any id from the tracker is missing, duplicated or renamed.
- Until cut-over, change roadmap content in the tracker first, then mirror it in `web/content/` in the same pull request.

## Privacy and security (this repo is public)
- No personal data in code, fixtures, tests, screenshots or commits: no progress, notes, quiz answers, CV content, contact details. Test data is made up.
- Nothing from `mentor/`, ever.
- Secrets only in environment variables. `web/.env.example` lists names with empty values.
- Every page except `/login` requires sign-in. Every Server Action checks the session and that the user is the owner.
- Validate all input on the server. Links must be `https`.
- Escape user text when rendering, and never use `dangerouslySetInnerHTML` on it.

## Commands (run in `web/`)
| Command | What it does |
|---|---|
| `npm run dev` | Local server at http://localhost:3000 |
| `npm run lint` / `npm run typecheck` | ESLint; route types plus TypeScript |
| `npm test` | Unit tests, including the id and content-sync checks |
| `npm run build` then `npm run test:e2e` | Production build, then Playwright at phone and desktop width |
| `npm run content:sync` | Regenerate `content/tracker-data.ts` after the tracker changes |

## Quality bar (definition of done)
- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass in `web/`.
- New logic has unit tests. Each user flow touched has an end-to-end test.
- Screens checked at 390 px and 1280 px wide, light and dark, with no sideways scrolling.
- Accessibility: text contrast at least 4.5:1, visible focus, full keyboard use, labelled controls, touch targets at least 44 px, reduced motion respected.
- UI text in plain English. Define jargon once.

## Reporting back to the lead
End every task with: what changed (files), how it was checked (commands and results), screenshots taken (paths), open questions, and anything not done. Never claim a check passed unless you ran it.
