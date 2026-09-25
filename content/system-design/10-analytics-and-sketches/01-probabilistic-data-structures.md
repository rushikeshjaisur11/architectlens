---
title: "Probabilistic Data Structures: Approximate Answers at Massive Scale"
short_title: "Probabilistic Data Structures"
tags: ["analytics", "sketches", "bloom-filters", "hyperloglog"]
sources:
  - "Burton Bloom, 'Space/Time Trade-offs in Hash Coding with Allowable Errors' (1970)"
  - "Flajolet et al., 'HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm' (2007)"
---

## Why exact answers sometimes aren't worth the cost

Some questions over massive datasets have exact answers that are prohibitively expensive to compute precisely: "how many unique visitors did this site have today" (a billion events, needing exact deduplication), or "is this URL in our blocklist of 500 million entries" (needing either all 500 million entries in memory or an expensive disk lookup per check). Probabilistic data structures trade a small, quantifiable amount of accuracy for dramatic reductions in memory and computation — often turning a gigabytes-and-minutes problem into a kilobytes-and-microseconds one.

## Bloom filters: fast, memory-cheap set membership

A Bloom filter answers "is this item possibly in the set" using a bit array and several hash functions: adding an item sets several bits (one per hash function); checking an item looks at those same bit positions. If any is unset, the item is **definitely not** in the set. If all are set, the item is **probably** in the set — possibly a false positive, but never a false negative.

This asymmetry — no false negatives, possible false positives — is what makes Bloom filters useful as a fast pre-check before an expensive definitive lookup: a browser checking a URL against a malicious-site Bloom filter can instantly clear the vast majority of safe URLs (definite negatives) without a network call, only falling back to a slower authoritative check for the rare possible-positive. This is close to how Chrome's Safe Browsing feature and RocksDB/Cassandra's per-file existence checks (covered in this track's storage engines lesson) actually use Bloom filters in production.

The tunable tradeoff: more hash functions and a larger bit array reduce the false-positive rate, at the cost of more memory and more computation per operation — a well-tuned Bloom filter for a billion items can still fit in a few gigabytes with a sub-1% false-positive rate, versus the tens of gigabytes an exact hash set of the same items would need.

## HyperLogLog: counting unique items without storing them

Counting exact unique visitors requires remembering every visitor ID seen so far (a set, growing with the number of uniques) — for a billion daily events, that's a genuinely large amount of memory just to answer "how many distinct." **HyperLogLog** estimates cardinality (count of unique items) using a clever observation: hashing each item to a bit pattern, and tracking the longest run of leading zeros seen across all hashed items gives a statistical estimate of how many distinct items were hashed — because seeing a long run of leading zeros becomes exponentially less likely as fewer distinct values have been hashed. Splitting the input across many small "buckets" and averaging their estimates (the actual HyperLogLog algorithm) dramatically reduces the variance of this estimate.

The result: HyperLogLog can estimate the cardinality of a billion-item stream within roughly 1-2% error, using a few kilobytes of memory — regardless of whether the true count is a thousand or a billion. This is the algorithm behind Redis's `PFCOUNT` and most large-scale "unique visitors" / "unique users" analytics dashboards.

## Count-Min Sketch: approximate frequency counting

A related problem: "how many times has this specific item appeared" (e.g., "how many times was this product page viewed") across a massive stream, without storing a counter per distinct item (which, again, could be enormous for a long-tail item space). A **Count-Min Sketch** uses a small 2D array of counters and several hash functions — incrementing one counter per hash function per occurrence, and estimating an item's count as the *minimum* of its hashed counter positions (taking the minimum specifically corrects for the fact that hash collisions can only inflate a counter's value, never deflate it, so the smallest observed value is the closest to the truth).

This trades a small, one-directional error (estimates can only be too high, never too low) for constant memory regardless of how many distinct items exist — useful for tracking "top-k trending items" over huge, high-cardinality streams (trending hashtags, most-viewed products) where storing an exact counter per item isn't practical.

## A worked example

**Scenario:** a real-time analytics dashboard for a large e-commerce site, needing (1) daily unique visitor counts, (2) a "have we seen this session ID before" check for fraud detection, and (3) top-10 trending products by view count.

- **Unique visitors → HyperLogLog.** Exact deduplication across a day's worth of traffic (potentially hundreds of millions of events) would require holding every unique visitor ID in memory; HyperLogLog gets within ~1% accuracy using a few kilobytes, updated incrementally as events stream in, with no need to ever "finish" collecting data before getting an estimate.
- **Seen-session-before check → Bloom filter.** A fast, memory-cheap first-pass check before falling back to an authoritative database lookup only for the rare possible-positive — avoids a database round-trip on the overwhelming majority of genuinely-new sessions.
- **Top trending products → Count-Min Sketch**, paired with a small heap tracking the current top-k candidates — gives an approximate but tight, constant-memory answer to "what's trending right now" without maintaining an exact counter for every product in the catalog, most of which never trend at all.

## Common mistakes

- **Using a probabilistic structure where exact correctness is actually required.** A Bloom filter is wrong for "has this user already redeemed this one-time coupon code" — a false positive there means legitimately denying a valid redemption, which is a real user-facing bug, not an acceptable approximation.
- **Not understanding the error's direction.** Count-Min Sketch only over-counts, never under-counts — treating its output as if errors could go either direction leads to misinterpreting results, especially for low-frequency items where the relative error is largest.
- **Sizing a Bloom filter without accounting for the actual expected item count.** A Bloom filter sized for a million items but fed a billion degrades to a high false-positive rate well before running out of "capacity" in any hard sense — the false-positive rate is a continuous function of load, not a cliff, and needs to be sized against the real expected scale up front.
