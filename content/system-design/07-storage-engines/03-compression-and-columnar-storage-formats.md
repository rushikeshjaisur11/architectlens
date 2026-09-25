---
title: "Compression and Columnar Storage Formats"
short_title: "Compression and Columnar Storage"
tags: ["storage-engines", "compression", "columnar", "analytics"]
sources:
  - "Apache Parquet documentation on columnar storage format internals"
  - "Abadi, Madden & Hachem, 'Column-Stores vs. Row-Stores: How Different Are They Really?' (2008)"
---

## Row-oriented vs. column-oriented storage: matching layout to access pattern

Most transactional databases (per this track's storage-engines lesson) store data row-by-row on disk — all of a single row's columns stored contiguously, which is efficient when a typical query needs most or all columns of a small number of specific rows (a transactional "get this order's full details" access pattern). Analytical workloads have close to the opposite access pattern: a typical query touches most or all *rows*, but only a few specific *columns* ("average order value across all orders last quarter" only needs the `order_value` and `date` columns, not every column of every order). **Columnar storage** flips the physical layout to match this: each column's values are stored contiguously, so a query needing only 2 of a table's 30 columns can read just those columns' data from disk, skipping the other 28 columns entirely — a direct, often dramatic I/O reduction for analytical queries compared to a row-oriented layout, which would need to read every row's full width regardless of how many columns the query actually needs.

## Why columnar layout also compresses far better

Storing a column's values contiguously has a second, compounding benefit: values within a single column tend to be far more similar to each other than values across different columns within a row (a `status` column has only a handful of distinct values repeated constantly; a `country` column similarly has limited cardinality) — this uniformity within a column makes compression algorithms dramatically more effective than compressing row-oriented data, where each row mixes genuinely different data types and value distributions together, diluting any single compression pattern's effectiveness. Real columnar formats routinely achieve compression ratios that would be unrealistic for equivalent row-oriented storage, directly because of this within-column uniformity.

## Specific columnar compression techniques

- **Run-length encoding (RLE)** — for a column with many consecutive repeated values (common after sorting, or naturally in a column like `status`), storing "value X repeated N times" instead of N individual copies of X — extremely effective for low-cardinality, often-repeated columns.
- **Dictionary encoding** — for a column with a limited set of distinct values (even if not consecutively repeated), storing a small dictionary mapping each distinct value to a compact integer code, then storing the much smaller integer codes in place of the original (often larger, string-typed) values throughout the column — effective for categorical data like country codes, status values, or product categories.
- **Delta encoding** — for numeric columns with values that trend gradually (timestamps, sequential IDs, slowly-changing measurements), storing the difference between consecutive values rather than each full value — differences are often much smaller numbers than the values themselves, compressing better.

These techniques are specifically enabled by columnar layout's within-column value uniformity — applying the same techniques to row-oriented data, where consecutive stored values belong to entirely different columns with unrelated types and distributions, wouldn't find nearly the same exploitable patterns.

## Parquet and columnar file formats: bringing this to data lakes

**Apache Parquet** (and similar formats like ORC) is a widely-used columnar file format for data stored in object storage (per this track's object-storage lesson) rather than a live database — used heavily in data lake and analytics-pipeline contexts, where large volumes of data are stored as files and queried by tools like Spark or Presto/Trino rather than a traditional database engine. Parquet applies the columnar layout and compression techniques above at the file level, and also stores metadata (min/max values per column chunk, for instance) that lets a query engine skip entire chunks of a file without even reading them, if the chunk's metadata shows it can't possibly contain rows matching the query's filter — a further I/O reduction beyond compression alone, sometimes called predicate pushdown at the file-format level.

## The tradeoff: columnar storage is a poor fit for row-oriented access

Columnar storage's strength for analytical, few-columns-many-rows queries is exactly its weakness for transactional, all-columns-few-rows queries — reconstructing one complete row from a columnar layout means reading from many separate column locations and reassembling them, which is meaningfully more expensive than a row-oriented layout's single contiguous read for that same access pattern. This is why transactional (OLTP) databases remain row-oriented by default, and analytical (OLAP) systems use columnar storage — matching storage layout to the dominant access pattern, similar in spirit to this track's NoSQL-data-models lesson's broader point about matching data model to access pattern rather than picking one storage approach universally.

## A worked example

**Scenario:** an e-commerce company has a transactional order-processing database (row-oriented, per normal OLTP design) and needs to run analytical reporting (quarterly revenue trends, product category performance) over that same underlying order data without burdening the transactional database with expensive analytical queries.

- **A separate analytics pipeline** periodically exports order data from the transactional database into Parquet files in object storage — deliberately choosing a columnar format specifically because the analytical queries this data will serve (aggregating across millions of rows, touching only a few columns like `product_category`, `order_value`, and `date`) match columnar storage's strength directly, unlike the original transactional database's row-oriented layout, which would be a poor fit for this specific workload even though it's the right choice for the original transactional access pattern.
- **Dictionary encoding on the `product_category` column** (a low-cardinality categorical field) achieves strong compression, directly reducing both storage cost and the I/O volume analytical queries need to scan.
- **Predicate pushdown via Parquet's stored metadata**: a query filtering for "orders in Q4 2025" can skip entire file chunks whose stored min/max date metadata shows they fall entirely outside that range, without reading those chunks' actual data at all — a direct connection to this track's search-and-indexing reasoning about avoiding unnecessary scans, applied here at the analytical file-storage level.

## Common mistakes

- **Using a columnar format for a genuinely transactional, row-access-heavy workload**, incurring the row-reconstruction cost columnar storage isn't optimized for — a mismatch in the opposite direction from using row-oriented storage for analytics.
- **Not choosing compression encodings that match each column's actual value distribution.** Dictionary encoding is wasted on a genuinely high-cardinality column (a unique order ID, for instance) where there's no meaningful repetition to exploit, while a low-cardinality column left uncompressed misses substantial, easily-achievable savings.
- **Treating the analytics pipeline's data export as a one-time migration rather than an ongoing synchronization process.** Without a defined refresh cadence, the columnar analytical copy silently diverges from the live transactional source, similar to the staleness concerns covered in this track's caching lesson, applied here to a full data-copy rather than a cache entry.
