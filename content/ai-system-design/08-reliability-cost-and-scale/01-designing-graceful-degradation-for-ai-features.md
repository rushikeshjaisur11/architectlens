---
title: "Designing Graceful Degradation for AI Features"
short_title: "Graceful Degradation for AI Features"
tags: ["degradation", "resilience", "fallbacks", "circuit-breakers", "ux", "design"]
sources:
  - "Nygard, Release It! (Pragmatic Bookshelf, 2nd edition, 2018), on circuit breakers and bulkheads"
  - "Google SRE Book, chapter 'Addressing Cascading Failures'"
  - "Public provider status and incident postmortems on LLM API outages"
---

## The problem

AI features depend on components that fail in unusual ways: a provider rate-limits you, latency triples, the model returns malformed output, the retrieval index is stale, or a safety classifier is down. A system that either works perfectly or shows an error page is fragile. **Graceful degradation** means every dependency has a defined, tested fallback so the feature keeps delivering **reduced but useful** value, communicates honestly, and recovers automatically.

## Step 1: Requirements

- **Define the minimum acceptable experience** for each feature during failure: what must still work, what can be dropped.
- **Fast detection and switching** without human action.
- **Honest UX:** users know when answers are limited.
- **Safety first:** degradation never bypasses safety or privacy controls.
- **Automatic recovery** with hysteresis to avoid flapping.
- **Testability:** failures can be simulated and rehearsed.

## Step 2: Map dependencies and failure modes

List every dependency of a feature and how it can fail: slow, error, wrong, overloaded, expensive. For an AI assistant: the model provider, the embedding service, the vector store, the reranker, tool APIs, the guardrail service, the cache, the database. Rate each by criticality: **hard** (the feature cannot function without it), **soft** (quality drops without it), or **optional** (nice to have). The classification drives which fallbacks are needed.

## Step 3: A ladder of fallbacks

For each critical path define a **ladder** of progressively simpler behaviour:

- **Model:** primary model, then a second provider, then a smaller or self-hosted model, then cached or templated responses, then a clear "unavailable" message.
- **Retrieval:** hybrid retrieval, then keyword-only search, then recently cached results, then answering without retrieval with a caveat.
- **Reranking:** skip it; accept lower precision.
- **Tools:** read-only mode when write tools fail; queue actions for later with confirmation.
- **Long outputs:** shorter answers or summaries when capacity is tight.
- **Personalisation and extras:** switch off first, since they are the least essential.

Each rung must be **evaluated for quality** and tested, not just implemented; a fallback model that has never been checked may fail worse than an honest error.

## Step 4: Detection and switching

- **Timeouts** per dependency, set from observed latency, not defaults; no call waits indefinitely.
- **Circuit breakers** open after repeated failures or slowness, fail fast, and probe periodically to close again.
- **Bulkheads:** separate pools per dependency so one slow service cannot consume all threads or connections.
- **Load shedding:** under overload, reject or defer low-priority requests first (batch, free tier), protecting interactive paid traffic.
- **Adaptive concurrency and retry budgets:** limit retries to a fraction of traffic and use backoff with jitter, avoiding retry storms that worsen an outage.
- **Hysteresis:** require sustained recovery before switching back.

## Step 5: Product behaviour and communication

Degradation is partly a UX design problem. Show a subtle indicator ("Using quick answers while search is catching up"), disable features that cannot work instead of letting them fail, keep drafts and user input safe, and offer retry or save-for-later. Avoid false confidence: an answer produced without retrieval should say it is not grounded in your documents. For streaming, handle mid-stream failures by preserving the partial output and offering to continue.

## Step 6: Safety and integrity during failure

Failures create pressure to bypass checks. Decide explicitly: if the guardrail service is down, do **high-risk features fail closed** (block) while **low-risk ones fail open** with logging? Never degrade authorization or data isolation. Make sure fallbacks respect residency and privacy rules, for example not sending EU data to a US backup model. Record all degraded responses so they can be reviewed afterwards.

## Step 7: Testing and operations

- **Fault injection** in staging and, carefully, in production: add latency, errors and malformed outputs to dependencies and confirm the ladder works.
- **Game days** that simulate provider outages and capacity loss, with teams practising runbooks.
- **Dashboards** showing degradation state per feature, fallback rates and quality of fallback responses.
- **Alerts** on prolonged degradation, with ownership and escalation.
- **Post-incident reviews** that add missing fallbacks and tests.

## A worked example

**Scenario:** a document assistant faces a provider outage during a busy afternoon.

1. The primary model's error rate hits 40 percent; the circuit breaker opens. Interactive requests switch to the second provider's equivalent model, already evaluated for this prompt.
2. The second provider rate-limits under the extra load. The gateway sheds batch summarisation jobs first and applies a per-user token cap to free-tier users, keeping paid traffic within capacity.
3. The reranker service times out, so reranking is skipped for ten minutes; answers cite sources with slightly lower precision, and the UI shows a small "quick mode" label.
4. One feature, "draft an email from this document", needs a tool that is failing; it is disabled with an explanation and an option to be notified.
5. When error rates drop for five minutes, traffic returns gradually to the primary; the incident review adds a pre-warmed capacity reservation with the second provider and a test that runs the quick-mode path nightly.

## Common mistakes

- **Fallbacks nobody has tested or evaluated.**
- **Retry storms** that turn a partial outage into a total one.
- **Failing silently** with degraded answers presented as normal.
- **Degrading safety or isolation** to keep the feature alive.
- **No hysteresis**, so the system flaps between modes.
