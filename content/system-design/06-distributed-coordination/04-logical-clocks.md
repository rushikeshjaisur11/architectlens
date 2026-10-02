---
title: "Logical Clocks: Ordering Events Without Trusting Wall Time"
short_title: "Logical Clocks"
tags: ["distributed-systems", "clocks", "ordering", "vector-clocks"]
sources:
  - "Leslie Lamport, 'Time, Clocks, and the Ordering of Events in a Distributed System' (1978)"
  - "Kulkarni et al., 'Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases' (2014, hybrid logical clocks)"
---

## Why wall-clock time can't order events across machines

Each machine's clock drifts, gets adjusted by time-sync protocols, and can even jump backward. Two events stamped `10:00:00.003` on one machine and `10:00:00.001` on another don't reliably tell you which happened first. This track's Spanner case study shows one answer — spend serious hardware to bound the uncertainty. Most systems can't, so they use a different idea: stop asking *when* something happened and track only *what could have influenced what*.

## The happens-before relation

Lamport's key move was to define ordering by causality. Event A **happens before** B if A and B occur on the same process with A first, or if A is the sending of a message and B is its receipt, or if there's a chain of such links from A to B. If neither A→B nor B→A holds, the events are **concurrent**: neither could have known about the other. Concurrent doesn't mean "at the same instant" — it means causally unrelated.

## Lamport clocks: a counter that respects causality

Each process keeps an integer counter:

1. Before each local event, increment the counter.
2. When sending a message, attach the current counter.
3. On receiving a message with timestamp `t`, set the counter to `max(local, t) + 1`.

This guarantees that if A happens before B, then `timestamp(A) < timestamp(B)`. The converse does **not** hold: a smaller timestamp doesn't prove one event preceded the other, because concurrent events also get ordered numbers. Lamport clocks give a consistent total order (break ties by process ID) but can't tell you whether two events were actually concurrent.

## Vector clocks: detecting concurrency

A **vector clock** keeps one counter *per process*. A process increments its own entry on each event, attaches the whole vector to messages, and on receipt takes the element-wise maximum, then increments its own entry. Comparing two vectors then gives a precise answer:

- If every entry of `V1` is ≤ the matching entry of `V2` (and at least one is smaller), `V1` happened before `V2`.
- If neither vector dominates the other, the events are **concurrent** — a genuine conflict.

This is exactly what the Dynamo case study in this track relied on to tell "this version supersedes that one" from "these two writes happened independently and need reconciling."

The cost is size: the vector grows with the number of participants. Real systems cap or prune them, or use variants (version vectors, dotted version vectors) that track per-replica rather than per-client counters.

## Hybrid logical clocks: wall time, with causality guaranteed

**Hybrid logical clocks (HLC)** combine a physical timestamp with a small logical counter. The timestamp stays close to real time, so values are human-meaningful and usable for things like "show me data as of 5 minutes ago," while the logical component preserves the happens-before guarantee even when physical clocks disagree slightly. Some distributed databases use HLCs to get causally consistent timestamps without specialized clock hardware.

## A worked example

**Scenario:** a replicated key-value store has three replicas, A, B, and C. A client writes `x=1` via A. A client then writes `x=2` via B *before* hearing about the first write.

- A's write gets vector `[A:1, B:0, C:0]`; B's write gets `[A:0, B:1, C:0]`.
- Neither dominates the other, so the store correctly flags the two writes as **concurrent** and keeps both versions for reconciliation.
- Now suppose a later write at C first receives A's version, then writes. Its vector `[A:1, B:0, C:1]` dominates A's, so C's version **supersedes** A's and A's can be discarded.
- A Lamport clock would have ordered the two concurrent writes anyway, silently picking a winner and discarding data — the failure mode vector clocks exist to expose.

## Common mistakes

- **Reading a smaller Lamport timestamp as proof of "happened first."** It only holds in one direction; concurrent events get arbitrary relative numbers.
- **Using wall-clock last-write-wins and calling it ordering.** Clock skew means "last" may be wrong, and the loser's data is lost silently.
- **Letting vector clocks grow unbounded.** Plan for pruning or per-replica variants, and accept that pruning can occasionally cause a false conflict.
