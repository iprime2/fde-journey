# fde-journey

An AI mentor setup for learning **Forward Deployed Engineering (FDE)** and **AI engineering**, built on [Claude Code](https://claude.com/claude-code) skills.

I'm moving from backend engineering into AI and FDE roles while doing Scaler's AI Forward Deployed Engineer program. This repo turns Claude Code into a senior-FDE mentor: it answers doubts, coaches assignments without solving them, reviews projects like a lead about to ship them to a customer, runs mock interviews, and tracks my progress.

## What's inside

| Path | What it does |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Rules Claude Code loads in every session in this repo |
| [`.claude/skills/fde-mentor`](.claude/skills/fde-mentor/SKILL.md) | Entry point: mentor persona, teaching rules, how doubts are answered, routing to the other skills |
| [`.claude/skills/fde-assignment-coach`](.claude/skills/fde-assignment-coach/SKILL.md) | A hint ladder for course assignments: clarify → direction → approach → skeleton → targeted fix. Never hands over graded solutions |
| [`.claude/skills/fde-project-review`](.claude/skills/fde-project-review/SKILL.md) | Production-readiness review across 10 areas with a 1–5 scorecard, plus a [full checklist](.claude/skills/fde-project-review/references/review-checklist.md) |
| [`.claude/skills/ai-engineering-guide`](.claude/skills/ai-engineering-guide/SKILL.md) | LLMs, RAG, agents, MCP, evals and LLMOps taught the way they're shipped at customers, with a [staged roadmap](.claude/skills/ai-engineering-guide/references/roadmap.md) |
| [`.claude/skills/fde-interview-prep`](.claude/skills/fde-interview-prep/SKILL.md) | Mock interviews: customer role-plays, problem decomposition, AI system design, coding, behavioral, with scored feedback |
| [`.claude/skills/fde-progress-tracker`](.claude/skills/fde-progress-tracker/SKILL.md) | Learning log, spaced revision and weekly plans |
| [`tracker/`](tracker/fde-journey-tracker.html) | Source of my progress tracker: 90-day roadmap, certifications, portfolio projects, career milestones and every Scaler class, with a note per item |

## Principles the mentor follows

- Diagnose before teaching; explain in layers (intuition → mechanism → example → "at a customer").
- Coach graded work instead of solving it.
- Teach trade-offs, not "the right answer".
- Never invent metrics, benchmarks or certification details. Check official sources.
- Build FDE habits: a design doc before code, success metrics, failure modes, handover docs.

## Use it yourself

1. Fork or clone this repo.
2. Open a Claude Code session in it, locally or in the cloud.
3. Ask a doubt, paste an assignment, or say "review my project".

Personal notes (goals, learning log, quiz answers) live in a gitignored `mentor/` folder and are never committed. Start your own from [`learning-log-template.md`](.claude/skills/fde-progress-tracker/assets/learning-log-template.md).

## Related

- [NexusRAG](https://github.com/iprime2/nexus-rag): the distributed enterprise RAG platform I'm building as my main portfolio project.
