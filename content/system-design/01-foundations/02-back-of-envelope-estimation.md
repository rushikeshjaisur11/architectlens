---
title: "Back-of-the-Envelope Estimation for System Design"
short_title: "Estimation"
tags: ["capacity-planning", "foundations", "interview-skills"]
sources:
  - "Jeff Dean, 'Numbers Everyone Should Know' (Google, various talks)"
---

## Why estimate at all

Before you can choose a database, a caching strategy, or a number of servers, you need a rough sense of scale. A system serving 1,000 users a day and one serving 1 billion don't share an architecture — estimation is how you figure out which one you're building *before* you commit to a design.

The goal isn't precision. It's getting within an order of magnitude, fast, so you can rule out approaches that obviously won't work (or are overkill).

## The numbers worth memorizing

A small set of latency and throughput figures cover most estimation problems:

| Operation | Rough latency |
|---|---|
| L1/L2 cache reference | ~1 ns |
| Main memory reference | ~100 ns |
| SSD random read | ~100 μs |
| Round trip within a datacenter | ~500 μs |
| Read 1 MB sequentially from SSD | ~1 ms |
| Round trip across continents (e.g. US to Europe) | ~100-150 ms |
| Disk seek (spinning disk) | ~10 ms |

The exact figures drift with hardware generations, but the *relative* gaps matter more than the absolute numbers: memory is roughly 100x faster than SSD, which is roughly 100x faster than a cross-continent network round trip. That ordering rarely changes even as absolute numbers improve.

## A worked example

**Question:** Design a URL shortener. Estimate storage and request rate for 100 million new URLs per month, with a 100:1 read-to-write ratio.

**Writes per second:**

```
100,000,000 URLs / month
÷ 30 days
÷ 86,400 seconds/day
≈ 38 writes/second (average)
```

Peak traffic is usually estimated at 2-5x average, so plan for roughly 100-200 writes/second at peak.

**Reads per second:**

```
38 writes/sec × 100 (read:write ratio) ≈ 3,800 reads/second (average)
```

**Storage for 5 years:**

```
100,000,000 URLs/month × 12 months × 5 years = 6,000,000,000 URLs

Each record: short code (7 bytes) + long URL (avg ~100 bytes)
+ metadata (created_at, etc., ~50 bytes) ≈ 160 bytes/record

6,000,000,000 × 160 bytes ≈ 960 GB ≈ ~1 TB
```

That single estimate already tells you a lot: 1 TB comfortably fits on a single well-provisioned database server's disk (with room to grow), so you probably don't need to shard on day one purely for storage reasons — though you might still shard for write throughput or availability.

## The estimation process

1. **Clarify the scale.** Get a number from the interviewer or the product spec — daily active users, requests/day, data retention period. If none is given, state an assumption explicitly ("let's assume 10 million DAU") rather than guessing silently.
2. **Convert to a rate.** Daily/monthly numbers need converting to per-second, since that's what determines server capacity. The rule of thumb `86,400 seconds/day ≈ 10^5` makes the arithmetic fast: divide by 10^5 to go from "per day" to "per second," roughly.
3. **Account for peak vs. average.** Real traffic isn't uniform — a 2-5x peak multiplier over the daily average is a reasonable default unless you have a reason to expect a sharper spike (e.g. a flash sale).
4. **Estimate storage separately from throughput.** They often point to different bottlenecks — a system can be throughput-bound with modest total storage, or storage-bound with modest request rates (e.g. video archival).
5. **Sanity check against known reference points.** If your estimate says a single service needs 10 million requests/second, compare that to what you know about real large-scale systems — that's roughly Google Search's estimated global query rate, so a claim like that for a new internal tool should make you re-check your assumptions.

## Common mistakes

- Chasing precision. Estimation is meant to rule out obviously-wrong designs fast, not to produce a number you'd put in a capacity planning spreadsheet.
- Forgetting to convert units consistently (mixing days and seconds, or GB and GiB) — the actual arithmetic errors this produces are often bigger than the estimation error itself.
- Ignoring the read/write ratio. Many systems are read-heavy by 10-1000x, which changes where caching and read replicas matter most.
