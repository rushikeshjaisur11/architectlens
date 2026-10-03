---
title: "Designing an LLM Observability Platform"
short_title: "LLM Observability Platform"
tags: ["observability", "tracing", "monitoring", "evaluation", "platform", "design"]
sources:
  - "OpenTelemetry specification, including semantic conventions for generative AI"
  - "Google SRE Book, chapter 'Monitoring Distributed Systems'"
  - "Public documentation of LLM tracing and evaluation tools"
---

## The problem

Classic monitoring tells you a service is up and fast. For LLM applications that is not enough: a response can be fast, 200 OK and **wrong**. Teams need to see what the model was given, what it returned, what tools it called, how much it cost, and whether quality is drifting, across multi-step chains and agents. An LLM observability platform collects, stores, searches and evaluates this data at scale, while handling the privacy of the prompts it records.

## Step 1: Requirements

- **Tracing:** capture the full tree of steps for each request: prompts, completions, retrieval results, tool calls, errors, latencies, tokens and costs.
- **Search and debug:** find the trace for a user complaint; compare good and bad traces.
- **Metrics:** latency, error rates, token and cost usage, cache hit rate, by model, feature and team.
- **Quality:** attach evaluation scores (automated and human) to traces; detect regressions and drift.
- **Governance:** redact sensitive data, control access, retain per policy.
- **Scale (example):** 500 million spans per day, payloads of several KB each.

## Step 2: Data model

- **Trace:** one end-to-end request, with a trace id.
- **Span:** a unit of work (an LLM call, a retrieval, a tool call, a guardrail check) with start, duration, parent, status and typed attributes.
- **LLM span attributes:** model, parameters, prompt and completion (or references), token counts, finish reason, cost, prompt id and version.
- **Retrieval span attributes:** query, retrieved document ids and scores.
- **Annotations:** scores, labels, user feedback and comments attached to traces or spans.
- **Session and user ids:** group traces into conversations without storing unnecessary identity.

Adopt open standards (OpenTelemetry with generative AI conventions) so applications and frameworks emit compatible data.

## Step 3: Ingestion

Applications emit spans through an SDK or sidecar to a collector. The collector validates, redacts and batches, then writes to a durable queue. Stream processors enrich spans (cost from token counts and price tables, tags) and fan out to stores. Design for **backpressure and loss tolerance**: instrumentation must never slow or break the application, so use asynchronous export, bounded buffers and drop policies, with sampling under extreme load. Large payloads (prompts, documents) can be stored by reference in object storage to keep the span store small.

## Step 4: Storage

Different access patterns need different stores:

- **Trace store:** a columnar or document store keyed by trace id, optimised for fetching a whole trace quickly.
- **Search index:** full-text and attribute search over prompts, outputs and tags to find examples ("traces where the tool call failed after a refusal").
- **Metrics store:** pre-aggregated time series (tokens, latency percentiles, cost) for dashboards and alerts, since querying raw spans for dashboards is too costly.
- **Blob store:** large inputs and outputs.

Apply **tiered retention**: detailed traces for days, sampled traces and aggregates for months.

## Step 5: Sampling and cost

Storing every full trace is expensive. Use **tail-based sampling**: keep all traces with errors, low evaluation scores, negative feedback, unusually high cost or latency, plus a random sample of the rest. Head-based sampling is cheaper but misses rare failures. Always keep aggregate metrics for 100 percent of traffic.

## Step 6: Quality monitoring

- **Online evaluators:** run automated checks on a sample of live traces (a faithfulness judge, a toxicity classifier, format validators) and store scores as annotations.
- **Drift detection:** track score distributions, refusal rates, output length, retrieval score distributions and embedding statistics over time; alert on shifts.
- **Regression linking:** correlate changes with deploys, prompt versions and model changes, shown on the same timeline.
- **User feedback:** thumbs and corrections joined to traces.
- **Feedback loops:** push interesting traces into the labelling queue and the evaluation dataset.

## Step 7: Privacy and access

Prompts hold personal and confidential data. Redact at the collector using detectors, support per-field policies, encrypt at rest, and control access by role and project with an audit log. Allow deletion by user or session id across stores. Offer a mode that records metadata only (tokens, latency, scores) for sensitive applications.

## Step 8: Alerting

Alert on symptoms: error and refusal spikes, latency and cost anomalies, evaluator score drops and retrieval failures, each with links to example traces. Avoid noisy per-request alerts; use rate and distribution thresholds and tie them to service objectives.

## A worked example

**Scenario:** customers complain the support bot "went stupid" on Tuesday.

1. The quality dashboard shows the faithfulness score for the "refund" feature dropping from 0.91 to 0.74 starting at 14:10, aligned with a deploy marker.
2. A trace search for low-faithfulness traces after 14:10 shows many with an empty retrieval result.
3. Opening a trace tree: the retrieval span returned zero documents because an index alias pointed to an empty collection; the LLM span then answered from nothing.
4. The team fixes the alias; metrics recover. The affected traces are added to the regression dataset, and an alert is added for "retrieval returned zero results" rate.
5. Total detection and diagnosis time was 25 minutes, with no manual log digging.

## Common mistakes

- **Logging only the final answer**, hiding retrieval and tool failures.
- **Instrumentation that can block the application.**
- **Storing every payload forever** with no sampling or retention.
- **Recording sensitive prompts without redaction or access control.**
- **Tracking latency and errors but not quality.**
