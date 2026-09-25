---
title: "B-Trees vs. LSM-Trees: How Databases Actually Store Data on Disk"
short_title: "B-Trees vs LSM-Trees"
tags: ["storage-engines", "databases", "b-trees", "lsm-trees"]
sources:
  - "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017), chapter on storage and retrieval"
  - "RocksDB and PostgreSQL documentation on storage engine internals"
---

## The problem both structures solve

A database needs to store data on disk such that both writes (insert/update/delete) and reads (point lookups, range scans) are fast, even as the dataset grows far larger than memory. Disk access is orders of magnitude slower than memory, and traditionally, random disk writes (spinning disk seeks) were far slower than sequential ones — so storage engine design is largely about arranging data so that the disk access pattern stays sequential wherever possible.

## B-Trees: the traditional relational-database default

A B-Tree organizes data as a balanced tree of fixed-size pages (typically 4KB, matching disk block size), where each page holds sorted keys and pointers to child pages. A lookup walks from the root down to a leaf, comparing keys at each level — with a branching factor in the hundreds, even a huge table (billions of rows) needs only 3-4 levels to reach any row, making point lookups and range scans both fast.

**Writes are the tricky part.** Updating a row means finding its page and modifying it in place. This is straightforward for a single update, but pages can fill up and need to split (creating two half-full pages from one full one), and this splitting can cascade up the tree. Most B-Tree implementations also use a write-ahead log (WAL) to guarantee crash safety — a write is logged sequentially before the actual (potentially random) page write happens, so a crash mid-write can be recovered from the log.

B-Trees remain the default in most traditional relational databases (PostgreSQL, MySQL/InnoDB, SQLite) because their read performance — especially range scans, since data is stored in sorted order on disk — is excellent, and update-in-place semantics map naturally onto how relational data is typically modified.

## LSM-Trees: optimized for write-heavy workloads

A Log-Structured Merge-Tree takes a fundamentally different approach: instead of updating data in place, writes are first appended to an in-memory structure (a memtable, often a sorted structure like a skip list), and periodically flushed to disk as an immutable, sorted file (an SSTable — Sorted String Table). Over time, many SSTables accumulate, and a background process called **compaction** merges them, removing duplicate or overwritten keys and keeping the number of files manageable.

**Why this is fast for writes:** every write is a sequential append (to the memtable, then to disk as part of a flush) — never an in-place random write. This is a much better fit for both spinning disks (where sequential writes are vastly faster than random ones) and, to a lesser but still real extent, SSDs, where write amplification from many small random writes shortens device lifespan and hurts throughput.

**The cost shows up on reads.** A single key might exist in the memtable, or in any of several SSTables (the newest version wins), so a point lookup may need to check multiple locations. **Bloom filters** — a compact probabilistic structure that can quickly say "this key is definitely not in this SSTable" — mitigate this by letting reads skip SSTables that can't contain the key, without eliminating the fundamental multi-location-check cost entirely.

LSM-Trees back most modern write-heavy and NoSQL systems: Cassandra, RocksDB, LevelDB, and HBase all use LSM-Tree storage engines, because their target workloads (high write throughput, often with less demanding read-latency requirements) favor the write side of this tradeoff.

## The core tradeoff, stated plainly

| | B-Tree | LSM-Tree |
|---|---|---|
| Write pattern | In-place, random | Append-only, sequential |
| Write throughput | Lower | Higher |
| Read latency (point lookup) | Consistently low | Variable (mitigated by Bloom filters) |
| Read latency (range scan) | Low, data sorted on disk | Higher, may span multiple SSTables |
| Background overhead | Page splits (usually cheap) | Compaction (can be I/O-intensive) |
| Space amplification | Lower | Higher (old versions linger until compaction) |

Compaction deserves a specific callout: it's necessary to keep read performance and disk usage under control, but it consumes real I/O and CPU in the background, and a poorly-tuned or overwhelmed compaction process is a common source of unpredictable latency spikes in LSM-Tree-based systems — "compaction storms" are a known operational headache in Cassandra and RocksDB deployments.

## A worked example

**Scenario:** choosing a storage engine for two different workloads — (1) a banking ledger requiring fast, consistent point lookups and range queries by account, and (2) a high-volume event-logging system ingesting millions of writes per second with infrequent reads.

- **Banking ledger → B-Tree-based database (e.g., PostgreSQL).** Point lookups and range scans (statement generation over a date range) need consistent, low-variance latency, and write volume is comparatively modest — the read-optimized profile of a B-Tree fits this better than an LSM-Tree's read-amplification tradeoff.
- **Event logging → LSM-Tree-based database (e.g., Cassandra or a RocksDB-backed store).** Write throughput is the dominant requirement, reads are infrequent and often batch/analytical rather than latency-sensitive point lookups, and the append-heavy nature of event data (rarely updated after being written) plays directly to LSM-Trees' strength.

## Common mistakes

- **Choosing an LSM-Tree-based database for a workload that's actually read-heavy with rare writes** — inheriting read-amplification and compaction overhead for no corresponding write-throughput benefit.
- **Ignoring compaction tuning in an LSM-Tree system under high write load**, then being surprised by latency spikes when compaction falls behind and SSTable count grows unchecked.
- **Assuming B-Trees can't handle high write volume at all.** They can, up to a point — the real distinction is that B-Trees' random in-place writes have a lower throughput ceiling than LSM-Trees' sequential appends, not that they can't write quickly at moderate scale.
