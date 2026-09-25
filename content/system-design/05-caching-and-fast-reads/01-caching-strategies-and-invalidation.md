---
title: "Caching Strategies and the Invalidation Problem"
short_title: "Caching Strategies"
tags: ["caching", "performance", "distributed-systems"]
sources:
  - "Phil Karlton (attributed), on cache invalidation being one of the two hard problems in computer science"
  - "Redis and Memcached documentation on caching patterns"
---

## Why caching works

Most systems read data far more often than they write it, and the same small set of "hot" items usually accounts for a disproportionate share of reads (a power-law access pattern). A cache exploits this by keeping a copy of frequently-accessed data in a faster storage tier — memory instead of disk, a nearby server instead of a cross-region database — so repeated reads for the same data avoid the expensive path entirely.

The speedup only materializes if the cache actually gets hit often enough to justify its cost and complexity — a cache with a low hit rate (because access patterns are too uniform, or the cache is too small to hold the working set) adds latency and operational overhead for little benefit.

## Where to put the cache

- **Client-side / browser cache** — closest to the user, zero network cost on a hit, but invisible to the server, so invalidation relies on cache headers (`Cache-Control`, `ETag`) the client honors.
- **CDN / edge cache** — sits between clients and origin servers, good for content that's the same for every user (static assets, public API responses); poor fit for personalized data.
- **Application-level cache (Redis, Memcached)** — sits between the application and the database, controlled entirely by application code, which means precise control over what's cached and for how long, at the cost of being another service to run and keep available.
- **Database-internal cache (buffer pool)** — the database's own memory cache of recently-accessed pages; mostly transparent to the application, but bounded by that one database instance's memory.

## Cache-aside vs. write-through vs. write-behind

- **Cache-aside (lazy loading):** the application checks the cache first; on a miss, reads from the database and populates the cache for next time. Simple and only caches what's actually requested, but the first request for any item is always a slow "cold" read, and there's a window where cache and database can disagree if the database is updated by a path that doesn't also update the cache.
- **Write-through:** every write goes to the cache and the database together, synchronously. Cache is always consistent with the database, but every write pays the latency of both, and the cache fills up with data that may never be read again.
- **Write-behind (write-back):** writes go to the cache immediately and are flushed to the database asynchronously afterward. Fast writes, but risks data loss if the cache fails before the flush completes, and needs careful handling to avoid returning inconsistent state to a read that races the flush.

Cache-aside is the most common default for read-heavy workloads with a clear query pattern; write-through and write-behind matter more when writes themselves need to be fast and the cache is closer to being a primary store than a side optimization.

## The actual hard part: invalidation

Populating a cache is easy. Knowing *when a cached value is no longer correct* is the hard problem — this is what "cache invalidation is one of the two hard problems in computer science" is actually about.

- **TTL (time-to-live) expiration** — simplest approach: cache entries automatically expire after a fixed duration, regardless of whether the underlying data changed. Guarantees staleness is bounded (never more than TTL seconds old), but a short TTL means more cache misses and load on the source, while a long TTL means longer windows of serving stale data.
- **Explicit invalidation on write** — when the underlying data changes, the write path also deletes or updates the corresponding cache entry. Precise (no unnecessary staleness), but requires every write path to remember to invalidate the right keys — miss one code path and that cache entry silently goes stale forever, with no TTL to eventually correct it.
- **Event-driven invalidation** — a write publishes a change event (e.g., to a message queue), and cache-invalidation logic subscribes and evicts affected keys. Decouples the write path from needing direct cache knowledge, at the cost of introducing eventual consistency (a window between the write and the event being processed) and another moving piece that can fail silently.

A common, pragmatic middle ground: use explicit invalidation for correctness-critical data, backed by a TTL as a safety net in case an invalidation path is missed — so a bug degrades to "a few seconds of staleness" instead of "permanently wrong until server restart."

## A worked example

**Scenario:** a product page that shows price and stock count, both of which can change frequently.

- **Cache-aside with a short TTL (e.g., 30 seconds)** for the product page's rendered content — accepts up to 30 seconds of staleness on price/stock display, which is usually acceptable for a browsing page (the actual checkout flow re-validates price and stock against the database directly, never trusting the cached page).
- **Explicit invalidation** on the specific `product:{id}:price` cache key whenever an admin updates a price, so a deliberate price change is reflected immediately rather than waiting out the TTL — layered on top of the TTL safety net, not instead of it.

This two-layer approach — TTL as a floor, explicit invalidation for known-important changes — is common precisely because relying on either alone has a failure mode: TTL alone means every change waits out the full TTL before showing up; invalidation alone means a missed code path goes stale forever.

## Common mistakes

- **Caching without a TTL and relying entirely on invalidation.** One missed invalidation path (a bulk update script, an admin tool, a migration) leaves that cache entry wrong indefinitely with no self-correction.
- **Setting TTLs uniformly across very different data types.** A user's display name changes rarely and can tolerate a long TTL; a stock count changes constantly and needs a much shorter one — one blanket TTL config is usually wrong for most of what it's applied to.
- **Caching at too coarse a granularity**, so a small change (one field on a large object) forces invalidating and rebuilding the entire cached object, losing most of the caching benefit for that key.
