---
title: "Cache Eviction Policies and the Thundering Herd Problem"
short_title: "Cache Eviction and Thundering Herd"
tags: ["caching", "eviction", "performance", "reliability"]
sources:
  - "Redis documentation on eviction policies"
  - "Facebook engineering blog, posts on cache stampede mitigation (memcache scaling papers)"
banner:
  layout: line
  nodes:
    - [cache, "LRU cache"]
    - [doc, "expiry"]
    - [client, "herd"]
    - [shield, "single flight"]
predict:
  question: "A 3-entry cache holds hot item A (read thousands of times). Then one-off keys X, Y and Z are each read once, after A's last read. Then A is requested again. What happens?"
  options:
    - "LRU still hits A, since A was read thousands of times earlier"
    - "LRU has evicted A and misses, while LFU kept A and dropped a one-off key"
    - "Both policies miss A, because three new keys always flush a 3-entry cache"
  answer: 1
  why: "LRU only tracks recency, so A becomes the oldest entry despite its track record, while LFU favors items with a history of repeated access."
check:
  - q: "Why is TTL not a capacity-management eviction policy on its own?"
    options:
      - "TTL evicts the most frequently used entries first, so it already manages space"
      - "The cache can fill before entries expire, so LRU or LFU is still needed and TTL bounds staleness"
      - "TTL is only supported by Redis, so other caches need LRU for expiry"
    answer: 1
    why: "TTL limits how old an entry may be, not how much space is used, so it is layered alongside LRU or LFU."
  - q: "What does stale-while-revalidate trade for removing the latency and origin spike on a miss?"
    options:
      - "Up to one extra refresh cycle of staleness, in return for no latency or origin spike"
      - "Higher origin load, because every request now triggers its own background refresh"
      - "The ability to coalesce requests, since waiting requests no longer share one fetch"
    answer: 0
    why: "Requests get the previous cached value immediately while the refresh runs in the background, which costs a bounded amount of extra staleness."
  - q: "A cache shows a 99 percent hit rate in steady state, yet the origin falls over when a popular key expires. Why?"
    options:
      - "The hit rate was likely measured wrongly, since 99 percent should always protect the origin"
      - "LFU was chosen over LRU, and LFU drops popular keys at expiry"
      - "The average hides the expiry instant, when concurrent requests all miss together and reach the origin"
    answer: 2
    why: "A healthy average says nothing about the worst-case instant, which needs coalescing, jitter or stale-while-revalidate."
---

## Why a cache needs an eviction policy at all

A cache is finite — it can't hold every piece of data a system might ever want to serve fast, only some working subset. Once it fills up, adding a new entry requires removing an existing one, and *which* entry gets removed materially affects hit rate: evict something still being accessed frequently, and you've traded a future fast cache hit for a future slow cache miss, for no good reason.

## Common eviction policies

- **LRU (Least Recently Used)** — evict whichever entry hasn't been accessed for the longest time. The most common default, based on the reasonable assumption that recently-accessed data is more likely to be accessed again soon (temporal locality) — a pattern that holds for many real workloads.
- **LFU (Least Frequently Used)** — evict whichever entry has been accessed the fewest total times. Better than LRU for workloads with a stable set of consistently-popular items alongside a lot of one-off, rarely-repeated accesses, since LRU can evict a genuinely popular item just because it wasn't the *most recent* thing accessed, while LFU correctly favors items with a track record of repeated access.
- **TTL-based expiration** — entries are evicted once they exceed a configured age, independent of access frequency or recency. This isn't really a capacity-management eviction policy on its own (a cache can still fill up before entries' TTLs expire) — it's usually layered alongside LRU or LFU specifically to bound staleness (per this track's caching strategies lesson), not to manage cache size.

Most production caches (Redis included) support multiple configurable eviction policies, and the right choice genuinely depends on the actual access pattern — LRU is a reasonable default, but a workload with strong frequency-based popularity skew (a small set of items accessed constantly, a long tail accessed rarely) often benefits measurably from LFU instead.

<div data-anim="eviction-policies"></div>

## The thundering herd / cache stampede problem

A specific, easy-to-miss failure mode: when a popular cache entry expires (or is evicted), and many concurrent requests for that same key arrive around the same time, *all* of them see a cache miss simultaneously and *all* of them fall through to the expensive origin (database, external API) at once — a sudden spike of redundant load hitting the origin for what should have been a single cache-refill operation. This is called a **thundering herd** or **cache stampede**, and it's particularly dangerous for very popular keys, since popularity is exactly what makes many concurrent requests for the same key likely in the first place.

<div data-anim="thundering-herd"></div>

## Mitigating thundering herd

- **Request coalescing (single-flight)** — when a cache miss occurs, the first request to notice the miss takes responsibility for fetching from the origin, and any other concurrent requests for the *same key* wait for that in-flight fetch to complete rather than independently triggering their own redundant origin fetch. This turns N simultaneous origin requests for the same expired key into just one.
- **Early/probabilistic expiration** — instead of a hard expiration cutoff, entries are refreshed slightly *before* they actually expire, with a small random jitter added so many entries with the same nominal TTL don't all expire at the exact same instant (which itself can cause a synchronized stampede across many different keys simultaneously, not just one).
- **Stale-while-revalidate** — serve the (now slightly stale) cached value immediately to the requesting client while asynchronously refreshing the cache in the background, rather than making every request wait for a fresh fetch. This accepts a small, bounded amount of extra staleness in exchange for eliminating the latency spike and origin load spike that a synchronous refetch-on-every-miss approach causes.

## A worked example

**Scenario:** a news site's homepage summary is cached with a 60-second TTL, and receives thousands of requests per second — a classic setup for a thundering herd the moment that cache entry expires.

- **Without mitigation**: every 60 seconds, the cache entry expires, and the next wave of thousands of concurrent requests all see a miss simultaneously, all hit the origin (regenerating the homepage summary) at once — a sharp, repeating load spike on the origin exactly synchronized with the TTL, potentially overwhelming it if the regeneration work is non-trivial.
- **With request coalescing**: only the first of those thousands of concurrent requests actually triggers the origin regeneration; the rest wait briefly for that one in-flight regeneration to finish and then read the freshly-cached result — reducing thousands of redundant origin hits to exactly one per expiration cycle.
- **With stale-while-revalidate added on top**: even the "waiting" requests don't have to wait at all — they're served the previous, still-recent cached value immediately while the refresh happens in the background, and the *next* request after the refresh completes gets the updated value — eliminating both the origin load spike and any latency spike for end users, at the cost of up to one refresh cycle's worth of additional staleness.

## Common mistakes

- **Setting cache TTLs without considering that many keys sharing the same TTL can expire in near-perfect synchronization**, causing a stampede across the whole cache rather than a spread-out, manageable refresh pattern — jitter on expiration times directly addresses this.
- **Assuming a cache automatically protects the origin from load, without accounting for the miss case.** A cache with a high hit rate under steady state can still let through a very sharp, damaging load spike specifically at the moment of a popular key's expiration if thundering-herd protection isn't in place — the average hit rate looking good doesn't mean the worst-case moment is handled.
- **Choosing LRU by default without checking whether the workload's actual access pattern is closer to frequency-based than recency-based.** For a workload with a small set of consistently hot items and a large tail of one-off accesses, LRU can underperform LFU meaningfully, and this is only found by checking real access pattern data, not assumed from LRU being the common default.
