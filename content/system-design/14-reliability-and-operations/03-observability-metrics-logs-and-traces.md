---
title: "Observability: Metrics, Logs and Traces"
short_title: "Observability: Metrics, Logs, Traces"
tags: ["observability", "monitoring", "tracing", "logging", "operations"]
sources:
  - "Google SRE Book, chapter 'Monitoring Distributed Systems' (four golden signals)"
  - "OpenTelemetry specification and documentation"
  - "Sigelman et al., 'Dapper, a Large-Scale Distributed Systems Tracing Infrastructure' (Google, 2010)"
banner:
  layout: line
  nodes:
    - [server, "service"]
    - [queue, "telemetry"]
    - [db, "store"]
    - [client, "alerts"]
---

## Monitoring versus observability

**Monitoring** answers questions you thought of in advance: is the error rate above a threshold? **Observability** is the ability to ask new questions about a running system, ones you did not anticipate, using the data it emits, without shipping new code. In a distributed system with many services, most real incidents are of the second kind.

The usual building blocks are three kinds of telemetry, each good at something different.

## Metrics

A metric is a **number sampled over time**: requests per second, error ratio, queue depth, p99 latency. Metrics are cheap, compact and aggregate well, so they are the right tool for dashboards, alerts and trends.

Their weakness is **cardinality**. A metric labelled by `user_id` creates one time series per user, which can overwhelm the store. Keep labels low-cardinality (service, region, status code, endpoint), and never put unbounded values like IDs in them.

A good starting set is the **four golden signals**: latency, traffic, errors and saturation. For request-driven services the RED method (rate, errors, duration) is a handy subset; for resources, the USE method (utilization, saturation, errors).

## Logs

A log is a **timestamped record of a discrete event**: a request failed, a job started, a user signed in. Logs carry rich detail and are the final source of truth when you need to know exactly what happened.

Practices that make logs useful:

- **Structured logging** (JSON or key-value) instead of free text, so fields can be filtered and aggregated.
- **Consistent fields**: timestamp, level, service, request ID, trace ID.
- **Levels used honestly**, so error means something.
- **No secrets or personal data** written into logs.

Their weakness is **volume and cost**. Logging every request at full detail across hundreds of services can dwarf the system it describes. Sample verbose logs, keep short retention for debug level, and keep longer retention only for what matters.

## Traces

A trace follows **one request across every service it touches**. It is composed of **spans**, each representing a unit of work (an HTTP handler, a database query) with a start time, duration, and a pointer to its parent. Stitched together, the spans show where time went.

To make this work, each service passes a **trace ID** (and parent span ID) along on every outgoing call, usually in HTTP headers using the W3C Trace Context format. Libraries such as OpenTelemetry handle this propagation automatically.

Traces answer the question metrics and logs cannot: *in this slow request, which of the twelve downstream calls was the slow one?* Because tracing every request is expensive, systems **sample** — head-based sampling decides at the start (say 1 percent), tail-based sampling keeps traces after seeing they were slow or errored, at the cost of buffering.

## How the three work together

They are most powerful when connected:

1. A **metric alert** says p99 latency on checkout rose.
2. A dashboard breakdown by endpoint and region narrows it down.
3. A **trace** exemplar from the slow period shows 80 percent of time spent in the inventory service's database call.
4. The **logs** for that span, found by trace ID, show a lock timeout on a specific table.

Shared identifiers (trace ID, request ID) are what let you jump between the three. Without them, you have three separate haystacks.

## A worked example

**Scenario:** users report that "add to cart" is sometimes very slow.

- The metrics dashboard shows the cart service's p50 is fine at 80 ms but p99 jumped from 400 ms to 4 s. Averages hid it.
- Filtering by label shows the problem only affects one availability zone.
- Pulling slow traces for that zone shows a consistent 3.5 s span in a call to a cache cluster, with retries.
- Logs for that cache client, filtered by the trace ID, show connection timeouts to a single node. That node is replaced; p99 recovers.

No single signal solved it; the chain of metric, trace, log did.

## Cost and alerting discipline

Telemetry is a product with a budget. Decide what to keep at full fidelity and what to downsample. Alert on **symptoms users feel** (error ratio, latency SLO burn) rather than every internal cause, and attach a runbook link so the person paged knows what to do first.

## Common mistakes

- **High-cardinality metric labels** that blow up storage and query time.
- **Unstructured logs** that cannot be searched reliably.
- **No request or trace ID in logs**, making cross-service debugging manual.
- **Tracing not propagated through queues and async hops**, producing broken traces.
- **Alerting on causes (CPU 80 percent) instead of symptoms**, causing noise.
- **Collecting everything forever**, then being unable to afford or query it.
