---
title: "Sharding Strategies: Splitting Data Across Machines"
short_title: "Sharding Strategies"
tags: ["nosql", "partitioning", "sharding", "distributed-systems"]
sources:
  - "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017), chapter on partitioning"
  - "DynamoDB and Cassandra documentation on partition key design"
---

## Why shard at all

A single database server has a ceiling — on disk size, on write throughput, on the number of connections it can serve. Sharding (also called partitioning) splits one logical dataset across multiple physical servers so no single machine needs to hold or serve all of it. Each shard holds a subset of the rows; together they form the whole table.

The core design question is: **given a row, which shard does it live on?** Get this wrong and you end up with hot spots (one shard doing all the work while others sit idle) or expensive cross-shard queries (a single logical operation that has to fan out to every shard and merge results).

## Range-based sharding

Rows are assigned to shards by a range of the shard key's value — e.g., users A-M on shard 1, N-Z on shard 2, or timestamps before 2025 on shard 1, after on shard 2.

**Strength:** range queries stay efficient (fetch all events in January — that's one shard, or a small contiguous set). Good for time-series and ordered-access workloads.

**Weakness:** hot spots are common when access patterns correlate with the range. A shard key of "signup date" concentrates all of today's active writes on the newest shard, while older shards sit nearly idle — the opposite of load balancing.

## Hash-based sharding

The shard key is hashed, and the hash determines the shard — e.g., `hash(user_id) % num_shards`.

**Strength:** distributes load evenly regardless of the key's natural distribution, since a good hash function scatters even sequential or clustered input across the full output range.

**Weakness:** range queries become expensive — "all events in January" no longer maps to one shard, since consecutive timestamps hash to essentially random shards. You lose locality in exchange for even distribution.

## Consistent hashing: making resharding cheap

Naive hash sharding (`hash(key) % N`) has a brutal property: changing `N` (adding or removing a shard) reshuffles almost every key's assignment, since the modulus changes for nearly everything. That means adding one server to a 10-server cluster can require re-migrating ~90% of your data.

**Consistent hashing** solves this by mapping both shards and keys onto a fixed ring (a hash space, typically visualized as a circle from 0 to 2^32-1). Each key is assigned to the next shard clockwise from its position on the ring. Adding or removing a shard only affects the keys between it and its neighbor on the ring — roughly `1/N` of the data moves, not the entire dataset. This is why most modern distributed databases (Cassandra, DynamoDB) use some variant of consistent hashing rather than plain modulus hashing.

## The other half: generating unique IDs across shards

Once data is split across machines, a naive auto-incrementing ID (`id SERIAL` in Postgres) breaks — you can't have two shards both independently incrementing from 1 without collisions. Common solutions:

- **UUIDs** — globally unique without coordination, but random UUIDs are bad database index keys (no locality, causes index fragmentation) and carry no useful ordering information.
- **Snowflake-style IDs** (used by Twitter, Discord, and others) — a 64-bit ID composed of a timestamp, a machine/shard ID, and a per-machine sequence counter. Roughly sortable by creation time, globally unique without a central coordinator, and compact compared to a UUID.
- **Reserved ID ranges** — a central service hands out blocks of IDs (e.g., "shard 3, take IDs 500,000-599,999") to each shard, which then increments locally within its block. Simple, but the central allocator is a (usually low-traffic, easily made highly-available) coordination point.

## A worked example

**Scenario:** a social app sharding its `posts` table by `user_id`, using consistent hashing across 8 shards.

- **Why shard by user_id, not post_id:** most queries are "get all posts by user X" — if posts are sharded by user_id, that query hits exactly one shard. Sharding by post_id instead would scatter one user's posts across all 8 shards, turning a single-shard read into an 8-shard fan-out for the app's most common query.
- **The tradeoff this creates:** a global feed (all recent posts across all users) now requires querying all 8 shards and merging by timestamp — expensive, but this is a less frequent, less latency-sensitive path than a user's own profile page, so it's the right place to pay the cost.
- **ID generation:** post IDs use a Snowflake-style scheme embedding the shard ID, so a post's ID alone tells you which shard to query for it directly — no separate lookup table needed to route a request by post ID.

## Common mistakes

- **Choosing a shard key based on write pattern alone, ignoring read pattern.** A key that distributes writes evenly but doesn't match how your most common query filters data will require expensive cross-shard fan-out for that query.
- **Using plain `hash(key) % N` sharding** and discovering that adding a server requires re-migrating nearly all existing data — consistent hashing exists specifically to avoid this.
- **Sharding too early.** Sharding adds real operational and query complexity (cross-shard transactions, cross-shard queries, rebalancing). A single well-provisioned server with read replicas handles more load than most systems expect before sharding becomes necessary.
