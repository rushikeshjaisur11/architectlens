---
title: "Distributed Search Index Sharding and Replication: Elasticsearch and Solr Architecture"
short_title: "Sharding & Replication"
tags: ["search", "elasticsearch", "solr", "sharding", "distributed-systems"]
sources:
  - "Elasticsearch Reference: Scalability and resilience (elastic.co)"
  - "Apache Solr Reference Guide: SolrCloud"
  - "Elasticsearch Reference: Index modules (shard settings)"
---

## Why a single inverted index doesn't scale

An inverted index for a large corpus — hundreds of millions of documents — grows too large to fit on one machine's disk and memory, and a single node can't serve enough concurrent query throughput. Both **Elasticsearch** and **Solr** solve this the same way: split the logical index into **shards**, each a self-contained Lucene index, distributed across nodes in a cluster. A shard is the actual unit of storage and search; an "index" in Elasticsearch or a "collection" in Solr (SolrCloud) is a named grouping of shards that clients query as if it were one thing.

## Sharding: splitting the index

When you create an index, you fix the **number of primary shards** up front (Elasticsearch pre-7.0 defaulted to 5; modern defaults are usually 1, with auto-sizing guidance based on data volume). Each document is routed to exactly one primary shard, typically by hashing the document ID (`hash(_id) % num_primary_shards` in Elasticsearch). This routing determinism is why **primary shard count can't be changed after creation** without reindexing — changing the shard count changes the hash-to-shard mapping for every document. Solr's SolrCloud uses the same idea, calling the hash-based partitioning "composite ID routing," with each shard owning a hash range.

A query against the index fans out to every shard (**scatter-gather**): the coordinating node sends the query to one copy of each shard, each shard returns its top-N matches with scores, and the coordinator merges and re-sorts before returning results. This means query latency is bounded by the *slowest* shard, and having too many shards per node adds per-shard overhead (file handles, memory, merge threads) without improving throughput — the well-known guidance from Elastic is to keep shard size in the tens of GB range (historically ~10-50GB) rather than creating many tiny shards "for safety."

## Replication: availability and read throughput

Each primary shard can have zero or more **replica shards** — full copies kept in sync, hosted on different nodes. Replicas serve two purposes: **failover** (if a node holding a primary dies, a replica is promoted to primary) and **read scaling** (search requests can be served by any replica, not just the primary, so replica count directly increases query throughput). Writes, however, always go to the primary first, which then forwards the operation to its replicas — this is why adding replicas doesn't help write throughput and can even slightly hurt it (more copies to keep consistent).

Elasticsearch and SolrCloud both rely on a cluster coordination layer to track shard state: Elasticsearch historically used **Zen Discovery** and now (7.x+) an internal Raft-like consensus protocol among master-eligible nodes; SolrCloud explicitly uses **Apache ZooKeeper** as an external coordination service holding cluster state, collection configs, and leader election per shard. In both systems, shard allocation across nodes is rebalanced automatically as nodes join, leave, or fail, based on disk usage and shard count heuristics.

## Consistency and write behavior

Within a shard, Elasticsearch uses a primary-replica model where the primary sequences all writes and replicates them synchronously enough to guarantee a write is acknowledged only after being applied on enough copies (configurable via `wait_for_active_shards`), but reads by default are **not linearizable** across replicas — a replica can briefly lag behind the primary, which is why searches are near-real-time (refreshed roughly every 1 second by default) rather than reflecting every write instantly. This is a deliberate trade-off: search workloads tolerate slightly stale results far better than they tolerate slow writes blocked on full replica sync.

## Common mistakes

- **Over-sharding a small index.** Creating dozens of shards for a dataset that fits comfortably in one or two means every query pays scatter-gather overhead across mostly-empty shards, and cluster state (which tracks every shard) bloats unnecessarily.
- **Treating replicas as a substitute for shards.** Replicas don't split data — they copy it. Replicas increase read throughput and resilience; only more primary shards (set at index-creation time) increase how much data the index can hold and how parallelized a single query's shard-level work is.
- **Assuming search is always read-your-writes consistent.** Code that writes a document and immediately searches for it can miss it if the read hits a replica that hasn't caught up, or before the next refresh cycle — use a targeted GET by ID, or explicit refresh, when strict consistency matters.
- **Forgetting that primary shard count is fixed at creation.** Under-provisioning shards for expected future growth forces a reindex-and-swap (e.g., Elasticsearch's `_reindex` into a new index with more shards) later, which is expensive at scale.
