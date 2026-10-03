---
title: "Designing a Text-to-SQL Analytics Assistant"
short_title: "Text-to-SQL Assistant"
tags: ["text-to-sql", "analytics", "semantic-layer", "validation", "design"]
sources:
  - "Yu et al., 'Spider: A Large-Scale Human-Labeled Dataset for Complex and Cross-Domain Semantic Parsing and Text-to-SQL Task' (2018)"
  - "Public documentation on semantic layers and governed metrics in analytics tools"
  - "OWASP guidance on SQL injection and least-privilege database access"
  - "Lei et al., 'Spider 2.0: Evaluating Language Models on Real-World Enterprise Text-to-SQL Workflows' (2024; ICLR 2025)"
  - "Jin et al., 'Text-to-SQL Benchmarks are Broken: An In-Depth Analysis of Annotation Errors' (CIDR 2026)"
---

## The problem

Business users want to ask "how did revenue change by region last quarter?" and get a chart, without waiting for an analyst. The assistant translates a question into a query, runs it, and explains the result. The danger is a **plausible but wrong** answer: a query that runs, returns numbers and silently uses the wrong table, join or definition of "revenue". Trust is the product.

## Step 1: Requirements

- **Accuracy:** metrics must match the company's official definitions, not whatever the model guesses.
- **Safety:** read-only, least-privilege access; no data a user should not see; no runaway queries.
- **Transparency:** show the SQL, the data sources and assumptions, and let users correct them.
- **Latency:** answer in seconds for typical questions.
- **Scale (example):** 500 analysts and business users, a warehouse with 3,000 tables.

## Step 2: Do not point the model at the raw schema

A warehouse with thousands of poorly named tables overwhelms any prompt. Add a **semantic layer**: curated, documented entities and **governed metrics** ("revenue", "active customer") with fixed definitions, join paths and allowed dimensions. The model's job becomes mapping a question onto this layer, either by choosing metrics and dimensions (a structured query the system compiles to SQL) or by writing SQL constrained to approved views. This turns a free-form generation problem into a much easier selection problem, and it keeps definitions consistent across every answer.

## Step 3: Schema retrieval and context

Even a curated layer can be large. Retrieve only the relevant parts per question:

- Embed descriptions of tables, columns and metrics; retrieve the top candidates for the question.
- Include **column descriptions, sample values and join keys**, since names alone are ambiguous.
- Include **few-shot examples** of validated question-and-query pairs for similar questions, and the organisation's business glossary.
- Pass user context: their department, fiscal calendar and permitted data scope.

## Step 4: Generation, validation and repair

The pipeline is a loop, not a single call:

1. **Plan:** restate the question, pick metrics, dimensions, filters and time range; ask a clarifying question if ambiguous ("which fiscal year?").
2. **Generate** the query against the retrieved context.
3. **Static validation:** parse the SQL, confirm only allowed tables and columns are touched, no writes or DDL, a row limit and a time range are present.
4. **Dry run or `EXPLAIN`:** estimate cost and catch syntax and type errors cheaply.
5. **Repair:** feed errors back to the model for a bounded number of retries.
6. **Execute** with a timeout and resource cap.
7. **Sanity checks:** empty results, impossible values (negative counts), or a huge change versus history can trigger a warning or a second look.

## Step 5: Security

- Run queries under a **read-only role** whose permissions equal the user's, ideally via the warehouse's own row-level and column-level security, never through a shared super-user.
- Treat the model's SQL as untrusted input: parse and allow-list rather than string-filter.
- Mask sensitive columns by policy, and log every question, query and result summary for audit.
- Defend against prompt injection from data values (a customer name containing instructions) by never letting returned data re-enter the planning prompt as instructions.

## Step 6: Presenting results

Return the answer with a short natural-language summary, a chart, the **exact SQL**, the metric definitions used and the data freshness. A "this looks wrong" button captures corrections; verified corrections become new examples and tests. For ambiguous questions, show the assumptions made ("revenue = recognised revenue, EUR, calendar Q3") so users can adjust.

## Step 7: Evaluation

Build a golden set of real questions with verified SQL or answers. Score **execution accuracy** (does the result match the reference) rather than string equality of SQL, since many queries are equivalent. Track per-domain accuracy, clarifying-question rate and "I don't know" rate. Re-run on every change to prompts, schema or model; schema drift is a frequent silent regressor.

## A worked example

**Scenario:** a marketing manager asks "Which channel had the best return on ad spend last month?"

1. Retrieval finds the governed metric `roas` (revenue attributed divided by ad spend) and the `channel` dimension in the marketing mart.
2. The planner sets the time range to the previous calendar month and asks no questions because the definition is fixed.
3. SQL is generated against the approved view, validated (read-only, allowed columns, limit 100), dry-run estimated at a few seconds.
4. The result shows paid search at 4.1, email at 3.8; a sanity check passes. The user sees a bar chart, the SQL and the note "ROAS uses last-click attribution".
5. The manager flags that finance uses a 7-day window; the correction is routed to the data team, who add a second governed metric rather than letting the model guess.

## Enterprise practice (verified October 2026)

**Basics.** Give the model the schema, generate SQL, execute read-only, return the result with the query (steps above).

**Why enterprise accuracy is lower than the leaderboard (published evidence).** On the academic Spider 1.0 benchmark models exceed 90%, but **Spider 2.0**, built from real enterprise workflows (632 tasks, databases averaging about 800 columns, multiple SQL dialects and warehouse products), reported only **21.4% success for the best agent at publication**, and a 2026 CIDR paper argues that widely used text-to-SQL benchmarks contain **substantial annotation errors**, so high public scores overstate real accuracy. Spider 2.0's own error analysis attributes a large share of failures to dialect-specific functions, multi-step calculation and query planning, not simple schema lookup. Newer models score higher than the 2024 numbers; check the current leaderboard, but the lesson stands: public benchmarks do not predict your warehouse.

**What enterprises do.** Put a **governed semantic layer** (metric definitions, join paths, business glossary, certified tables) between the model and raw schemas so "revenue" means one thing; restrict the model to certified datasets; retrieve only relevant tables and columns; run queries with a read-only, row-level-secured service identity per user; set cost and row limits; show the SQL and assumptions; and build a golden set of real questions with verified answers from your own analysts as the release gate.

## Common mistakes

- **Giving the model the whole raw schema** and trusting its guesses about meaning.
- **Executing generated SQL with broad credentials.**
- **No validation or repair loop**, so errors reach the user.
- **Measuring string-match accuracy** instead of result correctness.
- **Letting each answer redefine metrics**, creating conflicting numbers.
