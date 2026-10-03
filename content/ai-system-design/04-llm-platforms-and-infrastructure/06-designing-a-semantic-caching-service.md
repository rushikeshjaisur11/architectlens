---
title: "Designing a Semantic Caching Service"
short_title: "Semantic Caching Service"
tags: ["caching", "semantic-cache", "embeddings", "cost", "latency", "design"]
sources:
  - "Public documentation and open-source projects on semantic caching for LLM applications"
  - "Karger et al., consistent hashing papers (distributed cache partitioning background)"
  - "Provider documentation on prompt caching versus response caching"
  - "Secondary reports on semantic cache hit rates and AWS-published chatbot research, 2026 (futureagi.com, spheron.network, getmaxim.ai)"
  - "Anthropic pricing documentation, prompt caching (fetched Oct 2026)"
predict:
  question: "With a similarity threshold of 0.9, a user asks for the daily transfer limit for business accounts, scoring 0.88 against a cached retail entry. What happens?"
  options: ["The cached retail answer is returned since 0.88 is close enough", "The cache returns it after the entity check passes", "The model is called, since 0.88 is below the threshold and the scope differs"]
  answer: 2
  why: "The request misses on both counts: similarity is under 0.9 and the scope key differs, so the model answers."
check:
  - q: "Why run a shadow job that recomputes sampled cache hits with the model?"
    options: ["It measures the live false-hit rate, which hit rate alone cannot show", "It refreshes stale entries before their TTL expires", "It raises the similarity threshold automatically over time"]
    answer: 0
    why: "Sampled recomputation compares cached and fresh answers, giving a real false-hit rate (0.2 percent in the example)."
  - q: "Why store source document ids as metadata on cache entries?"
    options: ["To raise similarity scores for entries drawn from the same document", "To evict affected entries when a source or policy changes", "To let exact-match lookups skip the scope key"]
    answer: 1
    why: "Event-driven invalidation evicts tagged entries when the document changes, so nobody gets the old number."
  - q: "Why add entity checks or a verifier on top of a high similarity threshold?"
    options: ["Embedding lookups are too slow to trust without a second verification pass", "Provider prompt caching requires verified entries before any reuse", "Near-identical wording can hide different needs, like cancelling an order versus a plan"]
    answer: 2
    why: "Embedding similarity is a blunt instrument; verification catches near-matches that are not truly equivalent."
---

## The problem

Many LLM requests are repeats or near-repeats: the same FAQ asked many ways, the same document summarised again. Calling the model each time costs money and seconds. A **semantic caching service** stores previous responses and returns them for requests that mean the same thing, cutting cost and latency, at the risk of serving a **wrong answer** when two questions only look alike. The design is a careful balance of hit rate and correctness.

## Step 1: Requirements

- **Hit rate:** catch paraphrases, not just identical strings.
- **Correctness:** a wrong cached answer is worse than a slow right one, so make false hits very rare.
- **Latency:** a cache lookup must add little (under 20 ms) and be much faster than the model.
- **Isolation:** never leak an answer between users, tenants or permission scopes.
- **Freshness:** answers expire when underlying facts change.
- **Scale (example):** 20,000 lookups per second, 50 million cached entries.

## Step 2: Two layers of caching

Distinguish them; use both:

- **Exact-match cache:** key is a hash of the normalised request (model, parameters, messages). Instant, zero risk, ideal for deterministic, repeated calls.
- **Semantic cache:** embed the request and search for a stored request whose embedding is above a similarity threshold; return its response. Higher hit rate, nonzero risk.

Also related but separate: **provider prompt caching** (reusing processed prefixes) reduces cost without changing the answer, and should be exploited first.

## Step 3: Lookup flow

1. Normalise the request (trim, lowercase where safe, strip volatile fields) and compute the **scope key**: tenant, user or permission group, model, prompt version, and any relevant context ids.
2. Check the exact-match cache within the scope.
3. On a miss, embed the request and run an ANN search **restricted to the scope**.
4. If the top candidate exceeds the threshold, run a **verification step** (below); if it passes, return the cached response.
5. Otherwise call the model, store the request, embedding and response with metadata (timestamps, TTL, cost saved, source documents) and return it.

## Step 4: Avoiding wrong hits

Embedding similarity is a blunt instrument. "How do I cancel my subscription?" and "How do I cancel my order?" can be close yet need different answers. Controls:

- **A high threshold**, tuned on labelled pairs of equivalent and non-equivalent requests to a target false-hit rate, not picked by feel.
- **Per-route thresholds:** stricter for high-stakes routes, looser for casual chat.
- **Verification:** a cheap cross-encoder or small model checks that the new request and the cached one are truly equivalent; or compare extracted entities (product names, numbers, dates) and require them to match.
- **Exclusions:** do not cache requests whose answers depend on user-specific or real-time data, tool results, or non-deterministic creative output.
- **Shadow evaluation:** periodically recompute a sample of cache hits with the model and compare, to measure the live false-hit rate.

## Step 5: Isolation and privacy

The cache is a data-leak risk. Scope every entry by tenant and by the user or group whose data influenced the answer. Do not cache responses that include personal data unless scoped to that person. Encrypt at rest, apply retention, and support deletion by user and tenant. Treat cached content as sensitive as the logs.

## Step 6: Invalidation and freshness

- **TTL by content type:** short for volatile topics, long for stable ones.
- **Event-driven invalidation:** when a source document or policy changes, evict entries tagged with it (store source ids as metadata).
- **Versioning:** include the prompt version and model version in the scope, so upgrades naturally start with a cold cache for the changed route.
- **Soft expiry:** serve slightly stale answers while refreshing in the background for low-risk routes.

## Step 7: Storage and scale

Store entries in a key-value store with the vector index alongside (or a vector database with filters). Partition by scope with consistent hashing so a tenant's entries are colocated. Use an in-memory tier for hot entries and eviction by recency and frequency. Keep the embedding model cheap and fast, since it runs on every lookup; batch embedding calls where possible.

## Step 8: Measuring value

Report **hit rate**, **cost saved** (tokens avoided times price), **latency saved**, **false-hit rate** from shadow checks, and the distribution of similarity scores of hits. A cache with a 40 percent hit rate and a 0.5 percent false-hit rate may or may not be worth it depending on the stakes; make that trade-off explicit per route.

## A worked example

**Scenario:** a bank's help assistant sees many variations of "what is the daily transfer limit".

1. The first asker's request misses; the model answers and the entry is stored in the "retail customers, policy v12" scope with a 24-hour TTL and the policy document id as a tag.
2. A second user asks "how much can I send per day?" The embedding similarity is 0.93 against a threshold of 0.9; the entity check finds no conflicting product or amount; the cached answer is returned in 12 ms.
3. A third user asks "what is the daily transfer limit for business accounts?" Similarity is 0.88, below threshold, and the scope differs anyway, so the model is called.
4. The policy team updates the limit; the policy change event evicts all entries tagged with that document, so nobody is served the old number.
5. A nightly shadow job recomputes 500 sampled hits with the model and finds 1 disagreement, reporting a false-hit rate of 0.2 percent.

## Enterprise practice (verified October 2026)

**Basics.** Embed the query, look up a near neighbour above a similarity threshold, return the stored answer (steps above).

**Do not confuse three different caches.** (1) **Provider prompt caching** reuses a long prompt prefix inside the model service; on Anthropic a cache read costs 0.1x input and lasts 5 minutes or 1 hour. (2) **KV-prefix caching** in your own serving stack (vLLM, llm-d). (3) **Semantic caching** returns a previous *answer* for a similar question and skips the model call entirely. Only the third can return a wrong answer.

**Reported hit rates (secondary; widely varying).** Practitioner guides say a tuned semantic cache typically hits **25 to 45%**, with customer-service and FAQ workloads at **30 to 60%**; academic work reports 60 to 70% on curated query sets, and AWS-published research on real chatbot queries reports much higher rates and cost and latency reductions of about **86% and 88%** on cached responses. Cached hits return in roughly **5 to 20 ms** versus about 1 to 3 seconds for a model call. Treat the high numbers as best-case, FAQ-style traffic.

**Enterprise safeguards.** Key the cache by **tenant, permissions, model, prompt version and retrieval snapshot**, otherwise one user receives another's answer. Do not cache personalised or time-sensitive answers; set short TTLs on volatile facts; use a high similarity threshold plus an optional cheap verifier for risky categories; and track *wrong-hit* rate through sampled review, not just hit rate. Recent research proposes asynchronous verification of cached answers by a stronger model; consider it for high-stakes domains.

## Common mistakes

- **One global cache** with no tenant or user scoping.
- **A threshold picked by feel** and never validated.
- **Caching answers that depend on live or personal data.**
- **No invalidation** when source documents change.
- **Ignoring provider prompt caching**, the safest saving.
