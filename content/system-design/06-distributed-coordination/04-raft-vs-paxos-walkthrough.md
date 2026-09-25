---
title: "Raft vs. Paxos: A Consensus Algorithm Walkthrough"
short_title: "Raft vs. Paxos"
tags: ["consensus", "raft", "paxos", "distributed-systems", "replication"]
sources:
  - "Diego Ongaro & John Ousterhout, 'In Search of an Understandable Consensus Algorithm' (Raft paper, 2014)"
  - "Leslie Lamport, 'Paxos Made Simple' (2001)"
  - "Leslie Lamport, 'The Part-Time Parliament' (original Paxos paper, 1998)"
---

## Why two algorithms for the same problem

Both Raft and Paxos solve **single-value and log-based consensus**: getting a cluster of nodes to agree on a sequence of values despite crashes and message loss, so a replicated state machine stays consistent. Paxos came first and is provably correct, but Lamport's own papers are notoriously hard to turn into working systems — the original "Part-Time Parliament" paper used a Greek-parliament allegory that engineers struggled to map onto real code. Ongaro and Ousterhout built Raft explicitly as a response: same guarantees, designed from the ground up for **understandability**, which they treated as a first-class engineering goal, not an afterthought.

## Paxos: the core mechanism

Basic (single-decree) Paxos has two phases run by a **proposer**: Phase 1 (Prepare/Promise) asks a majority of **acceptors** to promise not to accept proposals numbered lower than the current one, and acceptors reply with any value they've already accepted. Phase 2 (Accept/Accepted) has the proposer send a value — either its own, or the highest-numbered value returned in Phase 1 — and acceptors accept it unless they've since promised a higher number. A value is **chosen** once a majority of acceptors accept it. This guarantees safety (no two majorities can choose different values) through the interaction of the two phases and monotonically increasing proposal numbers.

The complexity multiplies in **Multi-Paxos**, the variant actually used to replicate a log: you need a stable leader to avoid re-running Phase 1 for every log entry, but the base protocol doesn't specify how leader election, log recovery, or membership changes work. Real systems (Google's Chubby, Spanner's underlying Paxos) each invented their own extensions, which is exactly the gap Raft closed.

## Raft: decomposition as the design principle

Raft's central move was **decomposition**: split consensus into three largely independent subproblems — leader election, log replication, and safety — each understandable on its own.

- **Leader election.** Every node is Follower, Candidate, or Leader. Followers expect periodic heartbeats from a leader; if none arrive before a randomized election timeout, a follower becomes a Candidate, increments a monotonic **term** number, and requests votes. Randomized timeouts (not a fixed value) are the key trick that avoids repeated split votes.
- **Log replication.** The leader is the only node that accepts client writes. It appends entries to its own log and replicates them via `AppendEntries` RPCs; an entry is committed once replicated to a majority. Followers are strictly passive — they never originate entries, which sidesteps much of Paxos's proposer-vs-proposer conflict handling.
- **Safety.** The **election restriction** guarantees a candidate can only win if its log is at least as up-to-date as a majority of the cluster (compared by last log term, then index), so a newly elected leader always already holds every committed entry. This replaces Paxos's per-value negotiation with a single up-front check at election time.

## Practical differences that matter

- **Leadership is explicit in Raft** (strong leader model) vs. implicit/optional in basic Paxos, where any proposer can drive a round. This makes Raft's normal-case operation — one RPC round-trip per entry — much easier to reason about and debug.
- **Membership changes** are part of Raft's core spec (joint consensus, later simplified to single-server changes), whereas classic Paxos leaves reconfiguration as an exercise for implementers.
- **Adoption**: etcd, Consul, CockroachDB, and TiKV are built on Raft largely because implementers could actually match code to the paper. Paxos variants (Multi-Paxos, Fast Paxos) power Chubby and Spanner, built by teams willing to invest in the extra complexity for marginal performance gains in specific topologies.

Both algorithms provide identical formal guarantees under the same failure model (crash-stop, not Byzantine; consensus requires a majority of nodes up). The choice between them today is really a choice of **implementation and ecosystem maturity**, not correctness.

## Common mistakes

- **Assuming Raft is "weaker" or a simplified toy version of Paxos.** It has an independent safety proof and is used in production systems handling the same workloads as Paxos-based ones.
- **Forgetting the majority requirement.** Both algorithms need a majority (not all) of nodes reachable to make progress; a 5-node cluster tolerates 2 failures, not 4.
- **Treating leader election timeouts as a tuning afterthought.** Too-aggressive timeouts in Raft cause unnecessary elections under normal network jitter; too-conservative ones slow failover — this value is a deliberate availability/stability trade-off, not a default to leave untouched.
- **Conflating consensus with transaction coordination.** Raft/Paxos agree on a single replicated log; they don't by themselves solve cross-shard atomicity, which is what two-phase commit and Sagas address instead.
