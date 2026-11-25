# FDE Production-Readiness Checklist

Use as a menu, not a mandatory audit. Pick items that fit the project's stage.

## 1. Problem & scope
- [ ] README states the problem, the user/customer, and why it matters
- [ ] A measurable success metric exists (accuracy, time saved, latency, cost per query)
- [ ] MVP scope is explicit; out-of-scope items are listed
- [ ] Assumptions about the customer environment are written down

## 2. Architecture
- [ ] A diagram (even ASCII/Mermaid) shows components and data flow
- [ ] Each component has one clear responsibility
- [ ] External dependencies are isolated behind interfaces (easy to swap model/vector DB)
- [ ] The design is the simplest that meets the requirement (no premature microservices)

## 3. Code quality
- [ ] Clear module structure; no 800-line `main.py`
- [ ] Meaningful names; type hints on public functions
- [ ] Config via env vars / config file, not hardcoded
- [ ] Unit tests for core logic; at least one end-to-end smoke test
- [ ] Linting/formatting (ruff/black) and dependency pinning

## 4. AI / LLM quality
- [ ] Prompts live in versioned files/constants, not scattered strings
- [ ] Structured output (JSON schema / tool calling) where code consumes the result
- [ ] An eval set exists (even 20–50 hand-labelled examples) and is run on changes
- [ ] Retrieval quality measured separately from generation (recall@k, MRR)
- [ ] Answers cite sources; "I don't know" path exists for low-confidence retrieval
- [ ] Model choice justified (cost vs. quality vs. latency)
- [ ] Handles context-window limits (chunking, summarization, truncation strategy)
- [ ] Prompt-injection risk considered for any untrusted input (docs, emails, web)

## 5. Reliability
- [ ] Timeouts and retries with backoff on every network call
- [ ] Rate limits handled (429s)
- [ ] Failures degrade gracefully with useful error messages
- [ ] Idempotent jobs/ingestion (safe to re-run)
- [ ] Input validation at boundaries (pydantic or similar)

## 6. Security & data
- [ ] No secrets in repo or git history; `.env.example` provided
- [ ] Least-privilege credentials for external systems
- [ ] PII identified; logged data is redacted
- [ ] Auth on any exposed endpoint
- [ ] Data residency / "data can't leave the VPC" scenario considered
- [ ] Agent tool calls are scoped; destructive actions need confirmation

## 7. Observability
- [ ] Structured logs with request IDs
- [ ] LLM calls traced: prompt, response, tokens, latency, model (LangSmith/Langfuse/OpenTelemetry or plain logs)
- [ ] Basic metrics: error rate, p50/p95 latency, cost per request
- [ ] A way to collect user feedback (thumbs up/down) for improving evals

## 8. Cost & performance
- [ ] Estimated cost per request and per month at expected volume
- [ ] Caching (prompt caching, response caching, embedding caching) where it helps
- [ ] Batching for bulk jobs; streaming for chat UX
- [ ] Smaller/cheaper model used where quality allows

## 9. Deployability
- [ ] Runs from a clean clone with documented steps
- [ ] `requirements.txt`/`pyproject.toml` with pinned versions; Dockerfile if appropriate
- [ ] Deployed somewhere demoable (Render, Railway, Fly, AWS, HF Spaces, Streamlit Cloud)
- [ ] Health-check endpoint; migrations/scripts documented

## 10. Communication & handover
- [ ] README: what, why, how to run, how to evaluate, limitations, next steps
- [ ] Short demo video or GIF
- [ ] Decision log / design doc explaining key trade-offs
- [ ] Handover notes: how a customer engineer would operate and debug it
