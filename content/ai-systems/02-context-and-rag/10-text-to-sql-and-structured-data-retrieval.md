---
title: "Text-to-SQL and Structured Data Retrieval: Questions Over Tables"
short_title: "Text-to-SQL and Structured Data Retrieval"
tags: ["text-to-sql", "structured-data", "semantic-layer", "rag", "analytics"]
sources:
  - "Lei et al., 'Spider 2.0: Evaluating Language Models on Real-World Enterprise Text-to-SQL Workflows' (2024; ICLR 2025)"
  - "Jin et al., 'Text-to-SQL Benchmarks are Broken: An In-Depth Analysis of Annotation Errors' (CIDR 2026)"
---

## Why embeddings are the wrong tool for numbers

Vector search finds passages that *sound like* the question. It cannot compute. "What was revenue in EMEA last quarter, by product?" needs filtering, grouping and arithmetic over rows. Chunking a table into text and hoping the model adds numbers correctly produces confident, wrong totals. For structured data the reliable pattern is to let the model **write a query**, let a database **run** it, and let the model **explain** the result. The database does the exact work; the model translates intent into a precise language.

## The basic pipeline

1. **Understand the question**: resolve terms ("last quarter", "churned customers") and ask a clarifying question if the request is ambiguous.
2. **Select context**: choose the few relevant tables and columns, with types, descriptions and sample values. A warehouse may have thousands of tables; the model should see a handful.
3. **Generate SQL** in the right dialect.
4. **Validate before running**: parse the query, allow only read statements, check tables and columns exist, estimate cost, add a row limit.
5. **Execute** with a read-only identity that carries the *user's* permissions.
6. **Answer**: show the result, the SQL and the assumptions.
7. **Repair** on errors by feeding the database message back, with a retry cap.

## Why accuracy is lower than the leaderboards suggest

On the academic Spider benchmark, models exceed 90%. **Spider 2.0**, built from real enterprise workflows (632 tasks, databases averaging about 800 columns, multiple warehouse products and dialects), reported only about **21% success** for the best agent at publication. A 2026 paper argues that widely used text-to-SQL benchmarks contain many annotation errors, so high public scores overstate real-world accuracy. Failures cluster in dialect-specific functions, multi-step calculations and query planning, not in simple lookups. Newer models score higher than the 2024 figures, but the lesson stands: public benchmarks do not predict your warehouse.

## The fix is mostly not a better model

- **A semantic layer.** Define metrics once ("net revenue = gross minus refunds, excluding test accounts"), with join paths and a business glossary, and let the model query *those* rather than raw tables. Two analysts and the assistant then agree on the number.
- **Certified datasets.** Restrict the model to curated tables that someone owns.
- **Schema linking.** Retrieve relevant tables and columns by embedding their descriptions and past successful queries, not by pasting the whole catalogue.
- **Example queries.** Store verified question-and-SQL pairs per domain and retrieve similar ones as few-shot examples.
- **Constrained execution.** Read-only role, row-level security, statement timeout, cost cap.

## A worked example

A retailer's analysts ask: "Which five stores had the largest drop in conversion last month versus the month before?"

1. The assistant resolves "conversion" through the semantic layer (orders divided by sessions, defined by data engineering) and sees two candidate tables.
2. It writes a query using the certified `store_daily_metrics` view, with two monthly windows and a computed percentage-point change.
3. Validation confirms read-only access and adds `LIMIT 5`; the query runs in 1.8 seconds.
4. The answer shows the five stores, the SQL, and a note: "conversion defined as orders / web sessions; excludes kiosk traffic".
5. The team's golden set contains 150 such questions with analyst-verified answers; the release gate is 90% match, and every failure becomes a new example.

## Practical rules

- **Always show the SQL and the definitions used.**
- **Evaluate on your questions**, not a public benchmark; compare result sets, not SQL text.
- **Ask when ambiguous** (which year, which definition) rather than guess.
- **Defend the database**: no write permissions, no access beyond the user's rights, no free-form DDL.
- **Cache** repeated questions, and monitor cost per query.

## Common mistakes

- **Pasting the full schema** into the prompt.
- **Letting the model invent metrics** that differ from the official definition.
- **Running with a shared admin account**, which bypasses row-level security.
- **Measuring by "did it run"** instead of "is the number right".
- **Hiding the query**, so users cannot spot a wrong assumption.
