---
title: "Distributed Search Index Sharding and Replication: Elasticsearch and Solr Architecture"
short_title: "Sharding & Replication"
tags: ["search", "elasticsearch", "solr", "sharding", "distributed-systems"]
sources:
  - "Elasticsearch Reference: Scalability and resilience (elastic.co)"
  - "Apache Solr Reference Guide: SolrCloud"
  - "Elasticsearch Reference: Index modules (shard settings)"
banner:
  layout: fan
  nodes:
    - [lb, "coordinator"]
    - [db, "shard 1"]
    - [db, "shard 2"]
    - [db, "shard 3"]
predict:
  question: "An index has 3 primary shards, each with 1 replica. You raise it to 4 replicas per shard. What happens to throughput?"
  options: ["Read throughput rises, but write throughput does not improve and may dip", "Both rise, because every replica accepts writes independently", "Neither changes, because replicas matter only for failover"]
  answer: 0
  why: "Searches can be served by any replica, so reads scale with replica count. Writes still go to the primary first and are forwarded, so more copies add consistency work."
check:
  - q: "Why can't the primary shard count be changed after index creation without reindexing?"
    options: ["Lucene segments cannot be split once they have been flushed to disk", "Routing hashes the document ID against the count, so a change remaps documents", "The cluster coordination layer locks the shard count after the first write"]
    answer: 1
    why: "A document's shard comes from hash(_id) modulo the number of primaries. Changing the count changes the mapping for every document."
  - q: "A team's index is running out of capacity. Why won't adding replicas fix it?"
    options: ["Replicas copy data rather than split it, so only more primaries add capacity", "Replicas are read-only and are deleted whenever a primary shard fills up", "Replicas can be added only to the oldest shards, so capacity stays flat"]
    answer: 0
    why: "Replicas are full copies that add read throughput and resilience. Holding more data needs more primary shards, which is fixed at creation."
  - q: "Why does Elasticsearch allow near-real-time reads instead of making every read see the latest write?"
    options: ["Linearizable reads are impossible on any system that uses Lucene indexes", "Replicas never receive writes, so staleness is unavoidable for them", "Search tolerates slight staleness better than writes blocked on full sync"]
    answer: 2
    why: "It is a deliberate trade-off: reads can lag a replica or the roughly 1-second refresh. That is preferred to slow writes waiting for every copy."
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
