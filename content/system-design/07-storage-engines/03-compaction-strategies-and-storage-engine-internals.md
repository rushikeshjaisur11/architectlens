---
title: "Compaction Strategies and Storage Engine Internals: Leveled vs. Size-Tiered"
short_title: "Compaction Strategies"
tags: ["storage-engines", "lsm-trees", "compaction", "rocksdb", "cassandra", "databases"]
sources:
  - "RocksDB Wiki — Leveled Compaction and Compaction Style guides (rocksdb.org)"
  - "Apache Cassandra Documentation — Compaction strategies (DataStax/Cassandra docs)"
  - "The Log-Structured Merge-Tree (LSM-Tree), O'Neil et al., 1996"
  - "ScyllaDB Engineering Blog — Compaction strategy comparisons"
---

## Why LSM-trees need compaction at all

An LSM-tree never updates data in place. Writes land in an in-memory **memtable**, which flushes to an immutable on-disk **SSTable** once full. Over time this produces many SSTables, each potentially containing overlapping key ranges and stale/overwritten versions of the same key (including tombstones for deletes). Reads must check multiple SSTables to find the latest version of a key, and disk usage grows with every write even if the same logical key is updated repeatedly. **Compaction** is the background process that merges SSTables together, discarding obsolete versions and tombstones, and reorganizing data to keep both read amplification (how many files a read must check) and space amplification (how much stale data lingers) under control. The trade-off compaction always makes is against **write amplification** — how many extra bytes get rewritten to reclaim that space and merge that data.

## Size-tiered compaction

**Size-tiered compaction (STCS)**, used by default in Cassandra and available as an option in RocksDB, groups SSTables of similar size into tiers. When enough similarly-sized tables accumulate in a tier (a configurable threshold, e.g. 4), they're merged into one larger table that moves to the next tier up. This keeps write amplification low — data is rewritten roughly once per tier transition — but at the cost of higher space and read amplification: multiple tables at multiple tiers can contain the same key, and total disk usage can spike to roughly 2x the live dataset size during a large compaction, since old and new versions coexist until the merge completes. STCS is a good fit for **write-heavy workloads** where disk space is not the binding constraint and read latency is less sensitive to the number of files touched per query.

## Leveled compaction

**Leveled compaction (LCS)**, the default in RocksDB and LevelDB (and available in Cassandra), organizes SSTables into levels (L0, L1, L2, ...) where each level beyond L0 holds non-overlapping key ranges and is roughly 10x the size of the level above it. L0 is special — files here come straight from memtable flushes and can overlap in key range. Compaction picks a file from Ln and merges it with the overlapping files in Ln+1, producing new non-overlapping files. Because each level (other than L0) has non-overlapping ranges, a point read only needs to check at most one file per level — bounding read amplification far more tightly than STCS. Space amplification is also much lower, typically around 1.1x the live dataset, since stale versions are pruned aggressively at each merge step. The cost is **higher write amplification**: a single key can be rewritten once per level as it cascades from L0 down to the largest level, which in RocksDB's default configuration can mean 10-30x write amplification for deep level hierarchies.

## Choosing between them

The decision is a three-way trade-off — **write amplification, read amplification, space amplification** — and you can only ever improve two at the expense of the third (this is a well-known result discussed extensively in RocksDB's own tuning documentation). STCS favors write-heavy, space-tolerant workloads; LCS favors read-heavy or space-constrained workloads willing to pay extra write I/O. RocksDB also offers **FIFO compaction** (drop oldest data when size limits are hit, no merging at all — good for pure time-series/cache use cases with TTL) and **universal/tiered compaction** as a middle ground closer to STCS but with tighter space bounds. Cassandra's **Time-Window Compaction Strategy (TWCS)** is a specialized variant of STCS for time-series data, grouping SSTables by time window so entire expired windows can be dropped without a merge at all.

## Common mistakes

- **Assuming compaction strategy is a one-time choice with no operational cost.** Compaction competes with foreground reads/writes for disk I/O and CPU; under-provisioned compaction throughput causes SSTables to pile up (RocksDB's "write stalls") and read latency to degrade as read amplification climbs.
- **Ignoring space amplification during migrations or bulk loads.** A size-tiered strategy under heavy write load can transiently double disk usage; provisioning storage at exactly the live-data size will run out of disk mid-compaction.
- **Using STCS for read-heavy point-lookup workloads.** The number of SSTables a read must probe grows with data volume under STCS in a way it doesn't under leveled compaction, so latency-sensitive OLTP-style workloads generally want LCS despite its higher write cost.
