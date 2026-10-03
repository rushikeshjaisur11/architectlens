---
title: "Prefix and Prompt Caching at the Serving Layer"
short_title: "Prefix / Prompt Caching"
tags: ["caching", "kv-cache", "inference", "vllm", "model-serving"]
sources:
  - "Efficient Memory Management for Large Language Model Serving with PagedAttention (Kwon et al., 2023 — vLLM)"
  - "SGLang: Efficient Execution of Structured Language Model Programs (Zheng et al., 2024 — RadixAttention)"
  - "Anthropic prompt caching documentation (docs.anthropic.com)"
  - "OpenAI prompt caching documentation (platform docs)"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched October 2026)"
  - "llm-d project blog, llm-d.ai/blog/kvcache-wins-you-can-see (fetched October 2026)"
  - "Google Gemini API documentation on implicit and explicit context caching (ai.google.dev, fetched October 2026)"
banner:
  layout: line
  nodes:
    - [user, "request"]
    - [cache, "prefix cache"]
    - [gpu, "GPU"]
    - [doc, "reused KV"]
---

## What's actually being cached

During autoregressive generation, every token attends to the key and value projections of all preceding tokens — the **KV cache**. Computing those projections for a prompt is the **prefill** phase, and for a long system prompt or few-shot example set, prefill can dominate latency and cost, especially when the same prefix is reused across many requests (a fixed system prompt, a shared set of retrieved documents, a long tool schema). **Prefix caching** reuses the KV cache computed for a shared prefix across requests instead of recomputing it from scratch every time — turning repeated prefill work into cache lookups.

This is distinct from caching the model's *output* (a simple key-value cache on the final text) — prefix caching operates on the intermediate KV tensors, so it still requires generating a fresh completion, but skips redundant computation over the shared portion of the input.

## How it works mechanically

The naive approach — cache the exact KV tensors for an exact-match prefix string — only helps when requests share a byte-identical prefix, which is common for system prompts but fragile for anything with even minor variation. Two serving-layer approaches generalize this:

- **PagedAttention (vLLM)** manages the KV cache in fixed-size blocks (analogous to OS virtual memory pages) rather than one contiguous allocation per sequence. Because blocks are addressed independently, identical blocks across different requests — e.g., a shared system prompt's blocks — can be **shared via reference counting** instead of duplicated, and vLLM's automatic prefix caching detects and reuses these shared blocks transparently, extending the sharing to any matching prefix, not just an exact preconfigured one.
- **RadixAttention (SGLang)** organizes cached KV entries in a **radix tree** keyed by token sequence, so that any request sharing a prefix with a previously-seen request — even a partial match discovered dynamically, such as shared few-shot examples in different orders or overlapping conversation branches — can reuse the matching tree path's cache. This generalizes prefix caching beyond a single static prefix to arbitrary structured reuse patterns, which matters for workloads like tree-of-thought search or multi-branch agent conversations that share partial histories.

## API-level prompt caching

Anthropic and OpenAI expose prompt caching as an **API-level** feature: mark a portion of the prompt (e.g., a long system prompt or document context) as cacheable, and the provider's backend reuses the KV state for that segment across calls within a cache TTL (typically minutes), charging a reduced rate for cache hits versus full-price for cache writes and misses. Functionally this is the provider running server-side prefix caching (conceptually similar to PagedAttention/RadixAttention) and exposing the cost savings directly rather than leaving it invisible infrastructure. For application teams calling a hosted API rather than running their own server, this is the practical lever: structuring prompts so the **large, stable portion comes first** (system instructions, long context, tool definitions) and the **small, variable portion comes last** (the actual user turn) maximizes cache hit rate, since caching is prefix-based — any variation early in the prompt invalidates the cache for everything after it.

## Why ordering matters so much

Because prefix caching is fundamentally about **exact-match reuse of a prefix**, any content placed before a variable element breaks the cache for that element and everything after it. A request structured as `[variable user query] + [large static system prompt]` gets zero benefit from prefix caching; `[large static system prompt] + [variable user query]` gets full benefit on the static portion. This is a real architectural constraint on prompt design, not just a formatting preference — it directly determines whether caching helps at all.

## Current practice (verified October 2026)

Provider prompt caching, with live numbers: Anthropic writes cache entries at **1.25x** (5-minute lifetime) or **2x** (1-hour) the base input price and reads them at **0.1x** (0.05x on Opus 5.5, 0.025x on Fable 5.1); a 5-minute entry pays for itself after one read, a 1-hour entry after two. Changing the thinking configuration between requests invalidates cache breakpoints. Gemini applies **implicit caching** by default (about 90% off cached input, no storage fee) and offers explicit caching with a storage charge. In your own serving stack, prefix reuse depends on routing: llm-d's benchmark saw p90 time-to-first-token of about 0.54 s with precise prefix-aware routing versus 31 to 95 s without, on the same hardware. Put stable content first and variable content last in every prompt.

## Common mistakes

- **Putting timestamps, request IDs, or other per-call variation early in the prompt.** Even a single differing token at the start invalidates the cache for the entire downstream content; dynamic content belongs at the end.
- **Assuming caching is free.** API-level caching still charges for cache writes (often at a premium over a normal input token) and has a TTL after which the cache expires and must be rewritten — caching only pays off when the same prefix is reused enough times within the TTL window to amortize the write cost.
- **Not exploiting server-managed prefix caching when self-hosting.** Teams running vLLM or SGLang sometimes don't realize automatic prefix caching needs to be explicitly enabled and that request patterns (consistent system prompts across the fleet) need to actually create sharing opportunities for it to help.
