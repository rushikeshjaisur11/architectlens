---
title: "Designing a Distributed Logging and Monitoring System"
short_title: "Distributed Logging and Monitoring Design"
tags: ["monitoring", "logging", "operations", "case-study"]
sources:
  - "Google SRE Book, chapters on monitoring distributed systems"
  - "OpenTelemetry documentation on the three pillars of observability (logs, metrics, traces)"
---

## Why this system is worth designing deliberately, not treating as an afterthought

Every other system covered in this track's product-design case studies (URL shortener, chat system, web crawler) eventually needs to be operated in production, and operating any distributed system at scale depends on the logging, metrics, and tracing infrastructure covered abstractly in this track's evaluation-and-observability-adjacent reasoning (the AI-systems track's tracing lesson covers this for LLM pipelines specifically; this lesson addresses the general infrastructure need). Designing this well matters because it's the system every other system depends on to be debuggable in production — a systems-monitoring pipeline that itself fails or falls behind during an incident is failing at exactly the moment it's needed most.

## The three pillars: logs, metrics, and traces, and why they're not substitutes for each other

- **Logs** — discrete, timestamped events with arbitrary structured or unstructured detail ("user 123 failed login attempt from IP X"). High information density per event, but expensive to store and query at volume, and not naturally aggregatable into trends without additional processing.
- **Metrics** — numeric measurements aggregated over time (request rate, error rate, latency percentiles per this track's t-digest lesson) — cheap to store at high volume (since they're pre-aggregated rather than storing every individual event) and naturally suited to dashboards, alerting thresholds, and trend visualization, but they lose the individual-event detail logs preserve.
- **Traces** — the request-level, cross-service journey of a single request (directly connecting to the AI-systems track's multi-step-pipeline tracing lesson's reasoning, applied here to general distributed request tracing rather than LLM pipelines specifically) — essential for understanding *why* a specific request was slow or failed, across service boundaries, in a way that aggregate metrics alone can't reveal for any single request.

A system needing to actually debug production issues needs all three, since they answer genuinely different questions — metrics tell you *that* something's wrong (elevated error rate), traces tell you *where* in a specific request's cross-service journey it went wrong, and logs tell you the *specific detail* of what happened at that point — treating any one as sufficient on its own leaves real gaps in what's actually debuggable.

## Step 1: Log ingestion at scale

Application instances across a large fleet generate logs continuously; a centralized logging pipeline needs to ingest this volume reliably without becoming a bottleneck or a single point of failure itself. This is a direct application of this track's message-queue lesson: log lines are published to a durable, high-throughput queue (Kafka is a common choice specifically for this use case, given its design for high-volume, ordered, durable event streams) rather than written directly to a central store synchronously from each application instance — decoupling log generation from log storage/indexing, so a temporary slowdown in the storage/indexing layer doesn't block or lose logs from the actual application instances generating them.

## Step 2: Storage and indexing for queryability

Raw logs need to be indexed for the kind of ad hoc, exploratory querying an engineer actually needs during an incident ("show me all error logs from this specific service in the last 10 minutes containing this specific error message") — this is a direct application of this track's search-and-retrieval and inverted-index lessons, since log search is fundamentally a full-text and structured-field search problem over a continuously growing dataset. A system like Elasticsearch (or a similar log-indexing store) provides this, typically with time-based index partitioning (per this track's sharding lesson's general partitioning reasoning, applied by time range specifically, since log queries are almost always scoped to a recent time window) letting old log data be aged out or moved to cheaper storage (per this track's object-storage lifecycle-policy lesson) without needing to keep every historical log in the expensive, actively-queried hot index indefinitely.

## Step 3: Metrics pipeline — a genuinely different storage shape

Unlike logs, metrics benefit from being pre-aggregated at collection time rather than stored as raw individual events — a time-series database (optimized specifically for this write pattern: many timestamped numeric data points per metric, queried primarily as trends over time ranges) is the appropriate storage layer, distinct from the log-indexing store, since forcing metrics through the same storage designed for full-text log search would be a mismatch similar to the row-vs-columnar storage mismatch covered in this track's compression-and-columnar-storage lesson — matching storage shape to actual access pattern, applied here to choosing genuinely different storage systems for logs versus metrics rather than one storage layer serving both.

## Step 4: Distributed tracing — correlating spans across services

Each service involved in handling a request generates a "span" (a timed record of that service's portion of the work), tagged with a shared trace ID that ties all spans for one logical request together — directly the same tree-structured trace concept from the AI-systems track's tracing lesson, applied to general microservice request tracing rather than LLM pipeline steps specifically. This requires every service in the request path to propagate the trace ID forward (typically via a request header) to any downstream service it calls, so spans generated across service boundaries can later be correctly assembled into one coherent trace — a design requirement that needs to be built into the service communication layer from the start, since retrofitting trace-ID propagation into services that weren't designed with it is a genuinely more painful, incremental migration.

## A worked example: debugging a production incident using all three pillars

**Scenario:** an alert fires showing elevated error rates for the checkout service.

- **Metrics** (Step 3) show exactly when the error rate started climbing and roughly how severe it is — the first, fast signal that something's wrong, checked against the SLO/error-budget framing from this track's availability lesson.
- **Traces** (Step 4) for a sample of the actual failing requests reveal that the errors correlate with unusually slow responses from a specific downstream inventory-check service call within the checkout flow — narrowing down *where* in the cross-service request path the problem originates, information the metrics alone (which only show the checkout service's own elevated error rate, not the underlying cause) couldn't reveal.
- **Logs** (Step 1-2) from the inventory service during the affected time window are then queried for the specific error detail, revealing the actual root cause (a downstream database connection pool exhaustion) — the granular detail that neither metrics nor traces alone would surface, completing the diagnosis.

## Common mistakes

- **Building only a metrics dashboard without distributed tracing**, leaving the team able to detect *that* something's wrong but with a much harder, slower manual process to determine *where* in a multi-service request path the actual problem lives, compared to having trace data available directly.
- **Storing logs and metrics in the same underlying storage system without recognizing their genuinely different access patterns and storage-shape needs**, per the row-vs-columnar mismatch analogy above — this tends to produce a system that serves neither use case particularly well.
- **Not building trace-ID propagation into the service communication layer from the start.** Retrofitting this into an already-large fleet of services after the fact, once the debugging gap it leaves becomes painfully apparent during an incident, is a substantially larger undertaking than including it in the initial service-to-service communication design.
