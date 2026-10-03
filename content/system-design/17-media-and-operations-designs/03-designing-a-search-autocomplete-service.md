---
title: "Designing a Search Autocomplete Service"
short_title: "Search Autocomplete Service"
tags: ["autocomplete", "trie", "search", "caching", "low-latency"]
sources:
  - "Manning, Raghavan and Schütze, Introduction to Information Retrieval (2008), on prefix and wildcard queries"
  - "Public engineering articles on typeahead and query suggestion systems"
  - "Fredkin (1960) on trie data structures"
banner:
  layout: line
  nodes:
    - [user, "keystroke"]
    - [cache, "prefix cache"]
    - [db, "trie"]
    - [doc, "suggestions"]
---

## What autocomplete has to do

As the user types, the service returns the most useful completions for the current prefix. The constraints are demanding:

- **Very low latency.** Suggestions must appear within roughly 100 ms of a keystroke, or they feel laggy and become useless as the user keeps typing.
- **Very high request volume.** Every keystroke can trigger a request, so autocomplete traffic often exceeds search traffic by an order of magnitude.
- **Relevance.** Ranking matters more than coverage; the top five suggestions are what users see.
- **Freshness.** Trending queries should surface quickly, without letting a spike distort results.

## The core data structure: a trie

A **trie** (prefix tree) stores strings by shared prefixes. Each node represents a prefix, and its children extend it by one character. To answer "what completes `new y`?", walk to the node for that prefix and collect suggestions beneath it.

Collecting every descendant at query time is too slow for popular short prefixes (the node for `a` has millions of descendants). The standard optimization is to **precompute and store the top K suggestions at every node**, ranked by score. A lookup then becomes: walk the prefix, return the stored list. That is O(length of prefix), independent of how many completions exist.

The trade-off is memory and update cost: top-K lists at every node enlarge the structure, and changing a score may require updating lists along the path. Systems manage this by rebuilding periodically rather than updating live for every event.

## Ranking suggestions

A query's score typically combines:

- **Popularity** — how often it has been searched, usually with **time decay** so old trends fade.
- **Recency / trending** — a short-window frequency spike.
- **Personalization** — the user's own history or locale, applied as a re-ranking step on a small candidate list.
- **Quality filters** — remove offensive, illegal or low-quality suggestions.

Keep the serving index simple (global popularity) and apply personalization afterward on top candidates, since personalizing inside the trie would multiply storage.

## The data pipeline

Autocomplete data comes from logs of past queries, processed offline:

1. **Collect** query events from search logs.
2. **Aggregate** counts per query over time windows, in a batch or stream job, applying decay.
3. **Filter** unsafe or rare queries (a minimum frequency threshold also protects privacy by not exposing queries only one person typed).
4. **Build** the trie or an equivalent index with top-K per prefix.
5. **Publish** the new snapshot to serving nodes, swapping atomically.

A **slow path** (hourly or daily rebuild) captures stable popularity, and a **fast path** (streaming updates for the last few minutes) injects trending items. Serving merges both.

## Serving architecture

- **Client-side measures.** Debounce keystrokes (wait 50 to 100 ms of inactivity before sending), cancel stale in-flight requests, and cache results for prefixes already typed. Once a user types `new`, the results for `ne` need not be requested again if the user deletes a character.
- **Edge and server caching.** Short prefixes are extremely hot and few in number, so they cache extremely well. Cache responses at the CDN or an in-memory layer keyed by prefix.
- **In-memory serving nodes** hold the index, sharded if too big. Sharding by prefix range keeps related lookups together, though a skew problem arises because some prefixes (`s`, `a`) are far hotter than others, so shard by observed load rather than alphabet slices.
- **Replication** gives availability and throughput; read replicas are cheap because the index is read-only between rebuilds.

## Alternatives to a pure trie

Memory-heavy tries can be replaced by compressed structures (radix trees, finite state transducers), or by a **search engine index** with edge n-grams, which also handles typos and matching in the middle of words. Typo tolerance and fuzzy matching need extra machinery (edit-distance candidates), applied to a limited candidate set to protect latency.

## A worked example

**Scenario:** a shopping site with 50 million distinct past queries.

- The batch job aggregates 90 days of queries with exponential decay, drops those below 20 searches, filters banned terms, and writes the top 10 completions for every prefix up to 20 characters.
- The index is about 8 GB and fits in memory on each serving node. The new snapshot is loaded in the background and swapped in at once.
- A streaming job tracks the last 15 minutes. When a new product launches and `iphone 17` surges, the fast path boosts it into the top results for matching prefixes within minutes, without waiting for the nightly rebuild.
- A user types `iph`; the client waits 80 ms after the last keystroke, then sends one request. The edge cache already holds `iph`, so the answer returns in about 10 ms.

## Common mistakes

- **Searching the full descendant set at query time** instead of precomputing top-K.
- **Sending a request on every keystroke** with no debounce or cancellation.
- **Showing rare queries**, which leaks private information and adds noise.
- **Never rebuilding**, so suggestions go stale, or **rebuilding in place**, serving a half-built index.
- **Sharding alphabetically**, producing hot shards.
- **No safety filter** on suggestions.
