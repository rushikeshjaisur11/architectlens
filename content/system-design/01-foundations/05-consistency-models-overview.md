---
title: "Consistency Models Overview: Strong, Eventual, Causal, and Read-Your-Writes"
short_title: "Consistency Models"
tags: ["consistency", "distributed-systems", "foundations", "replication"]
sources:
  - "Werner Vogels, 'Eventually Consistent' (ACM Queue, 2008 / CACM 2009)"
  - "Peter Bailis & Ali Ghodsi, 'Eventual Consistency Today: Limitations, Extensions, and Beyond' (ACM Queue, 2013)"
  - "Jepsen.io consistency model documentation (Kyle Kingsbury)"
---

## Why consistency needs a spectrum, not a switch

In a single-node database, "consistency" is simple: there's one copy of the data, so every read sees the latest write. Once you replicate data across multiple nodes for availability or geographic proximity, you're forced to answer a harder question: when a write happens on one replica, what can a read on a *different* replica see, and when? **Consistency models** are formal contracts that answer this question. Choosing one is a real trade-off against latency and availability (per CAP and its more nuanced successor, PACELC), not a solved problem you can sidestep.

## Strong consistency (linearizability)

**Linearizability** guarantees that every operation appears to take effect instantaneously at some point between its invocation and response, and that all nodes agree on a single global order of operations. Practically: once a write completes, every subsequent read from any replica sees that write — there is no window where stale data is visible. Systems like Google Spanner (using TrueTime) and etcd/ZooKeeper (using consensus protocols like Raft/Paxos) provide this. The cost is latency: achieving agreement across replicas typically requires a quorum round trip, and under network partition, the system must choose to reject requests rather than risk disagreement (the "C" in CP from CAP).

## Eventual consistency

**Eventual consistency**, as formalized by Werner Vogels in his widely-cited "Eventually Consistent" paper, guarantees only that *if no new updates are made*, all replicas will *eventually* converge to the same value — with no bound on how long "eventually" takes. This is the model behind Amazon Dynamo and systems like Cassandra in their default configuration. The payoff is availability and low latency: a replica can always answer a read or write locally without coordinating with others. The cost is that a client can read stale — even out-of-order — data, and concurrent writes to the same key require a conflict-resolution strategy (last-write-wins, vector clocks, or CRDTs).

## Causal consistency

**Causal consistency** sits between the two: it guarantees that operations which are causally related (e.g., a reply to a comment) are seen by every replica in the same order, while operations with no causal relationship can be seen in different orders on different replicas. This is enforced by tracking causality — typically with vector clocks or dependency metadata — rather than a global total order. The practical benefit is that it avoids the "reply appeared before the comment it's replying to" class of bug that pure eventual consistency permits, without paying for full linearizability's coordination cost.

## Read-your-writes (and session guarantees)

**Read-your-writes consistency** is a narrower, client-centric guarantee: after a client writes a value, that same client's subsequent reads will always reflect that write (or a later one), even if other clients might briefly see stale data. It's one of several "session guarantees" described in Vogels' taxonomy, alongside monotonic reads (a client never sees data go backward in time) and monotonic writes. This is commonly implemented by routing a client's reads to the same replica it wrote to (session affinity) or by having the client track a version/timestamp token and requiring reads to be at least that fresh.

## Choosing a model in practice

- Use **strong consistency** for data where correctness under concurrent access is non-negotiable: financial balances, inventory counts, leader election, distributed locks.
- Use **eventual consistency** where availability and low latency matter more than immediate freshness, and where conflicts are rare or easily resolved: social media likes/counters, DNS, caches, shopping cart items (Dynamo's original use case).
- Use **causal or read-your-writes consistency** as a middle ground for user-facing features where "the user should see their own action reflected immediately" matters, but global ordering across all users doesn't: comment threads, chat applications, collaborative editing.

## Common mistakes

- **Assuming "eventual" means "within milliseconds."** The model gives no time bound at all; under partition or high load, convergence can take much longer than intuition suggests.
- **Conflating consistency models with CAP's "C."** CAP's consistency is specifically linearizability; causal consistency and read-your-writes are distinct, separately useful points on the spectrum, not just "weaker CAP."
- **Picking the strongest model everywhere "to be safe."** Defaulting to strong consistency for data that doesn't need it (e.g., a view counter) adds coordination latency and reduces availability for no real correctness benefit.
