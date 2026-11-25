# Data Validation Pipeline: Design (v0.1, draft)

Status: design agreed in chat on 2026-11-25. Nothing is implemented yet.

## Purpose
Check files received from a customer **before trusting them**. For every record the pipeline decides: pass, reject, send to a human, or warn. It explains each decision, publishes only trusted records, and produces a report the customer can read.

Why it matters: bad data fed into a RAG or reporting system gives confident wrong answers. This gate belongs in front of any ingestion step.

## Scope
- **In:** CSV files in, SQL tables out, an HTML + JSON report, a non-zero exit code when a load must pause.
- **Out (for now):** real-time streaming, hosting the report as a web app, automatically fixing bad data. Bad values are reported, never silently repaired.

## Inputs
| Input | Notes |
|---|---|
| Source files | e.g. cases, orders, issue records, human reviews |
| Rules file | one row per rule: id, file, field, type, params, route, reason, enabled |
| Data contract | required files, columns and types (a small schema file) |
| Run parameters | `run_time` (needed for freshness), run id |

## Stages
| # | Stage | Output |
|---|---|---|
| 1 | Receive files: register, hash content, record run time | file manifest |
| 2 | Understand records: profile against the data contract | contract report |
| 3 | Preserve raw: load untouched into staging tables | `stg_*` tables |
| 4 | Apply rules: row checks, then bundle checks | `validation_results` |
| 5 | Route problems: one final decision per bundle | `bundle_decision`, quarantine, review queue |
| 6 | Publish tables: trusted records only, typed, in one transaction | `pub_*` tables |
| 7 | Judge load: schema, freshness, idempotency, volume | load decision + `load_log` |
| 8 | Prepare SQL questions: cards the load can and cannot support | question cards |

A **bundle** is one case plus everything linked to it (order, issue record, reviews). A failed order blocks its whole bundle.

## Rules as data
- Rules live in the rules file, not in code. The engine reads each rule and calls the checker registered for its `rule_type`.
- Standard types: required, unique, conditional_required, allowed_values, date_format, cross_source_match, schema, freshness, idempotency.
- The human-readable `condition` text is not machine-readable, so each rule also carries structured `params` (field, values, tolerance, and so on). Pydantic validates the rules file itself.
- Set-based checks (duplicates, missing links, conditional rules, cross-source) are SQL templates. Orchestration, schema gate, freshness, hashing and reporting are Python.

## Routes and precedence
Routes: `PAUSE_LOAD`, `REJECT`, `HUMAN_REVIEW`, `LOAD_WARNING`, `PASS`.
Proposed final-route precedence: `PAUSE_LOAD > REJECT > HUMAN_REVIEW > LOAD_WARNING > PASS`. Every failure is kept in the report; precedence only picks the final route. **To confirm with the customer.**

## SQL layer
| Table | Purpose |
|---|---|
| `stg_*` | raw file as text, plus `run_id`, `source_file`, `row_number` |
| `validation_rules` | rules loaded as a table |
| `validation_results` | one row per failure: run, rule, row, field, value, route, reason |
| `bundle_decision` | final route per bundle |
| `pub_*` | trusted, typed records |
| `quarantine`, `review_queue` | rejected rows and rows waiting for a human |
| `load_log` | one row per run: file hashes, rules-file hash, row counts, route counts, status (unique on content hash gives idempotency) |

`row_number` identifies a row because the business key can itself be missing or duplicated. **Grain** (what one row means) is stated for every table; join cardinality is asserted so no join multiplies rows.

## Extension rules (beyond the standard nine)
Added as normal rows in the rules file with `enabled` on or off. Routes are proposals.

| ID | Check | Route |
|---|---|---|
| XR-01 | Orphan keys: case to order, issue to case, review to case | REJECT |
| XR-02 | Duplicate keys in the other files (order, review, issue case) | REJECT |
| XR-03 | Join cardinality guard: row counts must hold after each join | PAUSE_LOAD |
| XR-04 | Case type vs issue type consistency (mapping table) | HUMAN_REVIEW |
| XR-05 | Review status vs review records: status claims a decision with no record, or a record exists but status is pending | HUMAN_REVIEW |
| XR-06 | Time logic: review time vs extract time and case time, delivery vs order date, no future dates | HUMAN_REVIEW |
| XR-07 | Review freshness: stale reviews are never reused as decisions | LOAD_WARNING |
| XR-08 | Hygiene: stray spaces, empty string vs NULL, header drift, extract time consistent within a file | LOAD_WARNING |
| XR-09 | Volume and null-rate drift vs the previous load | LOAD_WARNING |
| XR-10 | PII scan on free-text fields before publish | HUMAN_REVIEW |
| XR-11 | Rules-file self-check: unique ids, known types, valid routes; record its hash in `load_log` | PAUSE_LOAD |
| XR-12 | Rule coverage: fields with no rule at all | report only |

## Report
One self-contained HTML file (plus JSON) with a stage bar and evidence tabs: Source Files, Raw Records, Data Contract, Validation, Exceptions, Trusted Tables, Load Report, SQL Questions. Own layout and wording; no copied course material.

## SQL question cards
Every practice question and every generated question is a card, written **before** any SQL:
- **Question (bounded):** population, time window, grain, grouping. Count occurrences (rows) unless distinct is stated.
- **Evidence needed:** table, field, why.
- **Limitation:** what the load cannot support (stale source, rejected rows excluded).
- **Check:** reconcile the SQL result with a hand count on the raw file.

The pipeline lists questions this load can support and ones it cannot, based on the load report.

## Build order (each step tested before the next)
1. Loader plus rules model (Pydantic), rules-file self-check
2. Staging load plus row-level checkers: required, unique, allowed values, conditional required
3. Date format, schema gate, freshness
4. Bundle join, cross-source match, blocking
5. Routing, publish, report
6. Idempotency ledger (`load_log`)
7. Extension rules XR-01 to XR-12
8. Question cards

Testing: `pytest` with small **synthetic fixtures** we write ourselves, at least one per rule type.

## Open questions for the customer
1. What is the run time, and which files are "operational" for freshness?
2. Which columns are required, and what are their types?
3. Does the precedence order above match their expectations?
4. Is a REJECT quarantined for resubmission or discarded?
5. Which free-text fields may contain personal data?

## Repo hygiene
This repo is public. Do not commit course CSVs, learning-log content or any personal data here; use synthetic fixtures only.
