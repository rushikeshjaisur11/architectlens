---
title: "Query Optimization and Execution Plans"
short_title: "Query Optimization"
tags: ["sql", "query-optimization", "postgres", "performance"]
sources:
  - "PostgreSQL Documentation: Using EXPLAIN (postgresql.org/docs)"
  - "Use The Index, Luke! (use-the-index-luke.com)"
banner:
  layout: line
  nodes:
    - [doc, "SQL"]
    - [server, "planner"]
    - [db, "index scan"]
    - [doc, "EXPLAIN"]
predict:
  question: "EXPLAIN shows a Nested Loop join with an estimated 10 rows, but EXPLAIN ANALYZE reports 500,000 actual rows. What most likely happens at runtime?"
  options: ["The query runs fast, because estimates rarely affect timing", "The planner replans mid-query and switches to a hash join", "The join is slow, since the plan assumed a small row count"]
  answer: 2
  why: "A big estimate gap means the planner chose a nested loop on a bad cardinality guess, which becomes a slow row-by-row scan."
check:
  - q: "You add an index on email, but WHERE lower(email) = ... still scans the whole table. Why?"
    options: ["Applying a function to the column needs an expression index on lower(email)", "Indexes on text columns only work for exact case-sensitive matches", "The index needs ANALYZE to run before any query can use it"]
    answer: 0
    why: "A plain index on email does not match a function applied to the column, so an expression index is required."
  - q: "A query is fast on a 10,000-row staging table but falls over at 50 million rows in production. What is the lesson's explanation?"
    options: ["Production hardware is always slower than staging hardware", "The planner switches scan and join strategies at different scales", "Indexes stop working once a table passes a million rows"]
    answer: 1
    why: "Plan choices like seq vs index scan and join strategy change with data volume, so test on realistic sizes."
  - q: "Why is EXPLAIN alone not enough to diagnose a slow query?"
    options: ["EXPLAIN cannot show which indexes exist on the table", "EXPLAIN always picks a different plan than the real execution", "Its estimates depend on statistics and may be wrong without real timings"]
    answer: 2
    why: "Only EXPLAIN ANALYZE shows real row counts and timing, exposing estimates that stale statistics got wrong."
---

## The core mental model

A SQL query describes *what* you want, not *how* to get it. The database's query planner turns that declarative request into a concrete execution plan — a tree of physical operations (scans, joins, sorts, aggregates) chosen based on table statistics, available indexes, and cost estimates. Two syntactically different queries can produce identical plans; two structurally similar queries can produce wildly different ones depending on data distribution. Optimization means understanding and influencing the plan, not just the SQL text.

**EXPLAIN** shows the planner's chosen plan without running the query. **EXPLAIN ANALYZE** actually executes it and reports real row counts and timing alongside the estimates, which is what you need to diagnose problems — a plan that *looks* reasonable can still be slow if the planner's row estimates are wrong.

## Reading a plan

Plans are trees, read from the innermost (bottom) node outward. Key signals:

- **Seq Scan vs Index Scan vs Index Only Scan.** A sequential scan reads every row in a table — fine for small tables or queries that need most of the data, disastrous on a large table filtered to a tiny fraction of rows. An Index Only Scan avoids even touching the heap because the index alone has every column the query needs (a **covering index**).
- **Estimated rows vs actual rows.** A large gap (e.g., estimated 10, actual 500,000) means the planner's statistics are stale or the predicate is hard to estimate (correlated columns, functions on columns). This is often the root cause of a bad plan choice — the planner picked a nested loop join assuming a small row count, and it turned into a slow row-by-row scan.
- **Join strategy.** Nested Loop is fine for small outer sets; Hash Join and Merge Join scale better for large sets. If a query joining two large tables shows a Nested Loop, that's usually a red flag caused by a bad cardinality estimate or a missing index on the join column.
- **Sort and Hash nodes with disk spill.** `EXPLAIN (ANALYZE, BUFFERS)` reveals when a sort or hash operation exceeds `work_mem` and spills to disk — a common, fixable source of slowness.

## Fixing what the plan reveals

- **Stale statistics.** `ANALYZE` (or `VACUUM ANALYZE`) refreshes the planner's row-count and distribution estimates. Autovacuum handles this automatically in most cases, but bulk loads or rapid churn can outpace it.
- **Missing or wrong indexes.** An index doesn't help if the query applies a function to the indexed column (`WHERE lower(email) = ...` needs an expression index on `lower(email)`, not a plain index on `email`) or if the leading column of a composite index doesn't match the filter.
- **Over-fetching.** `SELECT *` when only three columns are needed defeats index-only scans and increases I/O. Selecting exactly what's used lets the planner consider narrower, cheaper plans.
- **Parameter sniffing / generic plans.** In systems that cache plans for parameterized queries (common in ORMs and stored procedures), a plan optimized for one parameter's selectivity can be reused for a very different parameter, performing badly. Forcing a replan or using more targeted statistics (histograms) mitigates this.

## Rewriting queries to help the planner

Not every fix is an index. Rewriting a correlated subquery as a join, replacing `OR` conditions across columns with `UNION`, or breaking a query with multiple aggregations into staged CTEs can all change which plans the optimizer considers. Window functions (`ROW_NUMBER() OVER (...)`) frequently replace slower self-joins or subqueries for "top N per group" patterns.

## Common mistakes

- **Trusting EXPLAIN without ANALYZE.** Estimated costs are only as good as the statistics behind them; the only way to see what actually happened — real timing, real row counts, buffer hits vs. reads — is EXPLAIN ANALYZE (ideally with BUFFERS) against production-like data.
- **Adding an index and assuming it's used.** An index that isn't selective enough, or that the planner judges more expensive than a sequential scan for the table's size, will simply be ignored. Always re-check the plan after adding an index.
- **Optimizing in isolation from data volume.** A query that's fast on a 10,000-row staging table can fall over at 50 million rows in production because the planner switches strategies (e.g., seq scan to index scan crossover points, or join strategy changes) at different scales. Test against realistic data sizes, not dev fixtures.
