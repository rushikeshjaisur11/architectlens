---
title: "Write-Ahead Logging and Crash Recovery"
short_title: "WAL & Crash Recovery"
tags: ["storage-engines", "wal", "durability", "crash-recovery", "databases"]
sources:
  - "PostgreSQL Documentation — Chapter 30: Reliability and the Write-Ahead Log"
  - "RocksDB Wiki — Write Ahead Log (WAL)"
  - "SQLite Documentation — Write-Ahead Logging"
  - "ARIES: A Transaction Recovery Method (Mohan et al., IBM Research, 1992)"
predict:
  question: "A database crashes after a transaction's WAL record was fsynced but before its data page was flushed. What happens on restart?"
  options: ["The commit is lost, since the data page never reached disk", "The log is replayed from the last checkpoint, so the change is reapplied", "The database rolls the transaction back because the page is stale"]
  answer: 1
  why: "A commit is durable once the log record is fsynced; recovery finds the last checkpoint and replays later WAL records (REDO)."
check:
  - q: "Why does the lesson say to bound recovery time with checkpoints rather than keep the full log forever?"
    options: ["Recovery would replay from the beginning, taking longer as the database ages", "Old log records become corrupt and can no longer be checksummed", "The log would stop being sequential once it passes a size limit"]
    answer: 0
    why: "Checkpoints flush dirty pages so recovery only replays records after the latest one."
  - q: "What is the trade-off of tuning checkpoints very infrequent?"
    options: ["Each checkpoint writes more data, making commits slower to acknowledge", "Less checkpoint I/O, but longer recovery and more WAL disk usage", "Fewer fsync calls, but the data files lose their crash protection"]
    answer: 1
    why: "Too infrequent means recovery time and WAL disk usage grow; too frequent means extra I/O."
  - q: "An engineer writes WAL records but skips fsync, relying on the OS page cache. What is the risk?"
    options: ["Group commit stops batching, so throughput drops sharply", "Checkpoints can no longer find a safe point to start recovery", "Writes that look committed can still be lost on power failure"]
    answer: 2
    why: "Without fsync or fdatasync the OS may still hold the write in memory, so durability is not guaranteed."
---

## The core problem: durability vs. random I/O

A database has to guarantee that once it acknowledges a write (a commit), that write survives a crash — power loss, OS panic, process kill — even if the in-memory data structures holding the actual change haven't been flushed to their final on-disk location yet. The naive approach, writing every change directly into its data page on disk, is both slow (random I/O for every update) and unsafe (a crash mid-write can leave a page half-updated, corrupting the structure). **Write-ahead logging (WAL)** solves both problems with one mechanism: before any change is applied to the in-memory or on-disk data structure, a record describing that change is appended to a sequential log file, and that log append is fsynced to disk. Only after the log record is durable is the write considered committed.

## Why this works: sequential writes and a recovery anchor

The log is append-only, so writing to it is a **sequential I/O** operation — cheap even on spinning disks, and still meaningfully cheaper than random writes on SSDs because it avoids scattering writes across the device and lets the OS/drive batch large sequential flushes. This is the mechanical reason WAL is fast: you turn every write, no matter how scattered its final destination, into one append at the tail of a file.

The log also acts as the single source of truth for **crash recovery**. If the process crashes after a WAL record is fsynced but before the corresponding change made it into the actual data pages (which are updated lazily, often in memory first and flushed later), the database can replay the log on startup and reconstruct exactly what should have happened. PostgreSQL calls this **REDO** recovery: on restart, it finds the last checkpoint, replays every WAL record after it, and reapplies changes to bring data pages up to date. This is precisely the mechanism formalized in the ARIES recovery algorithm (Mohan et al.), which separates recovery into three phases — **analysis** (find where to start), **redo** (repeat history to reach the pre-crash state), and **undo** (roll back transactions that were in-flight and never committed).

## Checkpoints bound recovery time

If the log grew forever and recovery always replayed from the beginning, restart after a crash would take longer the older the database got. **Checkpoints** solve this: periodically, the engine flushes all dirty in-memory pages to disk and records a checkpoint marker in the log. Recovery only needs to replay WAL records after the most recent checkpoint, since everything before it is guaranteed to be durably reflected in the data files. PostgreSQL tunes checkpoint frequency via `checkpoint_timeout` and `max_wal_size` — too frequent and you pay extra I/O; too infrequent and recovery time (and WAL disk usage) grows.

## WAL as replication mechanism, not just recovery

Because the WAL is a complete, ordered record of every change, it doubles as the basis for **physical replication**: PostgreSQL streaming replication and MySQL binlog-based replication both ship log records to replicas, which replay them to stay in sync. RocksDB and LevelDB use the same log for crash recovery of their in-memory memtable — if the process dies before a memtable is flushed to an SSTable, the WAL is replayed on reopen to reconstruct it. SQLite's WAL mode (an alternative to its default rollback journal) appends changed pages to a separate WAL file and only periodically "checkpoints" them back into the main database file, which also enables concurrent readers during writes since readers can see a consistent snapshot from before the WAL tail.

## Group commit: amortizing fsync cost

`fsync` is the expensive part of a WAL write — it's a hardware barrier that on some devices costs milliseconds, not microseconds. **Group commit** batches multiple concurrent transactions' log records into a single fsync call: transactions queue their WAL records, one writer thread flushes many of them together, and all callers waiting on that flush return once it completes. This trades a small amount of added latency per transaction for dramatically higher write throughput under concurrency, and is standard in PostgreSQL, MySQL InnoDB, and most production WAL implementations.

## Common mistakes

- **Treating "written to the OS page cache" as durable.** Without an `fsync`/`fdatasync` call, the write can still be lost on power failure even though it looks committed from the application's perspective — the OS may buffer it in memory before flushing to the physical device.
- **Assuming WAL alone prevents all corruption.** WAL protects against crash-induced partial writes to data pages, but doesn't protect against bit rot or disk-level corruption; that requires checksums (which PostgreSQL and RocksDB both apply to WAL records themselves) to detect a torn or corrupted log entry during replay.
- **Letting the WAL grow unbounded by disabling or delaying checkpoints.** This inflates both disk usage and worst-case recovery time, since recovery must replay everything since the last checkpoint.
