---
title: "Designing a Distributed Key-Value Store"
short_title: "Distributed Key-Value Store Design"
tags: ["service-design", "key-value-store", "case-study"]
sources:
  - "DeCandia et al., 'Dynamo: Amazon's Highly Available Key-value Store' (SOSP 2007)"
  - "Cassandra documentation on architecture and consistency tuning"
---

## Why this is a strong synthesis exercise

A distributed key-value store combines nearly every concept covered elsewhere in this track — partitioning, replication, consistency tradeoffs, and failure handling — into one design problem with a genuinely simple external interface (`get(key)` / `put(key, value)`). Working through it end to end shows how those individually-covered concepts actually compose into one coherent system, the way this track's URL shortener lesson did for a narrower, more product-specific case.

## Step 1: Clarify requirements

- Functional: `put(key, value)`, `get(key)`, and typically `delete(key)`.
- Non-functional: the design needs to make an explicit choice on the CAP theorem tradeoff (per this track's CAP theorem lesson) — this single decision shapes nearly everything downstream, so it needs to be pinned down early rather than left implicit. For this walkthrough, assume the requirement is high availability with tunable consistency (an AP-leaning design, similar to Dynamo's reasoning covered in this track's Dynamo case study), appropriate for a workload where a write should essentially never be rejected.

## Step 2: Partitioning

With potentially billions of keys, no single node can hold all the data — the store needs partitioning (per this track's sharding lesson). Consistent hashing is the natural choice here specifically because key-value stores need to support adding and removing nodes without triggering the massive data reshuffling that naive `hash(key) % N` partitioning would cause, as covered in the sharding lesson.

## Step 3: Replication for availability

Each key is replicated to N nodes (a configurable replication factor, commonly 3) for both durability and availability — losing any single node shouldn't lose data or make that data's keys unavailable. Per this track's replication strategies lesson, a leaderless model fits the AP-leaning requirement from Step 1 well: any of the N replicas can accept a write, rather than requiring all writes to route through a single leader that would become both a bottleneck and a single point of failure for that key's writes.

## Step 4: Quorum-based consistency, tunable per operation

Rather than a fixed, one-size-fits-all consistency guarantee, a quorum system (per the Dynamo case study) lets the read quorum (R) and write quorum (W) be tuned relative to the replication factor (N):

- **W + R > N** guarantees that any read quorum and any write quorum overlap in at least one node, meaning a read is guaranteed to see the most recent successful write — this is the condition for **strong consistency** within this model, even though the system as a whole remains leaderless and partition-tolerant.
- **W + R ≤ N** allows reads and writes to not necessarily overlap, meaning a read might not see the most recent write — weaker consistency, but with correspondingly lower latency (fewer nodes need to respond) and higher availability under partial node failure (fewer nodes need to be reachable for an operation to succeed).

This tunability is a genuine design strength of this model over a fixed strong-or-eventual choice — different applications built on the same key-value store can choose different points on this tradeoff for different data, without needing a fundamentally different storage system.

## Step 5: Conflict resolution for concurrent writes

Since multiple replicas can independently accept writes (per Step 3's leaderless model), concurrent writes to the same key from different clients can produce genuinely conflicting versions. As covered in the Dynamo case study, vector clocks let the system distinguish a genuine conflict (concurrent, unrelated writes) from a simple newer-version case (one write causally follows another) — and genuine conflicts are surfaced to the application layer for resolution, since only the application understands the correct semantics for merging two conflicting versions of its specific data.

## Step 6: Storage engine choice within each node

Each individual node still needs to actually persist its portion of the data efficiently. Given the write-heavy nature typical of this kind of system (many concurrent clients writing to many different keys) and the point-lookup-dominant access pattern (`get(key)` rarely needs a range scan across keys), an LSM-Tree-based storage engine (per this track's storage engines lesson) is usually the better fit than a B-Tree — favoring the sequential-write throughput LSM-Trees provide over the more balanced-but-lower-ceiling write performance of a B-Tree, since this design's dominant cost is expected to be write volume, not range-query performance.

## Step 7: Handling partition tolerance operationally

When a node is temporarily unreachable (a network partition, per the Dynamo case study), the system uses hinted handoff — writes intended for the unreachable node are temporarily held by a different, reachable node and handed off once the original node recovers — rather than blocking the write or rejecting it outright, directly serving the "always writable" requirement established in Step 1.

## A worked example, tying the steps together

**Scenario:** using this design as a session store for a web application, where a user's session data needs to be written on every request and read frequently, tolerating brief staleness but never rejecting a write.

- **N = 3, W = 1, R = 1** is chosen — since W + R (2) ≤ N (3), this favors low latency and maximum availability over strict consistency, which fits a session store well: a slightly stale read of session data (that resolves within milliseconds as replication catches up) is an acceptable tradeoff for a session store, where the cost of ever rejecting a write (failing to record a login, for instance) would be a much worse user-facing failure than brief staleness.
- **Conflict resolution**: session updates are designed to be structured so that a simple merge strategy (e.g., taking the most recently timestamped field-level update, or a union for additive fields like a shopping cart's item list, per the Dynamo case study's cart example) resolves genuine conflicts sensibly — a deliberate application-level decision, not left to a generic default.

## Common mistakes

- **Designing partitioning, replication, and consistency in isolation from each other**, rather than recognizing that the consistency requirement decided early (Step 1) should directly drive the replication model and quorum configuration chosen later — these aren't independent decisions, they're a connected chain where an early choice constrains what makes sense downstream.
- **Choosing a fixed, system-wide consistency level without considering that different data (or even different operations on the same key-value store) might have genuinely different consistency needs** — the tunable W/R quorum model exists specifically to avoid forcing one blanket tradeoff onto every use case built on the same underlying store.
- **Treating storage engine choice as an afterthought disconnected from the rest of the design.** As shown in Step 6, the storage engine choice should follow from the actual access pattern (write-heavy, point-lookup-dominant) established by the overall system's requirements, not be picked independently of them.
