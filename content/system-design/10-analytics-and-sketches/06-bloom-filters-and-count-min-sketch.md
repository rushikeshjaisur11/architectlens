---
title: "Bloom Filters and Count-Min Sketch in Depth"
short_title: "Bloom Filters & Count-Min Sketch"
tags: ["bloom-filter", "count-min-sketch", "probabilistic-data-structures", "streaming"]
sources:
  - "Burton H. Bloom, 'Space/Time Trade-offs in Hash Coding with Allowable Errors' (1970)"
  - "Graham Cormode & S. Muthukrishnan, 'An Improved Data Stream Summary: The Count-Min Sketch and its Applications' (2005)"
  - "ClickHouse documentation — Bloom filter indexes and skip indexes"
  - "Redis documentation — Bloom and Cuckoo filter modules (RedisBloom)"
predict:
  question: "A standard Bloom filter holds items X and Y, which share one bit position. You clear X's bits to delete X. What happens to Y?"
  options: ["Y may now be reported absent, a false negative", "Y stays correct, since only X's other bits changed", "Y is reported present with a higher false-positive chance"]
  answer: 0
  why: "Clearing a shared bit can un-set one Y depends on, reintroducing false negatives. That is why standard Bloom filters do not support deletion."
check:
  - q: "What does a Counting Bloom Filter trade for supporting deletion?"
    options: ["It uses small counters instead of single bits, costing more memory", "It permits false negatives so that deleted items can be forgotten", "It drops the hash functions, so lookups become exact but slower"]
    answer: 0
    why: "Replacing each bit with a small counter, typically 4 bits, lets entries be decremented. The cost is extra memory."
  - q: "Why is Count-Min Sketch trustworthy for heavy hitters but not for long-tail counts?"
    options: ["Heavy hitters get their own exact counter row, so they are never shared", "The sketch discards the rarest items entirely once it fills up", "Overestimation bias is proportionally largest for rare items"]
    answer: 2
    why: "Collisions add a similar absolute error to every item. That error is small relative to a large count and large relative to a rare one."
  - q: "Why is a Bloom filter safe as a per-SSTable gate before a disk read?"
    options: ["It stores the actual keys, so a match can be returned directly", "A negative is trustworthy, so it skips the seek; a positive just triggers normal lookup", "It guarantees no false positives, so every positive answer is a real hit"]
    answer: 1
    why: "Because false negatives cannot happen, \"absent\" safely avoids work. A false positive costs only the lookup that would have happened anyway."
---

## The problem both structures solve

Exact membership tests and exact frequency counts require storing every distinct item — a hash set or a hash map. At billions of keys, that's untenable in memory. **Bloom filters** and **Count-Min Sketch (CMS)** trade a small, tunable false-positive rate for a fixed, sublinear memory footprint that doesn't grow with cardinality the way an exact structure does. Both are staples in analytics engines, key-value stores, and stream processors wherever "have I seen this before" or "how often has this occurred" needs to run at scale without loading the full key set.

## Bloom filter mechanics

A Bloom filter is a bit array of size `m`, initialized to all zeros, plus `k` independent hash functions. **Insert**: hash the item `k` times, set those `k` bit positions to 1. **Query**: hash the item the same `k` times; if *all* `k` bits are 1, report "possibly present"; if *any* bit is 0, report "definitely absent."

This asymmetry is the defining property, from Bloom's original 1970 paper: **false positives are possible, false negatives are not.** A Bloom filter never says "absent" for something it actually inserted. That makes it safe to use as a fast pre-check gate — e.g., "does this SSTable possibly contain this key?" before paying for a disk seek — because a negative answer is trustworthy and skips real work, while a positive answer just triggers the normal lookup that would've happened anyway.

The false-positive rate depends on three tunable quantities: bit array size `m`, number of hash functions `k`, and number of inserted items `n`. The optimal `k` for a given `m/n` ratio is `k = (m/n) * ln(2)`, and with that optimal `k`, the false-positive probability is approximately `(1 - e^(-kn/m))^k`. In practice this means roughly 10 bits per element gets you under 1% false-positive rate — an order of magnitude less memory than a hash set storing full keys or even key hashes.

**Deletion is not supported** in a standard Bloom filter — clearing a bit could un-set a bit another item also depends on, reintroducing false negatives. The **Counting Bloom Filter** variant replaces each bit with a small counter (typically 4 bits) to support deletion at the cost of more memory.

## Count-Min Sketch mechanics

CMS, from Cormode and Muthukrishnan's 2005 paper, generalizes the same idea to **frequency estimation** rather than membership. It's a 2D array of counters with `d` rows and `w` columns, each row paired with an independent hash function. **Update**: for each row `i`, hash the item into a column and increment that counter. **Query**: hash the item into each row's column and return the **minimum** of the `d` counters read.

Taking the minimum is the key trick — hash collisions in any single row can only inflate a counter, never deflate it, so the row with the least collision damage gives the tightest overestimate. CMS **only overestimates counts, never underestimates**, mirroring the Bloom filter's one-directional error guarantee. Width `w` and depth `d` are chosen from target error bounds: with `w = ceil(e / epsilon)` and `d = ceil(ln(1/delta))`, the estimate is within `epsilon * N` of the true count with probability `1 - delta`, where `N` is the total count of all updates.

CMS is the workhorse behind **heavy-hitter detection** (top-K queries over a stream, as in Redis's `TOPK` module or ad-tech click-frequency capping) and is commonly paired with a min-heap to track the current top-K candidates without storing every distinct key.

## Where these show up in real systems

- **ClickHouse** ships Bloom filter **skip indexes** (`bloom_filter` index type) so queries with equality or `IN` predicates can skip whole granules that provably don't contain a match.
- **Cassandra and RocksDB (LSM-tree stores)** attach a Bloom filter per SSTable to avoid disk reads for keys that don't exist in that file.
- **RedisBloom** exposes both `BF.*` (Bloom) and `CMS.*` (Count-Min Sketch) commands directly as data types.
- Distributed systems use CMS for **rate limiting and DDoS mitigation**, estimating per-source request counts without keeping per-source state.

## Common mistakes

- **Using a Bloom filter for frequency or counting.** It only answers membership; reach for Count-Min Sketch (or HyperLogLog for cardinality) instead.
- **Undersizing `m` for the actual `n`.** As the filter fills past its designed load factor, the false-positive rate degrades nonlinearly — monitor fill ratio, not just raw hit rate.
- **Treating CMS estimates as exact for low-frequency items.** The overestimation bias is proportionally worst for rare items; CMS is reliable for heavy hitters, not for precise long-tail counts.
- **Forgetting both structures are one-directional.** A Bloom filter's "maybe present" and CMS's "at most this count" are the only guarantees — never invert the interpretation.
