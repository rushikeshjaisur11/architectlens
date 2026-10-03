---
title: "Time-Series Databases and Metrics Storage"
short_title: "Time-Series Databases"
tags: ["time-series", "metrics", "tsdb", "downsampling", "cardinality", "compression"]
sources:
  - "Pelkonen et al., 'Gorilla: A Fast, Scalable, In-Memory Time Series Database' (VLDB 2015, Facebook)"
  - "Prometheus documentation, storage and data model, prometheus.io"
  - "InfluxDB, TimescaleDB and VictoriaMetrics documentation on storage engines and retention"
---

## A workload with its own shape

Metrics, sensor readings, financial ticks, application events: data points that arrive as **(series, timestamp, value)**, almost always **appended in time order**, rarely updated, queried by **time range** and aggregated (average over 5 minutes, 99th percentile per host). A general database handles this poorly at volume: B-tree indexes are costly for append-heavy writes, row storage wastes space on repeated labels, and queries scan too much. **Time-series databases (TSDBs)** specialise for it.

## The data model

A **series** is identified by a metric name and a set of **labels** (tags): `http_requests_total{service="checkout", region="eu", status="500"}`. Each series is a sequence of timestamped values. Two ideas dominate design:

- **Write path optimised for appends.** Recent data is held in memory and in a write-ahead log, then flushed to immutable, time-partitioned blocks (as in an LSM tree). Out-of-order data within a small window is tolerated; far-old backfills are expensive.
- **Compression by exploiting regularity.** Timestamps arrive at near-constant intervals, so store **delta-of-delta** (for a 15-second scrape, the second difference is usually zero, encoded in one bit). Values often change slowly, so **XOR** each float with its predecessor and store only the changed bits. Facebook's Gorilla paper reported compressing a data point to about **1.37 bytes** on average (from 16 bytes raw), the basis of many modern TSDB formats.

## Cardinality: the way TSDBs die

The cost of a TSDB scales with the number of **distinct series** (cardinality), not just points. Each unique label combination is a new series with its own index entry, memory and files. A label with unbounded values (user id, request id, full URL path with ids) multiplies series without limit: 3 services x 5 regions x 4 statuses = 60 series is fine; adding a `user_id` label with 1 million values creates 60 million. Symptoms: memory exhaustion, slow queries and huge indexes. Rules: **labels must be bounded and low-cardinality**; put high-cardinality data in logs or traces instead, and monitor active series per metric with limits.

## Retention and downsampling

Raw data at 10-second resolution for years is expensive and rarely needed. Typical policy: keep raw data for 15 to 30 days, **downsample** (store averages, min, max, count, percentiles at 1 minute and 1 hour) for months or years, and drop the rest. Downsampling must preserve what you query: averages of averages are wrong for percentiles, so store histograms or sketch structures (see t-digest) rather than pre-averaged values.

## Query patterns

- **Range queries with aggregation**: "rate of errors per service over the last hour at 1-minute steps".
- **Group by label** and **join across series** (error rate divided by request rate).
- **Alert evaluation**: rules evaluated every 15 to 60 seconds over recent windows, which makes recent-data read latency critical.
- **Percentiles**: use histogram buckets, not averages.

## Architectures

- **Single node** (Prometheus): simple, fast, local storage; limited by one machine and short retention.
- **Long-term storage and global view**: remote write to a scalable backend (Thanos, Cortex, Mimir, VictoriaMetrics, cloud services) with object storage for older blocks and sharding by series.
- **Time-series extensions of relational databases** (such as TimescaleDB on PostgreSQL) automatically partition tables by time and add compression and continuous aggregates, useful when you also need SQL joins with business data.
- **Columnar analytical stores** (ClickHouse and similar) are also used for events and metrics at very large scale.

## A worked example

A platform has 2,000 hosts, each exporting 400 metrics every 15 seconds.

1. Series: 2,000 x 400 = 800,000. Points per day: 800,000 x 5,760 samples = 4.6 billion.
2. Raw size at 16 bytes per point would be about 74 GB a day; with delta-of-delta and XOR compression near 1.4 bytes per point it is about 6.4 GB a day, so 30 days of raw data is roughly 190 GB.
3. A developer adds a `request_id` label to an HTTP metric; active series jump from 0.8 million to 40 million within an hour and the server runs out of memory. The team adds a per-metric series limit, removes the label and uses traces for request-level analysis.
4. Downsampling cuts the long-term volume: 1-minute aggregates hold a quarter of the points of 15-second data, and 1-hour aggregates 1/240 of them, so a year of hourly aggregates for all 800,000 series is a few percent of the size of one month of raw data.

## Common mistakes

- **High-cardinality labels** (ids, URLs, timestamps in labels).
- **Averaging pre-averaged data** and losing percentiles.
- **Keeping raw resolution forever.**
- **Using a time-series database as a general event store.**
- **No limits or alerts on active series.**
