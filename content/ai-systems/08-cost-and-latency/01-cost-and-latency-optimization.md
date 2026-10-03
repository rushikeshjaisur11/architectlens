---
title: "Cost and Latency Optimization for LLM Applications"
short_title: "Cost and Latency Optimization"
tags: ["cost", "latency", "llm", "optimization"]
sources:
  - "OpenAI and Anthropic pricing and prompt-caching documentation"
  - "vLLM and TensorRT-LLM documentation on serving-level cost/latency tradeoffs"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched October 2026)"
  - "Google Gemini API pricing, ai.google.dev/gemini-api/docs/pricing (fetched October 2026)"
banner:
  layout: line
  nodes:
    - [user, "request"]
    - [cache, "cache"]
    - [model, "right-size"]
    - [client, "fast reply"]
predict:
  question: "Two prompts have the same total token count and share the same 2,000-token instructions block. One puts the instructions first and the per-request question last; the other puts the question first. Which benefits from prompt caching?"
  options: ["Both benefit equally, because the cache keys on the total token count", "Only the instructions-first prompt, because caching reuses a shared prefix", "Only the question-first prompt, because variable content is cached most often"]
  answer: 1
  why: "Caching reuses a shared prefix, so putting variable content first defeats it even when the token count is identical."
check:
  - q: "Why use a router model rather than always calling the cheapest model?"
    options: ["Routing keeps most of the cheap-model savings without hurting quality on requests that need a stronger model", "Routing removes the need for an eval set, because the router itself judges quality for each request", "Routing makes the cheap model as capable as a flagship model on the hardest requests it receives"]
    answer: 0
    why: "A cheap router classifies difficulty and escalates only hard requests, capturing most savings without sacrificing quality on those."
  - q: "A team tunes model choice but keeps retrieving a large, untrimmed context. Why might the cheaper model still cost more overall?"
    options: ["Cheaper models charge more per input token once the context grows beyond a certain size", "A bloated context can cost more than a stronger model given a tight, curated one", "Cheaper models ignore long context, so the team has to retry each request several times"]
    answer: 1
    why: "Cost optimization has to cover the whole pipeline, not just model choice in isolation."
  - q: "Streaming is enabled on a chat product. What does it change about latency?"
    options: ["It shortens total generation time by sending tokens in parallel across the connection", "It lowers perceived latency by showing output sooner, while total generation time stays the same", "It lowers both total generation time and perceived latency by skipping the decoding step"]
    answer: 1
    why: "Decoding is sequential and token by token, so streaming only changes when the user starts seeing output."
---

## Why LLM cost and latency need explicit design attention

Unlike most application code, where a slow function is usually a bug to fix, LLM calls have an inherent, non-trivial cost and latency floor set by token count and model size — there's no free win from "just optimizing the code" the way there might be for a database query with a missing index. Cost and latency optimization for LLM applications means deliberately choosing where to spend tokens, which model to use for which task, and how to structure requests, not just tuning implementation details.

## Model selection: the biggest lever

Not every task needs the largest, most capable model. A classification task, a simple extraction task, or a well-defined transformation often performs just as well on a smaller, cheaper, faster model as on a flagship one — and the cost difference between model tiers is typically substantial (often an order of magnitude or more between a frontier model and a smaller model in the same family). The practical approach: route tasks to the smallest model that meets the quality bar for that specific task, verified against an eval set (see this track's evaluation lesson) rather than assumed — using the biggest model everywhere "to be safe" is usually the single largest unnecessary cost in an LLM application's budget.

**Model routing** — using a small, fast model to classify a request's complexity and route it to either a cheap model or an expensive one accordingly — is a common pattern for applications with a wide mix of easy and hard requests, capturing most of the cost savings of "always use the cheap model" without sacrificing quality on the requests that actually need a stronger model.

## Prompt caching: paying once for repeated context

Many production LLM APIs support prompt caching — when a request shares a prefix with a previous request (a long, unchanging system prompt, a large document included in every call), the model provider can reuse cached computation for that shared prefix instead of reprocessing it from scratch, at meaningfully reduced cost and latency for the cached portion. This makes prompt structure a real cost lever: placing static, reusable content (system instructions, reference documents) at the start of the prompt and variable, per-request content at the end maximizes what can be cached across calls, while structuring it the other way around (variable content first) defeats caching entirely, even if the total token count is identical.

## Token efficiency: paying for exactly what's needed

- **Trimming unnecessary context.** RAG systems (see this track's RAG lesson) that retrieve more chunks than needed pay for tokens that don't improve — and can even hurt — answer quality; tuning retrieval count against actual eval results, not a generously large default, reduces cost directly.
- **Output length control.** An unconstrained model may generate longer responses than needed; explicit length instructions or max-token limits bound the cost of generation, which is often priced higher per token than input processing.
- **Avoiding redundant round trips.** An agent loop that re-sends the full conversation history on every tool call pays for that history's tokens repeatedly; techniques like summarizing older turns or only including relevant history reduce this compounding cost in long-running agent sessions.

## Latency: where the actual time goes, and what to do about it

Total latency in an LLM application usually breaks down into: time to first token (how long before generation starts — affected by model size, prompt length, and queue/batching load on the serving side) and generation time (bounded by the sequential, token-by-token nature of autoregressive decoding, covered in this track's inference serving lesson). A few levers matter most in practice:

- **Streaming responses** so the user sees output as it's generated rather than waiting for the full response — this doesn't reduce total generation time, but it dramatically improves *perceived* latency, which is often what actually matters for a chat-style product.
- **Parallelizing independent LLM calls.** If a task needs three independent pieces of information from the model (or from different tools), issuing those calls concurrently instead of sequentially can cut wall-clock latency roughly by the degree of parallelism, when the calls don't depend on each other's results.
- **Choosing a smaller/faster model for latency-sensitive paths**, even at some quality cost, when the product's tolerance for latency is lower than its tolerance for a slightly less polished answer — this is a product decision as much as a technical one, and should be made explicitly rather than defaulted into.

## A worked example

**Scenario:** a customer support product with two paths — a fast auto-suggested reply shown as the agent types, and a thorough end-of-conversation summary generated once the ticket closes.

- **Auto-suggested reply (latency-critical, shown live):** a smaller, faster model, with a short, tightly-scoped prompt (recent conversation only, not the full history) and streaming enabled, since perceived responsiveness matters far more here than using the most capable model available.
- **End-of-conversation summary (cost matters more than latency):** the larger model, since a summary generated once per closed ticket is far lower volume than every keystroke-triggered suggestion, and quality matters more when a human will read and act on it later — routing by task type rather than using one model uniformly across both paths.
- **Prompt caching**: the system prompt and any shared context (product documentation excerpts used across all support tickets) are placed first in every prompt, structured deliberately so they're cached across the high-volume auto-suggest calls, where the cost savings compound the most given the call volume.

## Current practice (verified October 2026)

Live levers (October 2026; prices change, so keep them as data): cache reads cost about **10%** of input (5% on Opus 5.5, 2.5% on Fable 5.1) with 1.25x or 2x write premiums; **Batch** is 50% off input and output and stacks with caching; Gemini offers implicit caching by default; data-residency options add about 10% (regional cloud endpoints) or 1.1x (Anthropic `inference_geo: "us"`). Output costs about 5x input per token, so cap and structure output first. A 1M-token window is billed at the standard rate on current Claude models, which changes "stuff versus retrieve" into a quality and latency decision. Worked cost: 3,000 input tokens (2,500 cached) plus 400 output tokens on a $2/$10 model is about $0.0055 per turn, versus about $0.010 uncached.

## Common mistakes

- **Defaulting to the largest available model for every task "to be safe," without checking whether a cheaper model meets the quality bar.** This is usually the single biggest avoidable cost in an LLM application, and it's only found by actually testing smaller models against an eval set — not by assumption.
- **Structuring prompts with variable content first**, unknowingly defeating prompt caching and paying full cost/latency on every call even when most of the prompt is actually static.
- **Optimizing model cost while ignoring retrieval or context bloat.** A cheap model fed an unnecessarily large, poorly-trimmed context can cost more overall than a stronger model given a tight, well-curated one — cost optimization needs to look at the whole pipeline, not just model choice in isolation.
