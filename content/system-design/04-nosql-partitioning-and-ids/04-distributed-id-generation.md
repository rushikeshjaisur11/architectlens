---
title: "Distributed ID Generation: Snowflake, UUID, KSUID, and ULID"
short_title: "Distributed ID Generation"
tags: ["id-generation", "nosql", "distributed-systems", "snowflake"]
sources:
  - "Twitter Engineering, 'Announcing Snowflake' (2010)"
  - "RFC 4122 (UUID) and the UUIDv7 draft (RFC 9562)"
  - "Segment Engineering, 'A brief history of the UUID' (KSUID design notes)"
---

## Why auto-increment doesn't survive sharding

A single Postgres `SERIAL` column works because one process owns the counter. Once a table is sharded or replicated across nodes with no single writer, that guarantee disappears — two shards handing out ID `501` independently produces a collision the moment you merge data, replicate cross-region, or migrate. Distributed ID generation exists to answer one question: how do independent nodes mint globally unique identifiers **without coordinating on every request**? Every scheme below trades off length, sortability, and coordination cost differently.

## Snowflake: time-ordered, coordination-free integers

Twitter's **Snowflake** (2010) packs a 64-bit integer into fixed fields: a timestamp (milliseconds since a custom epoch), a machine/worker ID, and a per-millisecond sequence number. A typical layout is 41 bits timestamp + 10 bits worker ID + 12 bits sequence, giving each worker up to 4096 IDs per millisecond without talking to any other node. The worker ID is assigned once (via config or a coordination service like ZooKeeper at startup, not per-request), so steady-state generation is entirely local.

The payoff is that Snowflake IDs are **roughly time-sortable** — later IDs are numerically larger — which keeps database indexes append-mostly (good for B-tree write locality) instead of scattering inserts randomly. The cost is a fixed lifespan (41 bits of milliseconds runs out decades after the chosen epoch) and a hard dependency on **clock discipline**: if a node's clock jumps backward (NTP correction, VM pause), it can regenerate an ID it already issued. Real implementations detect this and either stall or refuse to issue IDs during clock skew. Variants of this design power Discord's IDs, Instagram's sharded ID generator, and Sony's Sonyflake.

## UUID: no coordination, no ordering (usually)

**UUIDv4** is 128 bits of randomness (with a few bits fixed to mark the version), defined in RFC 4122. Collision probability is negligible at any realistic scale — the birthday-bound math needs billions of IDs generated per second for centuries before collisions become likely. It requires zero coordination and zero shared state, which is why it's the default choice when you don't want an ID-generation service at all.

The tradeoff is **index locality**: random UUIDs inserted as a primary key scatter writes across the entire B-tree keyspace, causing page splits and poor cache behavior at high write volume — a well-documented problem in MySQL InnoDB and Postgres. **UUIDv7** (standardized in RFC 9562, 2024) fixes this by putting a millisecond timestamp in the high bits and randomness in the low bits, giving you UUID's zero-coordination property with Snowflake-like sortability — increasingly the default recommendation over v4 for primary keys.

## KSUID and ULID: sortable strings without a registry

**KSUID** (K-Sortable Unique Identifier, from Segment) and **ULID** encode a timestamp plus random bits into a fixed-length, lexicographically sortable string — no central authority, no worker-ID registration, just local clock plus randomness, base32-encoded for URL-safety and human readability. ULID uses a 48-bit millisecond timestamp + 80 bits of randomness; KSUID uses a 32-bit second-resolution timestamp + 128 bits of randomness, favoring collision resistance over Snowflake's compactness. Both are popular in systems that want sortable, decentralized IDs but don't want to run a Snowflake-style ID service or manage worker-ID assignment.

## Choosing among them

- **Need compact 64-bit integers, tight sort order, and control your own infra?** Snowflake (or a managed variant).
- **Need zero infrastructure and don't care about insert locality?** UUIDv4.
- **Need zero infrastructure but do care about insert locality and sortability?** UUIDv7 or ULID.
- **Need debuggability (embedded timestamp, no external lookup) in a distributed event log?** KSUID or ULID.

## Common mistakes

- **Using UUIDv4 as a clustered primary key at high write volume**, then wondering why insert throughput degrades as the table grows — the random distribution defeats B-tree locality. Use UUIDv7/ULID or a surrogate sequential key instead.
- **Trusting Snowflake time-ordering across nodes as if it were a global logical clock.** Two Snowflake IDs from different workers with close timestamps do not have a reliable happens-before relationship — clock skew between machines is real, so don't use ID ordering as a substitute for a proper vector clock or consensus-based ordering when correctness depends on it.
- **Forgetting to handle clock rollback in a self-hosted Snowflake generator.** NTP adjustments and VM live-migration can move the clock backward; a naive generator will silently re-issue an ID unless it explicitly checks `now < lastTimestamp` and stalls or errors.
