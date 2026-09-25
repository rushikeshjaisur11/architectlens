---
title: "Clock Synchronization: NTP, Vector Clocks, and TrueTime"
short_title: "Clock Synchronization"
tags: ["clock-synchronization", "ntp", "vector-clocks", "truetime", "hybrid-logical-clocks", "distributed-systems"]
sources:
  - "David Mills et al., RFC 5905 (Network Time Protocol version 4)"
  - "Leslie Lamport, 'Time, Clocks, and the Ordering of Events in a Distributed System' (1978)"
  - "Colin Fidge / Friedemann Mattern, independent papers introducing vector clocks (1988)"
  - "Corbett et al., 'Spanner: Google's Globally-Distributed Database' (OSDI, 2012, TrueTime)"
  - "Sandeep Kulkarni et al., 'Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases' (HLC paper, 2014)"
---

## Why clocks are a distributed systems problem

Every machine has a physical clock, and no two physical clocks agree — crystal oscillators **drift** at different rates (commodity hardware drifts tens of milliseconds per day), and network delay makes it impossible to instantaneously compare two clocks across machines. This matters because so much of distributed system design — "which write happened last," "is this lease still valid," "can I safely read a consistent snapshot" — implicitly depends on ordering events across machines. There are three distinct approaches, solving three different problems: NTP synchronizes physical clocks, vector clocks capture logical causality without any physical time, and TrueTime/HLCs try to get useful guarantees out of physical clocks despite their imprecision.

## NTP: synchronizing physical time

The **Network Time Protocol** (RFC 5905) synchronizes a machine's clock to reference time servers in a hierarchy of **strata** (stratum 0 is a reference clock like a GPS or atomic clock; stratum 1 servers are directly attached to one; each subsequent stratum synchronizes from the one above). NTP estimates network round-trip delay and clock offset by exchanging timestamped packets and adjusts the local clock — usually by gradually slewing it rather than stepping it instantly, since a sudden jump backward can break applications that assume monotonic time. Even well-tuned NTP typically only gets clocks within single-digit milliseconds of each other on a LAN, and tens of milliseconds is common over the wider internet — which is why **you cannot use `System.currentTimeMillis()` timestamps to reliably order events across machines**: clock skew can exceed the actual time between two causally unrelated events, making "later timestamp" a wrong causality signal.

## Vector clocks: causality without physical time

Lamport's 1978 paper introduced **logical clocks** — a single counter per process, incremented on each local event and updated to `max(local, received) + 1` on receiving a message — which gives a **partial order** consistent with causality (the "happens-before" relation) but can't distinguish concurrent events from causally related ones using the scalar value alone.

**Vector clocks** (Fidge, Mattern) fix that gap: each process keeps a vector of counters, one per process in the system, incrementing its own entry on each event and merging (element-wise max) with a received vector on message receipt. Two events are provably concurrent if neither vector dominates the other component-wise — this is exactly the mechanism Amazon's Dynamo used to detect conflicting concurrent writes across replicas, surfacing them to the application for resolution rather than silently picking a winner. The cost is that vector size grows with the number of processes, which is why systems either cap participants or replace vector clocks with dotted version vectors / other compaction schemes at scale.

## TrueTime and hybrid logical clocks

Google's Spanner took a different bet: instead of avoiding reliance on physical time, make physical time trustworthy enough to use directly. **TrueTime** exposes not a single timestamp but an interval `[earliest, latest]` that is guaranteed to contain the true current time, built from GPS and atomic clock references in each data center. Spanner's **commit-wait**: before making a transaction's commit visible, it waits out the uncertainty interval, guaranteeing that if transaction T2 starts after T1 commits (in real time), T2's timestamp is provably greater — giving Spanner external consistency (linearizability) across a globally distributed database, something pure logical clocks can't provide because they carry no relationship to real elapsed time.

**Hybrid Logical Clocks (HLCs)**, introduced by Kulkarni et al., are the pragmatic middle ground for systems without GPS/atomic clock hardware: each timestamp combines a physical-time component (bounded close to NTP time) with a logical counter that increments when physical clocks don't advance fast enough to preserve causality. This gives you timestamps that are both causality-consistent (like Lamport clocks) and close to wall-clock time (useful for humans and for approximating "recency"), and it's what CockroachDB uses for its MVCC timestamps instead of requiring TrueTime-grade hardware.

## Common mistakes

- **Using wall-clock timestamps as a tie-breaker for "last write wins" without accounting for skew.** A write from a machine with a fast clock can incorrectly "win" over a causally later write from a machine with a slow clock.
- **Assuming vector clocks scale to large, dynamic clusters.** The vector grows with participant count; unbounded membership churn makes raw vector clocks impractical without compaction.
- **Treating TrueTime's uncertainty bound as free.** Commit-wait directly adds latency equal to the uncertainty interval to every commit — Spanner's design is a deliberate trade of latency for external consistency, not a free lunch.
- **Conflating logical and physical clocks.** A logical (Lamport) clock only orders causally related events — it says nothing about real elapsed time, so it can't be used for TTLs, timeouts, or human-facing "when did this happen" answers.
