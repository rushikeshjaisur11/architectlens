---
title: "Indexing Strategies: Beyond the Default Primary Key Index"
short_title: "Indexing Strategies"
tags: ["indexing", "sql", "performance", "databases"]
sources:
  - "PostgreSQL documentation on index types (B-Tree, GIN, GiST, BRIN)"
  - "Use The Index, Luke! (Markus Winand's indexing reference)"
---

## Why a primary key index alone isn't enough

Every table typically has an index on its primary key (often automatically), making lookups by ID fast. But most real queries filter, sort, or join on columns other than the primary key — `WHERE status = 'pending'`, `ORDER BY created_at`, `WHERE user_id = ? AND created_at > ?` — and without an index covering these access patterns, the database falls back to a full table scan, checking every row rather than jumping directly to matching ones. As a table grows from thousands to millions of rows, this difference goes from unnoticeable to a severe performance problem, which is why indexing strategy needs to be driven by actual query patterns, not just the primary key's automatic coverage.

## Composite indexes and column order

An index on multiple columns (`(user_id, created_at)`) is genuinely different from two separate single-column indexes — a composite index can efficiently support queries filtering on a prefix of its columns (`WHERE user_id = ?` alone, or `WHERE user_id = ? AND created_at > ?` together), but generally can't efficiently support a query filtering only on a non-leading column (`WHERE created_at > ?` alone, without `user_id`) — the same way a phone book sorted by last-name-then-first-name lets you efficiently find "all Smiths" but not efficiently find "everyone named John" without scanning the whole book. This makes column order in a composite index a real design decision: the most selective, most commonly-filtered-alone column generally belongs first, since it determines which queries can actually use the index efficiently.

## Covering indexes: avoiding the extra lookup

A standard index maps indexed column values to a pointer back to the full row, so satisfying a query that also needs an unindexed column requires an extra lookup back to the full row ("bookmark lookup") beyond just walking the index — an additional cost that compounds across many matching rows. A **covering index** includes all the columns a specific query needs directly in the index itself, letting the database satisfy the entire query from the index alone, without ever touching the underlying table rows — a real speedup for hot, frequently-run queries where this extra cost is worth eliminating, at the expense of a larger index (since it now stores additional column data, not just the indexed key) and slightly higher write cost (since more data needs to be updated on every insert/update to that table).

## Specialized index types beyond the default B-Tree

Most indexes are B-Trees (per this track's storage-engines lesson), well-suited to equality and range queries on ordered data. Other index types exist for access patterns a B-Tree doesn't naturally support well:

- **GIN (Generalized Inverted Index)** — used for indexing values containing multiple component elements (an array column, full-text search tokens, JSON document keys) where you need to efficiently find rows *containing* a specific element among many, conceptually similar to the inverted index covered in this track's search-and-retrieval lesson, applied within a relational database rather than a dedicated search engine.
- **GiST (Generalized Search Tree)** — supports more flexible, often geometric or range-overlap queries ("find all bookings overlapping this date range," or geospatial queries per this track's geospatial-indexing lesson), where the ordering a B-Tree relies on doesn't naturally apply.
- **BRIN (Block Range Index)** — a much smaller, lower-overhead index type well suited to very large tables where the indexed column correlates strongly with physical storage order (a `created_at` timestamp on an append-only table, for instance, since new rows are physically stored near each other and near the current time). Trades some query precision for a dramatically smaller index footprint, appropriate specifically when this storage-order correlation genuinely holds.

## The real cost of indexes: they aren't free

Every index added speeds up the queries it serves, but also adds write cost (every insert/update/delete needs to update every relevant index on that table, not just the table's own data) and storage cost. A table with many indexes optimized for many different query patterns can have write performance meaningfully worse than a table with only the indexes its actual query patterns need — this is why indexing strategy is a genuine tradeoff decision informed by real query patterns and their relative frequency, not a "more indexes is always better" default, echoing this track's caching lesson's point about denormalization: optimize deliberately for measured, known access patterns, not speculatively for every conceivable query.

## A worked example

**Scenario:** an `orders` table needs to efficiently support (1) looking up all orders for a specific customer, sorted by date, and (2) a dashboard query counting pending orders by status, run frequently.

- **Composite index on `(customer_id, created_at)`** directly serves the first access pattern — `customer_id` first since queries always filter by it, `created_at` second to support the sort-by-date requirement within a customer's orders using the same index, avoiding a separate sort step after the index lookup.
- **A covering index on `(status, created_at)` including the `id` column** serves the frequently-run dashboard query, letting it satisfy the count-by-status query entirely from the index without a bookmark lookup back to the full row — justified specifically because this query runs often enough (a live dashboard) that the extra index storage and write cost is worth the query speedup.
- **No index added for a rarely-run ad hoc reporting query** filtering on a different, uncommon column combination — since that query runs infrequently, the write-cost tradeoff of adding a dedicated index for it isn't judged worthwhile; an occasional full-scan cost for a rare query is accepted rather than paying ongoing write overhead for every order insert to support a query that runs once a quarter.

## Common mistakes

- **Adding an index for every column that ever appears in a `WHERE` clause**, without considering actual query frequency or the resulting write-cost accumulation — indexing strategy needs to be driven by which queries actually matter (frequency, latency sensitivity), not blanket coverage of every possible filter.
- **Building a composite index with columns in the wrong order for the actual query pattern**, leaving a query that filters on a non-leading column unable to use the index efficiently, even though an index nominally "covering" that column exists.
- **Not reconsidering indexing strategy as query patterns evolve.** An indexing strategy well-matched to a system's original access patterns can become mismatched as the application grows new query patterns — treated as a one-time setup rather than something to revisit as usage evolves, similar to the ongoing tuning point made in this track's search-relevance lesson.
