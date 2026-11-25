# AI Engineering Roadmap for an FDE

A staged path. It complements the Scaler course rather than replacing it — map course modules onto these stages and fill gaps. Each stage ends with a milestone project and a "ready to move on" check.

## Stage 0 — Engineering foundations
- Python fluency: typing, async, packaging, virtualenvs, pytest
- HTTP & REST APIs, JSON, auth (API keys, OAuth basics)
- SQL + Postgres; basic data modelling
- Git, Linux shell, Docker basics
- One web framework (FastAPI recommended)

**Milestone:** A FastAPI service with Postgres, Docker, tests, deployed publicly.
**Ready when:** You can build and deploy a CRUD API from scratch in a day without tutorials.

## Stage 1 — LLM fundamentals
- What a token is; context windows; temperature/top-p; why models hallucinate
- Calling LLM APIs (chat format, system prompts, streaming)
- Prompt engineering: clear instructions, examples (few-shot), role, step-by-step reasoning, delimiters
- Structured outputs: JSON schema, tool/function calling, validation with pydantic
- Cost & latency basics: token counting, model tiers, prompt caching

**Milestone:** A CLI or API that extracts structured fields from messy text (e.g., invoices, emails) with validation and a 30-example accuracy test.
**Ready when:** You can explain why an output failed and fix it by changing the prompt or schema, and measure the improvement.

## Stage 2 — Embeddings & RAG
- Embeddings and similarity search; vector DBs (pgvector, Chroma, Qdrant, etc.)
- Document parsing (PDF, HTML, tables) — the messiest real-world part
- Chunking strategies; metadata filtering
- Hybrid search (BM25 + vectors), reranking, query rewriting
- Citations and "I don't know" behaviour
- Retrieval metrics: recall@k, MRR; answer metrics: faithfulness, relevance

**Milestone:** RAG over a few hundred real, messy documents with citations and an eval set (50+ Q&A pairs) reporting retrieval and answer quality.
**Ready when:** Given a bad answer, you can diagnose whether it's parsing, retrieval, ranking, or generation.

## Stage 3 — Agents & tool use
- Tool/function calling loops; when to use workflows vs agents
- Agent patterns: ReAct-style loops, planner/executor, routing
- MCP (Model Context Protocol) for connecting tools and data sources
- Memory and state; step limits; human-in-the-loop for risky actions
- Guardrails: input/output validation, permission scoping, prompt-injection defence

**Milestone:** An agent that uses 2–3 real APIs (e.g., calendar, ticketing, a database) to complete a task, with an audit log of every tool call and a test suite of tasks.
**Ready when:** You can explain why your agent failed on a task by reading its trace, and add a guardrail that prevents it.

## Stage 4 — Evals & LLMOps
- Building eval sets from real usage; LLM-as-judge (and its pitfalls)
- Regression testing prompts/models in CI
- Tracing and observability (Langfuse, LangSmith, OpenTelemetry, or plain structured logs)
- Monitoring cost, latency, error rate; user feedback loops
- Model selection and migration; A/B testing

**Milestone:** Add evals-in-CI and tracing to a previous project; show a before/after metric for a change.
**Ready when:** You'd be comfortable telling a customer "here's how we know it works, and here's how we'll know if it breaks."

## Stage 5 — Enterprise deployment (the FDE layer)
- Cloud basics on one provider (AWS/GCP/Azure): compute, storage, IAM, networking/VPC
- Managed model access (Bedrock, Vertex AI, Azure OpenAI) for customers whose data can't leave their cloud
- SSO, RBAC, audit logs, data residency, PII redaction
- Integrating with enterprise systems: Salesforce, SharePoint, ServiceNow, Slack, email, legacy databases
- Fine-tuning / small models when cost or privacy demands it

**Milestone:** Deploy a RAG or agent project inside a cloud account with IAM-scoped access, private networking, and logging; write the security one-pager a customer's security team would ask for.
**Ready when:** You can pass a mock "customer security review" conversation.

## Stage 6 — The FDE craft (runs alongside every stage)
- Discovery calls: asking good questions, finding the real problem
- Problem decomposition and scoping a 2-week MVP
- Writing: design docs, status updates, handover docs
- Demos and stakeholder communication; saying no and managing expectations
- Feeding customer learnings back to product

**Practice:** For every project, write a 1-page design doc before coding and a 1-page handover doc after.
