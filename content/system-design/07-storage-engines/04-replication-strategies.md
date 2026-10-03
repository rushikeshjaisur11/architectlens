---
title: "Replication Strategies: Leader-Follower, Multi-Leader, and Leaderless"
short_title: "Replication Strategies"
tags: ["replication", "distributed-systems", "storage-engines"]
sources:
  - "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017), chapter on replication"
  - "PostgreSQL documentation on streaming replication"
---

## Why replicate data at all

Replication keeps copies of the same data on multiple nodes, for two related but distinct reasons: **availability** (if one node fails, others still hold the data, so the system keeps serving) and **read scalability** (multiple replicas can each serve read traffic, spreading load that a single node couldn't handle alone). The specific replication strategy chosen determines how writes propagate to replicas, and that choice has direct, unavoidable consequences for consistency, availability, and conflict handling — there's no strategy that avoids trading off among these, only different points on the tradeoff curve.

## Leader-follower (single-leader) replication

One node (the leader) accepts all writes; changes are propagated to one or more follower nodes, which apply them in the same order and serve read traffic. This is the most common replication model for relational databases (PostgreSQL, MySQL) because it avoids the write-conflict problem entirely — since only one node ever accepts writes, there's no possibility of two nodes independently accepting conflicting writes to the same data.

**Synchronous vs. asynchronous replication** is the key tunable choice here: synchronous replication waits for at least one follower to confirm receipt before acknowledging the write as successful, guaranteeing that follower has the data (at the cost of added write latency, and reduced availability if that follower is unreachable); asynchronous replication acknowledges the write immediately without waiting, keeping write latency low but risking data loss if the leader fails before the write actually reaches any follower — the write was accepted, but if the leader is gone before replicating it, that acknowledged write no longer exists anywhere.

**The failure mode this model needs to handle**: if the leader fails, a follower needs to be promoted to the new leader (a specific application of the leader-election problem from this track's consensus lesson), and any writes accepted by the old leader but not yet replicated to the newly-promoted leader are lost — a real risk with asynchronous replication that synchronous replication is specifically designed to reduce.

## Multi-leader replication

Multiple nodes each accept writes independently, replicating changes to each other. This avoids single-leader's dependency on one node for all writes — useful for multi-datacenter deployments, where each datacenter's local leader can accept writes without every write needing a round trip to a single, possibly distant, leader.

**The cost**: since multiple nodes accept writes independently, two leaders can accept conflicting writes to the same piece of data before either has heard about the other's write — a genuine write-write conflict that single-leader replication structurally can't have. Resolving these conflicts requires an explicit strategy (last-write-wins, a merge function specific to the data's semantics, or surfacing the conflict to the application, similar in spirit to Dynamo's approach covered in this track's Dynamo case study), and choosing the wrong strategy for the data's actual semantics can silently produce incorrect merged results.

## Leaderless replication

No node is designated the leader; a client writes to multiple nodes directly (or through a coordinator), and reads similarly query multiple nodes, using a quorum system (write to W nodes, read from R nodes, per this track's Dynamo case study) to ensure reads see sufficiently up-to-date data despite no single node holding a definitively "current" copy. This model prioritizes availability — since no single node's failure blocks writes or reads, as long as enough of the quorum remains reachable — at the cost of more complex conflict detection and resolution logic living in the client or a coordination layer, since there's no leader serializing the order writes are applied in.

## Choosing based on what your workload actually needs

- **Read-heavy workload, infrequent writes, strong consistency preferred**: leader-follower with synchronous or semi-synchronous replication to at least one follower — the model's structural conflict-freedom and straightforward consistency story fit well, and the single-leader write bottleneck matters less when writes are infrequent.
- **Globally distributed writes, availability prioritized over strict consistency**: multi-leader or leaderless — accepting the added conflict-resolution complexity in exchange for not forcing every write through one potentially distant leader, directly improving write latency and availability for a geographically spread user base.
- **Write-heavy, availability-critical, willing to handle eventual consistency**: leaderless with quorum tuning — as covered in the Dynamo case study, this model was specifically chosen for a workload (shopping carts) where accepting a write always, even during a partition, mattered more than strict consistency.

## A worked example

**Scenario:** a multinational company needs a user-preferences database, with users primarily accessing it from whichever region they're physically in, and preference updates that are rare relative to reads.

- **Multi-leader replication across regions** (one leader per major region) lets users read and write against their local region's leader with low latency, rather than every write requiring a round trip to one global leader — directly serving the read-heavy, geographically-distributed access pattern.
- **Conflict resolution strategy chosen deliberately**: since preference updates are rare and typically don't happen concurrently from the same user in two regions simultaneously, a simple last-write-wins (using a synchronized or logical timestamp) is judged acceptable here — a genuine risk assessment specific to this data's actual conflict likelihood and consequence, not a default reached for without considering whether it's actually appropriate for the specific data (which it might not be for, say, concurrently-editable shopping cart contents, per the Dynamo case study's different, deliberate choice for that different workload).

## Common mistakes

- **Choosing multi-leader or leaderless replication without an explicit conflict-resolution strategy matched to the data's actual semantics.** A generic last-write-wins default can silently discard a legitimate concurrent update for data where that's the wrong resolution (per the Dynamo case study's shopping-cart counterexample) — the resolution strategy needs to be a deliberate choice, not a default left unexamined.
- **Using asynchronous leader-follower replication for data where losing an acknowledged-but-unreplicated write on leader failure is unacceptable**, without weighing that specific, real risk against the latency benefit asynchronous replication provides.
- **Assuming leaderless replication's quorum reads always return fully up-to-date data.** Quorum-based reads reduce, but don't always eliminate, the chance of reading stale data, depending on the specific R/W quorum sizes chosen relative to the total replica count — this is a tunable consistency/availability tradeoff, not an automatic guarantee.
