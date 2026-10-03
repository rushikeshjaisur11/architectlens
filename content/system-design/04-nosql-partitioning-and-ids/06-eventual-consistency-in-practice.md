---
title: "Eventual Consistency in Practice: Read Repair, Anti-Entropy, and CRDTs"
short_title: "Eventual Consistency in Practice"
tags: ["eventual-consistency", "nosql", "distributed-systems"]
sources:
  - "Shapiro et al., 'Conflict-Free Replicated Data Types' (2011)"
  - "Cassandra documentation on read repair and hinted handoff"
---

## Eventual consistency is a guarantee about convergence, not correctness at any given moment

This track's CAP theorem and Dynamo case study lessons establish that AP systems accept temporary inconsistency across replicas in exchange for availability. **Eventual consistency** is the specific, formal guarantee those systems provide: if no new writes occur, all replicas will *eventually* converge to the same value — it says nothing about how long "eventually" takes, or what a read might see in the meantime. This lesson covers the actual mechanisms that make convergence happen reliably, rather than leaving it to chance.

## Read repair: fixing staleness opportunistically during normal reads

**Read repair** is a lightweight mechanism triggered as a side effect of ordinary read operations: when a read (per the Dynamo case study's quorum model) queries multiple replicas and notices they disagree, it can, as part of handling that read, write the most up-to-date version back to the stale replica(s) — repairing the inconsistency it happened to discover, without needing a separate dedicated process to find and fix it. This is opportunistic and cheap (it piggybacks on reads that were happening anyway) but incomplete on its own — a key that's never read again after a stale write won't get repaired by this mechanism alone, since read repair only fires when an actual read happens to touch the inconsistent data.

## Anti-entropy: proactively finding and fixing inconsistency

**Anti-entropy** processes run independently of normal read/write traffic, periodically comparing replicas' full datasets (or a stored summary of them) to find and repair inconsistencies that read repair's opportunistic mechanism might miss — covering the case of rarely-read keys that could otherwise remain silently inconsistent indefinitely. A common efficient implementation uses **Merkle trees** — a hash tree where each node's hash summarizes its subtree's contents — letting two replicas efficiently identify which specific subset of data actually differs by comparing hash trees top-down (mismatched hashes indicate a subtree needing deeper comparison; matching hashes mean that subtree is already consistent and can be skipped entirely), rather than needing to compare every individual key between replicas, which would be prohibitively expensive at scale.

## CRDTs: making convergence automatic and conflict-free by construction

This track's Dynamo case study covered vector clocks detecting conflicts and pushing resolution to the application layer. **CRDTs (Conflict-free Replicated Data Types)** take a different approach: instead of detecting conflicts after the fact and requiring application-specific merge logic, a CRDT's data structure and merge operation are mathematically designed so that any two divergent replicas' states can always be merged automatically into a single, correct result, regardless of the order operations arrived in or how long replicas were disconnected — the merge function is commutative, associative, and idempotent by construction, guaranteeing convergence without requiring the application to write custom conflict-resolution logic for that specific data type.

Common CRDT examples: a **G-Counter** (grow-only counter) that only increments, where merging two replicas' counts takes the per-replica maximum for each contributor, always producing a correct combined total regardless of merge order; an **OR-Set** (observed-remove set) that correctly handles concurrent adds and removes to the same set (directly solving the exact ambiguity the Dynamo case study's shopping-cart union-merge example handled with simpler, less general application-specific logic) by tracking enough metadata about each add/remove operation to resolve concurrent modifications correctly and automatically.

The tradeoff: CRDTs only exist for a specific, somewhat constrained set of data structures and operations (counters, sets, certain kinds of collaborative text editing structures) — not every application data model maps cleanly onto an available CRDT, and when it doesn't, the Dynamo-style "detect the conflict, let the application resolve it" approach remains necessary.

## A worked example

**Scenario:** a collaborative document-editing feature needs to handle concurrent edits from users who may be temporarily disconnected from each other, converging correctly once reconnected.

- **A CRDT-based approach** (specifically, one of the CRDT designs built for collaborative text editing, tracking character-level insertions with enough ordering metadata to merge concurrent edits deterministically) is chosen over a naive last-write-wins or vector-clock-plus-manual-merge approach — since a well-designed text-editing CRDT can merge two users' concurrent edits automatically and correctly (interleaving both users' insertions sensibly) without needing custom, error-prone application-level merge logic for every possible concurrent-edit scenario.
- **Anti-entropy runs periodically** between replicas holding different users' edit histories, using Merkle-tree comparison to efficiently identify and sync any edits that haven't yet propagated through normal channels — covering edge cases like a user who was disconnected for an extended period and needs their edits properly merged in once reconnected, beyond what opportunistic read repair alone would catch.
- **Read repair operates continuously** during normal document access, opportunistically fixing minor propagation lag noticed during ordinary reads without waiting for the next anti-entropy cycle.

## Common mistakes

- **Relying on read repair alone without any anti-entropy process**, leaving rarely-accessed data permanently inconsistent across replicas if it never happens to be read while in a divergent state — a real risk read repair's opportunistic nature can't cover on its own.
- **Reaching for custom application-level conflict resolution when a well-suited CRDT already exists for the data type in question.** As shown in the worked example, a proven CRDT design can eliminate an entire category of manual merge-logic bugs that a hand-rolled resolution strategy is prone to.
- **Assuming a CRDT exists for every data model.** CRDTs cover a specific, real but bounded set of data structures — forcing an application's genuinely complex, relational data model into an ill-fitting CRDT abstraction, rather than accepting Dynamo-style application-level conflict resolution for the cases that don't map cleanly, tends to produce worse outcomes than either approach used where it actually fits.
