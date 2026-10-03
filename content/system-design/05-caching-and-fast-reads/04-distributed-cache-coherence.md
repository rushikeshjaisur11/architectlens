---
title: "Distributed Cache Coherence: Redis Cluster, Memcached, and Consistent Hashing"
short_title: "Distributed Cache Coherence"
tags: ["caching", "redis-cluster", "memcached", "consistent-hashing", "distributed-systems"]
sources:
  - "Redis Cluster Specification (redis.io/docs/reference/cluster-spec)"
  - "Memcached wiki: ConfiguringClient / consistent hashing documentation"
  - "Karger et al., Consistent Hashing and Random Trees (STOC 1997)"
  - "Redis and Valkey licensing and adoption summaries, 2025 to 2026 (secondary)"
banner:
  layout: line
  nodes:
    - [server, "node A"]
    - [cache, "local cache"]
    - [queue, "invalidations"]
    - [server, "node B"]
predict:
  question: "A cache cluster routes keys with consistent hashing and a new node is added. Roughly what share of keys move to it?"
  options:
    - "Nearly all keys, as with hash(key) % N routing"
    - "None, because virtual nodes keep every key where it was"
    - "Only a small slice, roughly 1/N of keys, near the new node"
  answer: 2
  why: "A key moves only if it falls between the new node and its neighbor on the ring, roughly 1/N of keys, unlike modulo routing which remaps nearly everything."
check:
  - q: "What can happen to writes during a Redis Cluster failover under a write burst?"
    options:
      - "No writes are lost, since replicas apply every acknowledged write before it returns"
      - "Nothing is lost because Redis Cluster uses a majority quorum on each write"
      - "Recently acknowledged writes can be lost, because replication to replicas is asynchronous"
    answer: 2
    why: "Writes go to the master and replicate asynchronously, so a failover can drop the last few acknowledged writes."
  - q: "Why can a single viral key still overload one node even with consistent hashing or hash slots?"
    options:
      - "Both schemes spread keys evenly, not traffic, so one viral key still overloads its owner"
      - "Consistent hashing with virtual nodes spreads a viral key's traffic across every node"
      - "Redis hash slots automatically replicate a viral key to all nodes to share its reads"
    answer: 0
    why: "Sharding balances keys, not traffic, so hot keys need a separate mitigation such as local caching or key splitting."
  - q: "Why is Memcached's lack of built-in replication an acceptable design?"
    options:
      - "Clients write each key to several servers by default, so losing one node costs no keys"
      - "A failed node's keys are simply refetched from the source of truth, so it is never treated as durable"
      - "Memcached uses fixed hash slots, which keep a second copy of each slot on another node"
    answer: 1
    why: "Memcached is a pure best-effort cache, so losing a node only means refetching, which keeps the model simple and fast."
---

## Why a single cache node isn't enough

A cache sized to one machine's RAM caps out fast, and a single node is a single point of failure for every request that depends on it. Scaling a cache horizontally means splitting keys across multiple nodes (**sharding**) and deciding, for any given key, which node owns it — consistently enough that a write and a later read agree on the answer even as nodes are added or removed.

## Consistent hashing

The naive approach — `hash(key) % N` nodes — breaks badly when N changes: adding or removing one node remaps nearly every key, causing a cache-wide stampede to the database. **Consistent hashing**, introduced by Karger et al. for web caching, solves this by mapping both nodes and keys onto a fixed hash ring (typically via a hash function like MD5 or a variant). A key belongs to the first node found walking clockwise from its position on the ring. Adding or removing a node only remaps the keys between it and its neighbor — roughly `1/N` of all keys, not all of them.

In practice, a naive ring still causes uneven load, since a small number of nodes can end up owning disproportionate arcs. The fix is **virtual nodes**: each physical node is hashed onto the ring many times (e.g., 100-160 replicas), smoothing the distribution. Memcached clients (e.g., libmemcached, the Ketama hashing scheme) implement this client-side — the cache servers themselves know nothing about each other; the client library computes which server owns a key and talks to it directly.

## Redis Cluster's approach: hash slots, not a ring

Redis Cluster doesn't use consistent hashing directly. Instead it partitions the keyspace into **16,384 fixed hash slots** — each key is mapped to a slot via `CRC16(key) mod 16384`, and each slot is assigned to exactly one master node. Clients can query any node for the current slot-to-node mapping (`CLUSTER SHARDS` / `MOVED` redirects) and cache it locally. Resharding means moving whole slots between nodes, which is a much coarser and more controllable operation than recomputing a ring — the fixed slot count also bounds the size of the cluster's metadata regardless of how many keys exist. Redis Cluster supports `{hashtag}` syntax to force related keys into the same slot, which is necessary because multi-key operations only work when all keys live on the same node.

## Coherence and replication

"Coherence" in a distributed cache means readers see a consistent view despite data living on multiple nodes and possibly multiple replicas per node. Redis Cluster assigns each master one or more replicas; writes go to the master and are replicated asynchronously, so a failover can lose the last few writes (Redis trades strict consistency for availability and speed, matching an AP-leaning stance under network partitions — see Redis Cluster's own documented consistency guarantees). Memcached, by contrast, has **no built-in replication or coherence protocol at all** — it's a pure best-effort cache. If a node fails, every key it owned is simply gone and refetched from the source of truth; the "coherence" model is deliberately "don't treat this as durable," which is precisely what makes it simple and fast to reason about.

## Current practice (verified October 2026)

Operationally, Redis-compatible engines now come in two lineages (Redis and Valkey) with the same wire protocol but diverging features and licences. Pin the engine and version in your platform standard, test client-library compatibility for cluster, pub/sub and module use, and treat invalidation and TTL design as engine-independent.

## Common mistakes

- **Assuming Redis Cluster is strongly consistent.** Async replication to replicas means a failover during a write burst can drop recently acknowledged writes — treat Redis Cluster as an accelerator over the source of truth, not the source of truth itself.
- **Client-side hashing that isn't actually consistent.** Using `hash(key) % N` in application code while calling it "sharding" reintroduces the full-remap problem on every scaling event — verify the client library is actually doing ring-based or slot-based routing.
- **Ignoring hot keys.** Both consistent hashing and Redis's slot model distribute *keys* evenly, not *traffic* — a single viral key can still overload the one node/slot that owns it, requiring a separate mitigation (local caching, key splitting) regardless of the sharding scheme.
