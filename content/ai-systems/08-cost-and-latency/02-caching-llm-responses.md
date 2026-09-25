---
title: "Caching LLM Responses: Beyond Prompt Caching"
short_title: "Caching LLM Responses"
tags: ["caching", "cost", "latency", "llm"]
sources:
  - "GPTCache and semantic-caching library documentation"
  - "Redis documentation on semantic caching patterns for LLM applications"
---

## Two different kinds of caching for LLM applications

This track's cost-and-latency lesson covers **prompt caching** — a provider-side mechanism that reuses computation for a repeated prompt prefix. This lesson covers a distinct, application-level technique: **response caching**, where the application itself stores and reuses entire LLM responses for requests it judges similar enough to a previous one, avoiding a new LLM call entirely rather than just speeding up part of one. The two are complementary, not competing — prompt caching helps every call that shares a prefix with a prior one; response caching helps specifically when a genuinely repeated (or near-repeated) request doesn't need a fresh LLM call at all.

## Exact-match caching: the straightforward case

The simplest form: cache a response keyed by the exact input (prompt, parameters). A repeated identical request returns the cached response instantly, at zero additional model cost. This works well for genuinely repeated exact queries — a FAQ-style system where the same question is asked verbatim by many users, or an internal tool where a fixed set of report types are regenerated on the same inputs repeatedly. The limitation is obvious: it only helps for exact repeats, and real user input rarely repeats character-for-character, limiting the hit rate for most conversational or open-ended use cases.

## Semantic caching: matching by meaning, not exact text

**Semantic caching** extends the idea using the same embedding-based similarity techniques covered in this track's retrieval lessons: instead of matching on exact input text, embed the incoming request and check whether a sufficiently similar past request (above some similarity threshold) already has a cached response — "what's the capital of France" and "what is France's capital city" are different strings but semantically near-identical, and a semantic cache can recognize this and serve a cached response for either, where exact-match caching would treat them as entirely unrelated requests.

This meaningfully improves cache hit rate for naturally-varied phrasing of the same underlying question, at real added complexity and risk: the similarity threshold is a genuine precision/recall tradeoff (too loose, and genuinely different questions get served the same cached answer incorrectly; too tight, and the semantic matching barely improves on exact-match caching's hit rate) that needs tuning against real query data, similar in spirit to the retrieval evaluation methodology covered in this track's embedding-model lesson.

## Why caching LLM responses needs more care than caching typical API responses

Ordinary API response caching (covered in the system-design track's caching lesson) generally assumes that for the same input, the same output is always correct to serve. LLM responses complicate this assumption in a few specific ways:

- **Sampling randomness.** A non-zero temperature setting means the same prompt can legitimately produce different (but equally valid) outputs on different calls — caching one particular sampled response and serving it repeatedly changes the actual behavior from "sample a fresh response each time" to "always return this one specific past sample," which may or may not be the intended behavior depending on the use case.
- **Time-sensitivity.** A cached response to "what's the latest version of X" can silently become wrong as time passes, even though the cache entry itself hasn't changed — response caching needs the same TTL/invalidation thinking covered in the system-design caching lesson, and arguably needs it more carefully, since a stale LLM response can be confidently wrong in a way that's harder for a user to detect than an obviously-outdated cached webpage.
- **Semantic near-misses are riskier than exact near-misses.** A cache serving a slightly-wrong response due to over-loose semantic matching produces a plausible-sounding but incorrect answer, which is a worse failure mode than a typical cache miss (which just costs a bit more latency) — this argues for a more conservative similarity threshold than might seem necessary from hit-rate optimization alone.

## A worked example

**Scenario:** a customer support chatbot handling a mix of frequently-repeated common questions (return policy, shipping times) and unique, account-specific questions.

- **Semantic caching is applied selectively**, not universally: common policy questions (which are genuinely repeated with varied phrasing across many users, and whose correct answer doesn't depend on any individual user's specific context) are strong candidates — a semantic cache hit here reliably serves a correct, appropriate answer regardless of exact phrasing.
- **Account-specific questions are explicitly excluded from caching** ("what's the status of my order") — these depend on the individual user's data at request time, so even an exact text match wouldn't imply the same correct answer for two different users, making response caching actively wrong here rather than merely unhelpful.
- **A moderate-conservative similarity threshold** is chosen for the cacheable policy-question category, tuned against a labeled set of query pairs (some genuinely equivalent, some subtly different) to find a threshold that catches real paraphrases without conflating genuinely different questions — validated the same way the embedding-model lesson's evaluation methodology recommends, not set by a guessed default.
- **TTL on cached policy answers** ensures a policy change (a new stated return window, for instance) propagates within a bounded time, rather than the cache silently serving an outdated policy indefinitely.

## Common mistakes

- **Applying response caching uniformly across all request types**, including ones (account-specific, time-sensitive, or genuinely needing sampling variation) where a cached response is actively wrong rather than just a missed optimization opportunity.
- **Setting a semantic similarity threshold without validating it against real query pairs.** An untuned threshold can silently conflate meaningfully different questions, producing confidently wrong cached answers — a failure mode that's harder to notice than an ordinary cache miss, since the response still looks plausible.
- **No TTL or invalidation strategy for cached responses about time-sensitive information.** A response cache without staleness handling can serve a confidently-stated but now-outdated answer indefinitely, which is a worse failure than a typical stale-cache scenario precisely because the LLM's fluent phrasing makes the staleness harder for a user to detect.
