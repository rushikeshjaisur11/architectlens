---
title: "Cache-Aside vs Write-Through vs Write-Behind: Tradeoffs in Practice"
short_title: "Cache Write Strategies"
tags: ["caching", "cache-aside", "write-through", "write-behind", "consistency", "system-design"]
sources:
  - "AWS Whitepaper: Database Caching Strategies Using Redis"
  - "Redis documentation: Caching patterns"
  - "Facebook/Meta engineering: Scaling Memcache at Facebook (NSDI 2013)"
---

## The three strategies

**Cache-aside** (also called lazy loading) puts the application in charge of the cache. On a read, the app checks the cache; on a miss, it reads from the database, then writes the result back into the cache. On a write, the app writes to the database and either invalidates or updates the corresponding cache key. This is the strategy behind Memcached at Facebook and the default pattern for Redis-fronted read paths — the cache holds no logic of its own, and both read and write paths route explicitly through application code.

**Write-through** couples writes to the cache and database synchronously: the app (or a caching layer in front of the database) writes to the cache first, and the cache writes through to the database before the write is considered complete. Every write pays the latency of both stores, but the cache is never stale relative to the database — a read after a write always sees the fresh value.

**Write-behind** (write-back) also writes to the cache first, but the database write is deferred and applied asynchronously, batched or queued. The write call returns as soon as the cache is updated, and a background process flushes changes to the database later.

## Tradeoffs that actually matter

**Cache-aside** is the default because it's resilient and simple: if the cache goes down entirely, the app still works — every read just falls through to the database, degraded but correct. Its weakness is the read-after-miss penalty (three round trips: check cache, miss, hit DB, populate cache) and a **stale-read window** between a database write and the corresponding cache invalidation — a classic race where a concurrent read can populate the cache with a value that's about to be overwritten. Mitigation is usually a short TTL plus invalidate-on-write, accepting that perfect consistency isn't the goal.

**Write-through** eliminates the stale-cache problem for values that go through it, at the cost of write latency — every write now blocks on two systems instead of one, and if the cache is unavailable, writes either fail or must bypass the cache and directly hit the DB (which then makes the cache stale again). It also **cache-pollutes**: data gets written to cache even if it's never read, wasting memory on cold values. Write-through pairs well with read-heavy, write-light workloads where consistency matters more than write throughput (e.g., session stores, configuration data).

**Write-behind** gives the best write latency and can coalesce multiple writes to the same key into one DB write (useful for counters, view counts, leaderboard scores), but it trades away durability: if the cache node crashes before flushing to the database, those writes are lost. It also introduces read-your-own-write ambiguity for any reader that bypasses the cache and queries the database directly, since the database is temporarily behind. This pattern shows up in systems willing to accept eventual consistency for throughput — write-behind caches in front of analytics pipelines, or Kafka-backed buffering in front of a database.

## Choosing in practice

The decision usually reduces to: how much staleness can this data tolerate, and can the write path afford synchronous coupling to two stores? Cache-aside is the right default for most read-heavy services. Write-through is worth the latency cost when correctness after a write is non-negotiable (auth tokens, inventory counts near zero). Write-behind is reserved for high-write-volume, loss-tolerant data where the database would otherwise be a bottleneck — and it demands a durable queue or replay log in front of the cache to bound the blast radius of a cache-node failure.

## Common mistakes

- **Using write-through as if it guarantees cross-service consistency.** It only guarantees the cache and DB agree with each other after the write completes — concurrent readers hitting a replica DB or a different cache node can still see stale data.
- **Assuming write-behind is "just async write-through."** The durability gap is the whole point of the tradeoff; treating it as a drop-in latency optimization without a replay/retry mechanism risks silent data loss on crash.
- **Never expiring cache-aside entries.** Without a TTL, a value that was correct at population time can drift out of sync indefinitely if an invalidation is ever missed (a bad deploy, a bug in the invalidation path) — TTL is the backstop, not the primary consistency mechanism.
