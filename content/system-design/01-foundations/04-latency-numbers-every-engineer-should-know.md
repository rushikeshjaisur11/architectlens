---
title: "Latency Numbers Every Engineer Should Know"
short_title: "Latency Numbers"
tags: ["latency", "performance", "foundations", "hardware"]
sources:
  - "Jeff Dean, 'Numbers Everyone Should Know' (Google, various talks/slides)"
  - "Peter Norvig, 'Teach Yourself Programming in Ten Years' (latency table appendix)"
  - "Colin Scott, 'Latency Numbers Every Programmer Should Know' (interactive visualization, colin-scott.github.io)"
---

## Why this matters

System design decisions are ultimately trade-offs between latency, throughput, and cost — and you can't reason about those trade-offs without a rough sense of what things cost in time. The canonical reference here is a table Jeff Dean circulated internally at Google and later in public talks, comparing the relative cost of memory access, disk I/O, and network round trips. The exact numbers have shifted with hardware generations (SSDs replaced spinning disks, NVMe replaced SATA), but the *relative* orders of magnitude are what matter, and they've stayed remarkably stable.

## The core numbers (approximate, modern hardware)

- **L1 cache reference**: ~1 ns
- **L2 cache reference**: ~4 ns (roughly 4x L1)
- **Main memory reference (RAM)**: ~100 ns (roughly 100x L1)
- **SSD random read**: ~16 microseconds — 150x slower than RAM
- **Round trip within the same datacenter**: ~500 microseconds
- **Read 1 MB sequentially from memory**: ~3 microseconds
- **Read 1 MB sequentially from SSD**: ~50 microseconds
- **Disk seek (spinning disk, mostly legacy now)**: ~10 milliseconds
- **Send a packet round trip, same continent (e.g., US East to US West)**: ~40-60 ms
- **Send a packet round trip, cross-continent (e.g., US to Europe/Asia)**: ~150 ms

## The orders of magnitude that matter

The single most useful thing to internalize is the *ratio* between tiers, not the absolute nanosecond figures:

- **Memory vs. disk**: even an SSD is ~100,000x slower than an L1 cache reference, and ~150x slower than RAM. This is why databases keep working sets in memory (buffer pools, caches) whenever possible, and why "just add an index" only helps up to a point — a random-access index scan against cold disk is still expensive.
- **Same-datacenter vs. cross-region network**: a call within a datacenter (~0.5 ms) is roughly 100-300x faster than a cross-region call (~50-150 ms). This is the entire argument for **data locality** and **regional deployment** — a service making synchronous cross-region calls in a hot path will be dominated by network latency no matter how fast its own code is.
- **Sequential vs. random I/O**: reading 1 MB sequentially from disk is dramatically cheaper per-byte than doing the equivalent in random 4 KB reads, because each random read pays a full seek/access penalty. This is why log-structured storage engines (LSM trees, write-ahead logs) favor sequential writes.

## Practical implications for system design

- **Caching wins are multiplicative across tiers.** A cache hit in RAM instead of a round trip to a remote service isn't just "a bit faster" — it can be a 100,000x improvement. This is why CDNs, local caches, and read replicas exist: they move data closer to the tier where access is cheap.
- **Batching amortizes fixed costs.** Since a network round trip costs roughly the same whether you send 1 KB or 100 KB (the fixed latency dominates over the marginal bandwidth cost at these sizes), batching many small requests into one call is almost always a win — this is the rationale behind batch APIs, write-behind buffers, and Nagle-style coalescing.
- **"How many round trips does this operation take?"** is often a more useful design question than "how much data does this operation move?" A chatty protocol with ten sequential round trips at 50 ms each (500 ms total) is worse than one round trip moving ten times the payload.

## Common mistakes

- **Treating disk and memory as interchangeable "storage."** Architecture diagrams that don't distinguish hot-path memory access from cold-path disk access hide the dominant cost in the system.
- **Ignoring cross-region latency until production.** A design that works fine in a single-region test environment can fall apart once traffic crosses continents — always ask where the caller and the data actually live.
- **Memorizing exact numbers instead of ratios.** Hardware changes yearly; the "SSD is ~100x slower than RAM, cross-region network is ~100x slower than same-datacenter" mental model ages much better than any specific millisecond figure.
