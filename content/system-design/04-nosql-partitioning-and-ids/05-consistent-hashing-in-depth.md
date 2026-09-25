---
title: "Consistent Hashing in Depth"
short_title: "Consistent Hashing in Depth"
tags: ["consistent-hashing", "nosql", "distributed-systems", "sharding"]
sources:
  - "Karger et al., 'Consistent Hashing and Random Trees' (1997)"
  - "DeCandia et al., 'Dynamo: Amazon's Highly Available Key-value Store' (SOSP 2007)"
  - "Cassandra documentation on virtual nodes (vnodes)"
---

## The problem plain hashing creates

The earlier lesson on sharding strategies covered `hash(key) % N` as a partitioning scheme. Its failure mode is catastrophic on resize: changing `N` from, say, 8 to 9 nodes changes the destination shard for nearly every key, because the modulus changes the result for almost all inputs. In a cache, that's a near-total cache miss storm; in a database, it's a near-total data reshuffle. **Consistent hashing**, introduced by Karger et al. (1997) for web caching and later popularized by Amazon's Dynamo paper (2007), was designed specifically so that adding or removing one node remaps only a small fraction of keys.

## The ring construction

Consistent hashing maps both **nodes** and **keys** onto the same fixed circular hash space (commonly 0 to 2^32-1, walked clockwise). Each node is hashed to one or more positions on this ring. A key is assigned to the **first node found walking clockwise from the key's own hash position** — i.e., its successor on the ring. To look up or store a key, you hash it and walk forward until you hit a node.

When a node is added, it only takes ownership of the ring segment between itself and its counter-clockwise neighbor — it steals keys from exactly one existing node, not all of them. When a node is removed, its segment falls to its clockwise successor. This is the core property: **node count changes remap roughly `K/N` keys** (K = total keys, N = nodes), not nearly all of them, unlike modulo hashing.

## Virtual nodes: fixing the uneven-load problem

Plain consistent hashing with one ring position per physical node has a real weakness: with few nodes, random hash placement produces uneven arc lengths, so some nodes own disproportionately large key ranges — hot spots by pure geometry, independent of access patterns. Dynamo's fix, now standard practice (Cassandra calls it **vnodes**, default 256 per node historically, tunable), is to hash each physical node to many points on the ring (dozens to hundreds), effectively partitioning the ring into many small arcs distributed across all nodes. This smooths load distribution and, critically, makes rebalancing on node add/remove more even — the departing node's load spreads across many surviving nodes rather than dumping entirely onto one successor.

## Replication on the ring

Dynamo-style systems replicate a key to the **N successive distinct physical nodes** clockwise from its position (a "preference list"), so replication and partitioning share the same ring mechanism — no separate replica-placement logic needed. This is also why vnodes matter for replication safety: without care, two virtual nodes belonging to the same physical machine could land adjacent on the ring, causing a key's replicas to collapse onto fewer physical machines than intended. Real implementations explicitly skip repeated physical nodes when building the preference list.

## Where it shows up in practice

Consistent hashing (or ring-like variants) underlies Dynamo, Cassandra, Riak, and client-side sharding in memcached deployments (Ketama hashing). It's the mechanism of choice whenever a system expects the node count to change over its lifetime — elastic scaling, rolling upgrades, node failure and replacement — and wants those events to be cheap.

## Common mistakes

- **Using one hash position per node and being surprised by load skew.** With, say, 5 nodes and single-position placement, arc lengths can vary by 2-3x purely from hash randomness. Virtual nodes are not optional polish — without them, consistent hashing's "evenly distributed" claim doesn't hold at small N.
- **Conflating consistent hashing with a routing lookup table.** Some real systems (e.g., DynamoDB, distinct from Dynamo the paper) actually use static partition maps with explicit rebalancing rather than ring hashing; assuming every "sharded NoSQL store" walks a hash ring is a category error worth checking per-system.
- **Ignoring replica placement when adding vnodes.** If virtual nodes for the same physical machine aren't spread apart or deduplicated in the preference list, you can silently under-replicate data across physical failure domains while the ring math looks fine.
