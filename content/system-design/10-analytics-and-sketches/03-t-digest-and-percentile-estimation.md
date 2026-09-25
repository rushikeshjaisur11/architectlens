---
title: "T-Digest and Streaming Percentile Estimation"
short_title: "T-Digest and Percentile Estimation"
tags: ["analytics", "sketches", "percentiles", "monitoring"]
sources:
  - "Ted Dunning & Otmar Ertl, 'Computing Extremely Accurate Quantiles Using t-Digests' (2019)"
  - "Datadog and Prometheus documentation on percentile aggregation approaches"
---

## Why percentiles matter more than averages for latency, and why they're harder to compute at scale

This track's reliability-and-operations and evaluation-and-observability lessons both stressed tracking latency percentiles (p50, p95, p99) rather than averages, since a small fraction of very slow requests can matter enormously for user experience while barely moving an average. Computing an *exact* percentile, though, requires having the full sorted set of all observed values — trivial for a small batch, but genuinely difficult for a high-volume production system generating millions of latency measurements per minute across possibly many servers, where storing every individual measurement just to compute a percentile is a real, non-trivial cost, and merging percentiles computed independently on different servers isn't as simple as averaging their individual results (the p99 of two separate servers' request sets isn't derivable from just their two individual p99 values).

## Why naive approaches to streaming percentiles fall short

- **Storing every value and sorting periodically** — exact, but memory cost grows unboundedly with volume, and computing a fresh sort on-demand doesn't scale to real-time dashboards needing continuously updated percentiles over high-volume streams.
- **Fixed-size reservoir sampling** — keep a fixed-size random sample of observed values and compute percentiles from the sample. Bounds memory usage, but loses precision, especially at the extreme percentiles (p99, p99.9) that matter most for tail-latency monitoring — a small random sample is unlikely to contain enough of the genuinely rare, extreme values needed to estimate an accurate p99.9, even though it might reasonably approximate a p50.
- **Fixed-bucket histograms** — pre-define latency buckets (0-10ms, 10-50ms, 50-100ms, and so on) and count observations per bucket, estimating percentiles from bucket boundaries. Bounded memory and mergeable across servers (bucket counts simply add), but precision is limited by bucket granularity, and choosing bucket boundaries requires anticipating the actual latency distribution in advance — a system that's much faster or slower than the bucket design anticipated gets poor resolution exactly where it matters.

## T-Digest: adaptive, mergeable, and precise where it matters most

**T-Digest** is a data structure specifically designed to address these limitations: it maintains a compact summary of the observed distribution using variable-sized clusters (not fixed-size buckets), with cluster size deliberately shrinking toward the distribution's extremes (near the 0th and 100th percentiles) and growing larger near the median — directly matching where precision actually matters most for percentile estimation. This means a t-digest gives high-precision estimates specifically at the extreme percentiles (p99, p99.9) that are hardest for fixed-bucket histograms to capture well, while using bounded, small memory regardless of how many total observations have been processed.

Critically, t-digests are **mergeable**: two independently-maintained t-digests (one per server, say) can be combined into a single t-digest representing the combined dataset, without needing access to the original raw observations — this is exactly the property a naive raw-value-storage approach lacks at scale, and it's what makes t-digest practical for a distributed system where percentiles need to be computed across many independent data-collecting nodes and then aggregated centrally, directly connecting to this track's probabilistic-data-structures lesson's broader theme of trading a small amount of accuracy for structures that scale and compose well across a distributed system.

## Where t-digest fits relative to this track's other probabilistic structures

This track's probabilistic-data-structures lesson covered HyperLogLog (cardinality estimation) and Count-Min Sketch (frequency estimation) — t-digest addresses a third, distinct estimation problem: distribution/percentile estimation. All three share the same underlying design philosophy (bounded memory, approximate but bounded error, mergeable across distributed sources) applied to genuinely different questions — "how many distinct things," "how many times did this specific thing occur," and "what does the overall distribution of these values look like" are different questions each requiring their own purpose-built approximate structure, not a single generic technique covering all three.

## A worked example

**Scenario:** a monitoring system needs to track p50, p95, and p99.9 request latency across a fleet of 200 application servers, aggregated into a single real-time dashboard, without excessive memory or network overhead.

- **Each server maintains its own local t-digest**, updating it incrementally as requests complete — bounded, small memory footprint per server regardless of that server's actual request volume, directly addressing the unbounded-storage problem of the naive "store every value" approach.
- **Periodically, each server's t-digest is sent to a central aggregator and merged** into a single combined t-digest representing the full fleet's latency distribution — using t-digest's mergeability property specifically to make this cross-server aggregation both correct and cheap (transmitting a compact digest structure, not raw per-request latency data from 200 servers).
- **The dashboard queries the merged t-digest** for p50, p95, and p99.9 on demand — getting high-precision estimates specifically at the extreme p99.9, which is exactly the percentile a fixed-bucket histogram with reasonably-sized buckets would likely estimate poorly, per the earlier comparison.

## Common mistakes

- **Using a fixed-bucket histogram when the actual latency distribution is unknown or highly variable**, and discovering after the fact that the chosen bucket boundaries give poor resolution exactly at the tail percentiles the team actually cares about monitoring closely.
- **Averaging independently-computed percentiles from different servers**, assuming this approximates the fleet-wide percentile — this is mathematically unsound (the average of several p99 values is not the same as the fleet-wide p99) and t-digest's proper merge operation exists specifically to avoid this common, easy-to-make mistake.
- **Using reservoir sampling for tail-latency monitoring** where p99 or higher precision genuinely matters, without recognizing that a fixed-size random sample systematically undersamples the rare extreme values that tail-latency monitoring is specifically trying to capture accurately.
