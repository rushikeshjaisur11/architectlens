---
title: "Consensus and Leader Election: Getting Distributed Nodes to Agree"
short_title: "Consensus and Leader Election"
tags: ["distributed-systems", "consensus", "coordination"]
sources:
  - "Diego Ongaro & John Ousterhout, 'In Search of an Understandable Consensus Algorithm' (2014, the Raft paper)"
  - "Leslie Lamport, 'The Part-Time Parliament' (1998, the original Paxos paper)"
---

## Why distributed nodes need to agree on anything

Many distributed systems need multiple nodes to agree on a single fact despite nodes failing, messages getting lost or delayed, and no shared clock to order events globally. Common examples: which node is currently the leader responsible for writes, what the current value of a piece of configuration is, or what order a set of operations happened in. **Consensus algorithms** exist to guarantee that all correctly-functioning nodes agree on the same answer, even under partial failure — without consensus, different nodes could each believe a different, conflicting answer is true, leading to split-brain scenarios (two nodes both believing they're the leader, both accepting writes, producing divergent state).

## Why this is genuinely hard

The difficulty isn't reaching agreement when everything works — it's reaching agreement correctly when things fail in the middle of the process. A node might crash after sending half its messages. A network partition might let two groups of nodes each believe they have a majority. A message might arrive, but the acknowledgment gets lost, so the sender doesn't know if it succeeded. A correct consensus algorithm has to handle all of these without ever letting two nodes settle on different answers — an easy property to state, and a genuinely hard one to prove.

## Paxos and Raft: two consensus algorithms with the same goal

**Paxos** (Lamport, 1998) was the first widely studied consensus algorithm, proven correct, but famously difficult to understand and even more difficult to implement correctly from the paper alone — enough so that "here's how we actually implemented Paxos" became its own genre of systems paper, because the original description left enough gaps that real implementations diverged.

**Raft** (Ongaro & Ousterhout, 2014) was explicitly designed to be *understandable* while providing the same guarantees, by decomposing the problem into three separable sub-problems:

- **Leader election** — nodes vote to elect one leader; if the leader fails, a new election happens. A candidate needs votes from a majority of nodes to become leader, which is what prevents two leaders existing simultaneously (two disjoint majorities can't both exist in a fixed set of nodes).
- **Log replication** — the leader appends new entries to its log and replicates them to followers; an entry is considered committed once a majority of nodes have it, at which point it's safe to apply.
- **Safety** — a set of rules (a candidate must have an up-to-date log to win an election, entries are only committed from the leader's current term) that prevent a node with stale data from becoming leader and overwriting newer committed data.

Raft's popularity in real systems (etcd, Consul, CockroachDB all use it) comes largely from this decomposition making it feasible to implement and reason about correctly — a direct, deliberate answer to Paxos's reputation for being correct but nearly impossible to implement without subtle bugs.

## The majority-quorum requirement, and why it matters operationally

Both algorithms require a majority (more than half) of nodes to agree before committing anything. This has a direct, practical consequence: a 5-node cluster tolerates 2 node failures and keeps operating (3 remaining nodes still form a majority), but a 3-node cluster only tolerates 1 failure. Adding nodes doesn't always add proportional fault tolerance — a 4-node cluster still only tolerates 1 failure (since losing 2 of 4 means no majority remains), the same as a 3-node cluster, while costing more to run. This is why production Raft/Paxos clusters are almost always sized as odd numbers (3, 5, 7) — even-sized clusters spend resources without gaining fault tolerance.

## A worked example

**Scenario:** a distributed configuration store (like etcd) needs to guarantee that a "which service is currently the primary database" flag is agreed upon by all nodes, even if the current leader crashes mid-update.

- The store runs as a 5-node Raft cluster. A client writing "primary = db-server-2" sends the write to the current leader, which appends it to its log and replicates to followers.
- The write is only acknowledged as committed once 3 of the 5 nodes (a majority) have durably stored it — at that point, even if the leader crashes immediately after, the new leader (elected from the remaining nodes) is guaranteed to have that committed entry, because at least one node in any future majority overlaps with the majority that committed it.
- If the leader crashes before reaching a majority, the write is not yet committed, and after a new leader is elected, that partial write is safely discarded rather than left in an ambiguous state — this is the concrete guarantee "consensus" is providing: no node ever sees a partial or contradictory answer to "what is the current primary."

## Common mistakes

- **Rolling your own consensus protocol for a specific use case** instead of using a well-tested implementation (Raft via etcd/Consul, or a managed equivalent). The subtlety here is real — a plausible-looking custom implementation can pass every normal-case test and still have a rare, hard-to-reproduce bug under a specific failure sequence, exactly the case consensus algorithms exist to handle correctly.
- **Sizing a cluster with an even number of nodes**, gaining cost without gaining fault tolerance, as shown above.
- **Confusing consensus with simple leader-based replication without quorum guarantees.** A system where a leader replicates to followers but doesn't require majority acknowledgment before committing can lose committed-looking writes on leader failure — that's not consensus, even if it looks superficially similar.
