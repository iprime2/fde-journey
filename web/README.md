# FDE Journey web app

Private tracker for the AI engineering and FDE learning journey. Plan: [`docs/PLAN.md`](docs/PLAN.md). Conventions: [`../.claude/skills/journey-app-dev/SKILL.md`](../.claude/skills/journey-app-dev/SKILL.md).

Status: milestone M1 (read-only). Nothing is saved yet; sign-in and saving arrive in M2.

## Run it locally
Requires Node 22 or later.

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:3000.

## Checks
```bash
npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e
```

## Roadmap content
Until cut-over, the roadmap content comes from `../tracker/fde-journey-tracker.html`. After changing the tracker, run `npm run content:sync`. A unit test fails if the two drift apart or if any saved-progress id disappears.
