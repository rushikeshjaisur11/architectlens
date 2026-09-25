---
title: "Designing a URL Shortener, End to End"
short_title: "Designing a URL Shortener"
tags: ["product-design", "case-study", "interview-practice"]
sources:
  - "System design interview practice materials (general pattern, synthesized from multiple public writeups)"
---

## Why this is a useful design to walk through fully

A URL shortener is a small enough system to design completely in the time available for an interview or a study session, while still touching most of the core tradeoffs covered elsewhere in this track: estimation, ID generation, caching, and read/write ratio design. Working through one system end to end — rather than studying each concept in isolation — is what actually builds the judgment to combine them under a real set of constraints.

## Step 1: Clarify requirements

Before designing anything, pin down what's actually being asked, since "a URL shortener" can mean meaningfully different systems depending on the details:

- Functional: shorten a long URL into a short one; redirect a short URL to its original long URL; (optionally) custom aliases, expiration, click analytics.
- Non-functional: high availability (a broken redirect is a broken link everywhere it's shared), low redirect latency (this sits on the critical path of a link click), and a read-heavy access pattern (far more redirects happen than new URLs get created, per this track's estimation lesson's read/write ratio point).

## Step 2: Estimate scale

Using the back-of-envelope method from this track's estimation lesson: assume 100 million new short URLs per month, and — since this is a read-heavy product where a link gets clicked far more times than it's created — a 100:1 read-to-write ratio.

- Writes: ~38/second average (100M / 30 days / 86,400 seconds).
- Reads: ~3,800/second average, before accounting for peak multipliers.
- Storage over 5 years: roughly 1 TB, as walked through in the estimation lesson's worked example — comfortably fits on well-provisioned storage without needing to shard purely for size, though write/read throughput may still call for horizontal scaling of the *serving* layer independent of storage size.

## Step 3: High-level design

Two core flows: **shorten** (long URL in, short code out) and **redirect** (short code in, HTTP redirect to the long URL out). At a high level:

```
Client → Load Balancer → Application Servers → Cache → Database
```

The redirect path is the one that needs to be fast and highly available, given it's on the critical path of every link click across the internet — this shapes several of the decisions below.

## Step 4: Short code generation

This is the design's central technical decision, and it connects directly to this track's NoSQL/partitioning lesson on ID generation:

- **Base62 encoding of an auto-incrementing ID** — encode a numeric ID (from a counter) into a 6-7 character string using [a-zA-Z0-9] (62 possible characters per position). Simple, and 7 characters gives 62^7 (roughly 3.5 trillion) possible codes — comfortably enough for the estimated scale. The counter itself needs to be safe under concurrent writes and, if sharded, needs one of the distributed-ID approaches (Snowflake-style, or reserved ID ranges) from the NoSQL lesson, rather than a single naive auto-increment that becomes a write bottleneck or a single point of failure.
- **Hash-based (e.g., MD5 of the URL, truncated)** — deterministic (the same URL always maps to the same code, which can be a feature for de-duplication or a bug if the product wants distinct codes for repeated shortenings of the same URL) but needs collision handling, since truncating a hash means different inputs can map to the same short code.

The counter-based approach is generally simpler to reason about and avoids collision-handling complexity, at the cost of needing a coordinated ID-generation mechanism if the system is sharded.

## Step 5: Data model and storage

A simple mapping table: `short_code (primary key) → long_url, created_at, expires_at`. This is a natural fit for a key-value or simple relational store — the access pattern is almost entirely single-key lookups (given a short code, get the long URL), which doesn't need the relational join capability of a more complex schema (connecting back to this track's normalization lesson: this data genuinely doesn't benefit from further normalization, since there's no related data that needs joining for the core redirect path).

## Step 6: Caching the hot path

Since reads vastly outnumber writes, and a small fraction of shortened URLs (viral links, popular pages) likely account for a disproportionate share of redirect traffic, a cache (Redis, per this track's caching lesson) sitting in front of the database absorbs most read traffic — a redirect for a popular short code should almost always be a cache hit, only falling back to the database for long-tail, rarely-accessed codes. Cache-aside is the natural fit here (per the caching lesson's pattern breakdown): populate the cache on a miss, since pre-populating every possible short code ahead of time isn't practical or necessary.

## Step 7: Availability and the redirect's critical path

Given redirects need to work everywhere a link has been shared, the redirect path specifically deserves a highly-available design even if the "create a new short URL" path has looser availability requirements — this is a case where treating every part of a system as equally critical would over-engineer the write path and potentially under-engineer the read path relative to what actually matters for the product's core promise. Read replicas of the database, plus the cache layer above, both primarily serve to keep the redirect path fast and available even under database maintenance or partial degradation.

## Common mistakes

- **Designing without ever explicitly stating the estimated scale**, then making architectural decisions (sharding, caching, ID generation strategy) that don't actually match a defensible number — the estimation step exists specifically to ground later decisions in something concrete rather than vague intuition about what a "large" system needs.
- **Over-designing the write path to match the read path's requirements.** A URL shortener's create-a-short-link flow can tolerate meaningfully more latency and lower availability than the redirect flow — treating both as equally critical adds unnecessary complexity to the less important path.
- **Choosing hash-based short codes without a clear plan for collision handling**, or choosing counter-based codes without a clear plan for safe ID generation under horizontal scaling — both approaches have a specific, known complexity point that needs an explicit answer, not a hand-wave.
