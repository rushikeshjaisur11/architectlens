---
title: "OLAP vs OLTP and Columnar Analytics Engines"
short_title: "OLAP vs OLTP & Columnar Engines"
tags: ["olap", "oltp", "columnar-storage", "star-schema", "materialized-views"]
sources:
  - "Snowflake documentation — Micro-partitions and Data Clustering"
  - "ClickHouse documentation — MergeTree engine and columnar storage"
  - "Ralph Kimball & Margy Ross, 'The Data Warehouse Toolkit' (star schema and dimensional modeling)"
  - "Google BigQuery documentation — Materialized views"
---

## OLTP and OLAP are optimized for opposite access patterns

**OLTP (Online Transaction Processing)** systems — Postgres, MySQL, most application databases — are optimized for high-throughput, low-latency **row-level** reads and writes: fetch one customer, update one order, insert one event. **OLAP (Online Analytical Processing)** systems — Snowflake, BigQuery, ClickHouse, Redshift — are optimized for **aggregate queries over millions or billions of rows**, touching few columns but scanning huge row ranges: "average order value by region last quarter."

These access patterns pull storage layout in opposite directions, which is why the two rarely share an engine at scale:

- OLTP wants **row-oriented storage** — all columns of one row co-located on disk — because a transaction typically reads or writes an entire row at once.
- OLAP wants **column-oriented storage** — all values of one column co-located — because an aggregate query reads a handful of columns but ignores the rest, and scanning only the needed columns avoids wasting I/O on data the query never touches.

## Columnar storage mechanics

In a columnar engine like ClickHouse's MergeTree or Snowflake's micro-partition format, each column is stored as a separate, contiguous, independently compressed byte stream. This has two compounding benefits: **I/O reduction** (a query selecting 3 of 50 columns reads roughly 3/50ths of the data) and **compression ratio** (values within a single column share type and often have low distinct-value cardinality — a `country` column compresses far better sitting next to other country codes than sitting next to a `timestamp` and a `price`). ClickHouse and Snowflake both further partition columns into blocks (granules / micro-partitions) with min/max statistics per block, letting the query planner skip blocks that can't match a filter predicate entirely — a form of coarse-grained indexing that costs almost nothing at write time.

The trade-off: writing or updating a single row in a columnar store means touching every column file that row spans, which is why OLAP engines favor **append-heavy, batch-loaded writes** and treat single-row updates as expensive or, in some engines, effectively unsupported outside of batched merge operations.

## Star schema

The **star schema**, formalized by Ralph Kimball's dimensional modeling methodology, organizes an analytical warehouse around a central **fact table** (one row per event — a sale, a click, a shipment — holding foreign keys and numeric measures) surrounded by **dimension tables** (denormalized, descriptive attributes — customer, product, date, region). The shape resembles a star: the fact table at the center, dimensions radiating out, joined on simple foreign keys with no further normalization chain.

This is a deliberate departure from OLTP's normalized (3NF) modeling. Dimension tables are intentionally denormalized — a `product` dimension might repeat category and brand name on every row rather than normalizing them into separate lookup tables — because OLAP query cost is dominated by join complexity and scan volume, not by storage redundancy. Fewer joins, wider dimension tables, and predictable fact-to-dimension join patterns let the query planner optimize aggressively, and columnar compression absorbs most of the redundancy cost that denormalization would otherwise impose.

## Materialized views

A **materialized view** pre-computes and physically stores the result of a query — typically an aggregation over the fact table — so subsequent reads hit the stored result instead of re-scanning and re-aggregating raw rows. BigQuery's materialized views and ClickHouse's `MATERIALIZED VIEW` (commonly paired with `AggregatingMergeTree`) both support **incremental refresh**: as new rows land in the base table, only the delta is merged into the view's stored aggregate rather than recomputing from scratch.

This is the standard technique for serving high-QPS dashboards off a warehouse: run the expensive rollup once (or incrementally, continuously), and let dashboard queries read a small pre-aggregated table instead of re-scanning raw fact data on every page load. The trade-off is staleness (bounded by refresh interval or lag) and storage cost for the precomputed result.

## Common mistakes

- **Running an OLTP-shaped workload (many small row updates) against a columnar OLAP engine.** It works, but at a throughput and cost penalty the engine wasn't designed to absorb — batch writes instead.
- **Fully normalizing a warehouse schema like an OLTP database.** More joins means the query planner has less to work with and columnar scan efficiency drops as fact-to-dimension traversal multiplies.
- **Treating a materialized view as always fresh.** It reflects data as of its last refresh; queries requiring strict real-time accuracy need to account for that lag or query the base table directly.
- **Ignoring block-level statistics/partitioning keys.** Loading data in an order that scrambles the min/max ranges per block defeats block-skipping and forces full scans even on filtered queries.
