---
title: "Rate Limiting and Backpressure for LLM APIs"
short_title: "Rate Limiting & Backpressure"
tags: ["reliability", "rate-limiting", "backpressure", "llm-apis"]
sources:
  - "Anthropic API rate limits documentation (docs.anthropic.com)"
  - "OpenAI API rate limits documentation (platform.openai.com)"
  - "Google SRE Book, Chapter 21: Handling Overload (sre.google)"
---

## Why LLM rate limits are different from typical API limits

Most REST APIs rate-limit on requests per second. LLM providers rate-limit on **two independent dimensions**: requests per minute (RPM) and tokens per minute (TPM), and a burst of large prompts can exhaust the TPM budget while barely touching RPM. A service sending 10 requests per second with 8K-token prompts hits the token ceiling long before the request-count ceiling. Design for the tighter of the two, not whichever is easier to instrument.

Limits are also **tiered and dynamic**: providers grant higher throughput as billing history accumulates (Anthropic and OpenAI both scale tier limits automatically), and limits can be organization-wide rather than per-key, meaning one runaway service inside a company can starve every other team's calls to the same provider.

## Client-side throttling

The naive approach — fire requests and retry on 429 — wastes capacity and adds latency variance under load. Better: track the provider's returned rate-limit headers (`x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`, `x-ratelimit-reset-*`) and self-throttle before hitting the ceiling, not after.

A **token bucket** is the standard primitive: replenish at the sustained rate, allow short bursts up to bucket capacity, and block or queue when empty. Run separate buckets for RPM and TPM, since either can be the binding constraint. For multi-tenant systems, nest buckets — a global bucket for the provider limit, per-tenant buckets underneath for fairness — so one noisy tenant can't consume the whole organization's quota.

## Backpressure: propagate the signal, don't absorb it silently

Backpressure means a downstream constraint (the LLM provider is saturated) gets communicated upstream instead of being invisibly buffered. Two failure modes to avoid:

- **Unbounded queuing.** If incoming requests are queued without limit while waiting for provider capacity, latency degrades gracefully until it doesn't — then the queue itself becomes a memory or timeout problem, and users get failures anyway, just later and with no useful error.
- **Silent dropping.** Discarding requests under load without signaling the caller looks like the system is healthy when it's shedding work.

The correct pattern is **bounded queues with explicit rejection**: cap the queue depth, and once full, return a fast, typed error (HTTP 429 with a `Retry-After` header) so the caller can decide to retry, degrade, or surface a message to the end user. This is the same principle behind TCP flow control and the load-shedding guidance in the Google SRE book — reject early and cheaply rather than accept and fail expensively later.

## Queueing and prioritization

Not all LLM calls have equal urgency. A synchronous user-facing chat completion and a background batch summarization job shouldn't compete for the same token budget on equal footing. Separate them into priority queues or, better, route batch/non-latency-sensitive work through a provider's async batch API (OpenAI Batch API, Anthropic Message Batches API), which runs on spare capacity at a discount (typically 50%) with a relaxed turnaround (within 24 hours) and doesn't touch the interactive rate limit pool at all.

## Concurrency limits vs. rate limits

Rate limits cap throughput over time; **concurrency limits** cap how many requests are in flight simultaneously. LLM calls have highly variable latency (a 200-token response and a 4K-token response differ by seconds), so a fixed concurrency limit is often the more direct lever for controlling load on your own infrastructure (connection pools, worker threads) even when the provider's constraint is purely token-based. Use a semaphore sized to your worker pool, independent of the provider's RPM/TPM bucket.

## Common mistakes

- **Retrying 429s with fixed-delay retries instead of exponential backoff with jitter.** Synchronized retries from many clients create thundering-herd spikes exactly when the provider is already saturated.
- **Only tracking RPM and ignoring TPM.** Large-prompt workloads (RAG contexts, long documents) blow through token budgets while request counts look fine.
- **Unbounded in-memory queues as a substitute for real backpressure.** They convert an immediate, informative failure into a delayed, confusing one.
- **Treating provider-side rate limits as the only constraint.** Your own database connections, worker threads, or downstream services can saturate before the LLM API does.
