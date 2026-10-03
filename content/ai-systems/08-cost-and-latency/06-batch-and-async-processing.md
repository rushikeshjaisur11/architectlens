---
title: "Batch and Async Processing to Cut LLM Cost"
short_title: "Batch and Async Processing"
tags: ["cost", "batch-processing", "async", "llm"]
sources:
  - "Anthropic Message Batches API documentation (docs.anthropic.com)"
  - "OpenAI Batch API documentation (platform.openai.com/docs)"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched October 2026)"
  - "Anthropic documentation, extended thinking (fetched October 2026)"
banner:
  layout: line
  nodes:
    - [queue, "jobs"]
    - [server, "batcher"]
    - [model, "LLM"]
    - [db, "results"]
predict:
  question: "A pipeline needs 10 independent LLM calls, each taking about 3 seconds, before a final synthesis step. Roughly how long does the fan-out take with asyncio.gather versus sequentially?"
  options: ["About 30 seconds with gather and about 3 seconds sequentially", "About 3 seconds with gather, versus about 30 seconds sequentially", "About 3 seconds either way, since the API processes calls in parallel"]
  answer: 1
  why: "Concurrency collapses wall-clock time to roughly the slowest single call instead of the sum, though it doesn't cut token cost."
check:
  - q: "A team assumes making its calls async will cut the bill like a batch API does. What is wrong with that?"
    options: ["Async calls are billed at a higher rate than synchronous calls on most providers", "Async only helps with rate limits, and batch discounts need a paid support tier", "Concurrency cuts wall-clock time while the batch API cuts token cost, so they solve different problems"]
    answer: 2
    why: "Conflating the two levers is the lesson's named confusion; they compose rather than substitute."
  - q: "Why cap concurrent in-flight requests with a semaphore instead of firing hundreds at once?"
    options: ["Uncapped fan-out hits rate limits, and the retries and backoff can erase the latency win", "Providers bill each concurrent request separately, so a cap reduces the bill", "The model produces lower quality output when many requests arrive at the same moment"]
    answer: 0
    why: "Per-tier requests-per-minute and tokens-per-minute limits mean uncapped fan-out causes 429s."
  - q: "Why is a batch API the wrong tool for a job with a hard SLA under an hour?"
    options: ["Batch discounts disappear for jobs under an hour, so the savings no longer apply", "Batch jobs complete in minutes but the results can't be polled until the 24 hours pass", "The completion window can stretch to hours, so downstream steps assuming minutes would break"]
    answer: 2
    why: "Batch trades latency for cost; the guaranteed ceiling is 24 hours, so tight SLAs need synchronous calls."
---

## The core tradeoff

Real-time synchronous calls exist because a user is waiting on the other end. Most LLM workloads in a production system are not that — bulk classification, embedding generation, nightly report summarization, dataset labeling, backfills. For anything that doesn't need a sub-second response, trading **latency for cost** via batch APIs is close to free money: providers offer roughly 50% discounts (Anthropic and OpenAI both price batch calls at half the synchronous rate) in exchange for a turnaround window measured in hours instead of seconds.

The architectural shift this requires is treating "call the LLM" as an asynchronous job, not a request-response function call — you submit a batch, poll or get a webhook, and process results later. Any pipeline still shaped as a synchronous loop calling the API per-item is leaving that discount on the table for every workload that doesn't actually need real-time responses.

## What qualifies for batching

- **No user is blocked on the result.** Nightly ETL, log analysis, content moderation queues, dataset generation for fine-tuning, evaluation runs — all fine.
- **Volume is large enough to amortize the batch submission/polling overhead.** A batch of 5 requests isn't worth the plumbing; a batch of 5,000 is.
- **The task tolerates the provider's completion window** (Anthropic and OpenAI both target same-day completion for most batches, with a 24-hour guarantee ceiling). If your job has a hard SLA under an hour, batch is the wrong tool.

A common pattern is a **hybrid pipeline**: the interactive path (user-facing chat, live search) stays synchronous; everything that can be precomputed or run overnight (embeddings for a RAG index, periodic re-summarization of documents, bulk classification of a new data dump) goes through batch. The two paths use the same model but completely different cost profiles.

## Async concurrency within the synchronous path

Separate from provider batch APIs, there's a second lever: even synchronous calls that must return quickly can be **parallelized** instead of serialized. If a pipeline needs outputs from 10 independent LLM calls (e.g., summarizing 10 document chunks before a final synthesis step), issuing them concurrently via `asyncio.gather` (Python) or `Promise.all` (Node) collapses wall-clock latency to roughly the slowest single call instead of the sum of all ten — this doesn't reduce token cost, but it reduces the latency cost of not batching. Concurrency limits still apply: providers enforce requests-per-minute and tokens-per-minute rate limits per tier, so uncapped fan-out risks 429s; a semaphore or connection pool capping concurrent in-flight requests to a safe margin under the rate limit is the standard mitigation.

## Combining both levers

The two techniques compose: use the provider's Batch API for the bulk, non-interactive workload to get the ~50% price cut, and use async concurrency within your own job submission and result-polling code to keep the batch's *wall-clock* turnaround short even though the API is being used in bulk mode. They solve different problems — batch cuts token cost, concurrency cuts wall-clock time — and conflating them (e.g., assuming "async" alone saves money) is a common confusion.

## Current practice (verified October 2026)

Batch APIs discount input and output by **50%** (Anthropic, Gemini and, per third-party trackers, OpenAI Batch and Flex) and stack with caching; fast mode and Managed Agents sessions are excluded. Anthropic advises batch processing for thinking budgets above about 32,000 tokens to avoid timeouts, and web-search calls inside batches are throttled per organisation. Good fits: nightly summarisation, evaluation runs, embeddings, backfills. Design for completion windows of up to 24 hours, idempotent result handling and partial failures.

## Common mistakes

- **Batching latency-sensitive traffic by accident.** A queued job with no deadline slowly creeping into a user-facing critical path because the same pipeline got reused.
- **Ignoring the batch completion window in system design.** If downstream steps assume results within minutes, a batch job that can legitimately take hours will silently violate that assumption without an explicit wait/poll contract.
- **Uncapped async fan-out.** Firing hundreds of concurrent requests without a concurrency limit hits provider rate limits and produces retries/backoff that erase the latency win entirely.
- **Not deduplicating batch inputs.** Batch workloads are often generated from bulk data (e.g., every row in a table); failing to dedupe identical prompts before submission pays full price for redundant work that caching would have caught in the synchronous path.
