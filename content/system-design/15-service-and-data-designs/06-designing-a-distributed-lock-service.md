---
title: "Designing a Distributed Lock Service"
short_title: "Distributed Lock Service"
tags: ["locks", "coordination", "consensus", "leases", "fencing"]
sources:
  - "Burrows, 'The Chubby Lock Service for Loosely-Coupled Distributed Systems' (Google, OSDI 2006)"
  - "Kleppmann, 'How to do distributed locking' (2016) and Designing Data-Intensive Applications (2017), fencing tokens"
  - "Apache ZooKeeper and etcd documentation on locks, leases and ephemeral nodes"
predict:
  question: "Client A holds a lock with a 30-second lease and a fencing token of 33. It freezes for 40 seconds, B acquires with token 34 and writes, then A wakes and writes. What happens to A's write?"
  options: ["It is rejected, because the resource has already seen token 34 and refuses lower tokens", "It succeeds, because A checked the lock before it froze", "It succeeds, but B's write is then rolled back by the lock service"]
  answer: 0
  why: "The resource rejects any token lower than the highest it has seen. The safety check lives in the resource, which is the only party that can order operations reliably."
check:
  - q: "Why is a single Redis node with SET NX a poor basis for a correctness lock?"
    options: ["SET NX is not atomic, so two clients can both create the key", "Failover can grant the lock twice and no fencing tokens are issued", "Redis cannot expire keys, so crashed holders block everyone"]
    answer: 1
    why: "The lesson names failover double-grants and the lack of fencing tokens. That makes it acceptable for efficiency locks but not for correctness."
  - q: "Duplicate runs of a nightly report job would only waste effort. Which lock is justified?"
    options: ["A consensus-replicated lock with fencing tokens, since every lock needs full guarantees", "No lock at all, because a lock service always costs more than duplicate work", "A simple, fast lock, since rare double runs only waste effort"]
    answer: 2
    why: "This is an efficiency lock, so occasional double execution breaks nothing. Correctness locks, where two holders cause damage, need fencing and stronger guarantees."
  - q: "Why does checking 'do I still hold the lock?' just before writing not make a lease lock safe?"
    options: ["A pause right after the check can let the lease expire before the write", "The check is too slow to run before every single write", "Lock services do not let a client read its own lease at all"]
    answer: 0
    why: "Garbage-collection pauses, VM stalls or partitions can strike between check and write. Only a check at the resource, via fencing tokens, closes that gap."
---

## Why a distributed lock

A single-process lock protects shared memory. A **distributed lock** makes sure that, across many machines, only one holder at a time performs some action: running a nightly job, updating a shared resource, acting as leader. It is a coordination tool, and it is easy to get subtly wrong.

First ask whether you need one. Many problems are better solved with idempotent operations, optimistic concurrency (compare-and-set on a version), or a queue with a single consumer per partition. A lock is the right tool when you truly need mutual exclusion over a resource that has no built-in concurrency control.

## Two purposes: efficiency and correctness

- **Efficiency locks** prevent duplicate work. If the lock occasionally fails and two workers run, you waste effort but nothing breaks. A simple, fast lock is fine.
- **Correctness locks** prevent data corruption. If two holders can act at once, damage occurs. These need much stronger guarantees, including fencing.

Knowing which you are building decides the required rigor.

## The basic design: a lease on a replicated store

A lock service stores a record per lock name: current owner and expiry. Clients acquire by writing their ID if the lock is free or expired, using an **atomic compare-and-set**. To tolerate server failure, the state lives in a **consensus-replicated** store (Raft in etcd, Zab in ZooKeeper, Paxos in Chubby), so a majority of nodes must agree and the lock state survives node loss.

Locks should be **leases**, not permanent. A lease has a time to live. The holder must renew it periodically while it is alive. If the holder dies, the lease expires and others can proceed. Without expiry, a crashed holder would block everyone forever.

ZooKeeper offers **ephemeral nodes** tied to a client session, which vanish when the session dies, a natural fit for locks and leader election. etcd offers leases attached to keys with similar effect.

## The hard problem: a paused holder

Consider this sequence:

1. Client A acquires the lock with a 30-second lease.
2. A pauses for 40 seconds, perhaps because of a long garbage-collection pause, a stalled VM, or a network partition.
3. The lease expires; client B acquires the lock and starts writing.
4. A wakes up, still believes it holds the lock, and writes too.

Two clients now act as owners. Checking "do I still hold the lock?" immediately before the write does not fix it, since a pause can occur right after the check. **No amount of client-side checking makes a lease-based lock safe on its own**, because clocks and processes are unreliable.

## Fencing tokens

The fix is a **fencing token**: a number that increases with every lock grant. The lock service gives A token 33 and later B token 34. Every request to the protected resource carries the token, and **the resource rejects any request with a token lower than the highest it has seen**. When A wakes and writes with 33, the resource has already seen 34 and refuses.

This moves the safety check into the resource, which is the only party that can order operations reliably. It requires the resource to support the check, for example storing the last token with the data and using a conditional update. If the resource cannot do that, the lock cannot guarantee correctness, only efficiency.

## Clocks and timeouts

Leases depend on time. Different machines' clocks drift, so lease logic should rely on **durations measured locally** (how long since I received the grant) rather than absolute timestamps from different machines. The holder should stop acting **before** the lease could expire, leaving a safety margin, and the server should treat the lease as live until its own timer runs out.

## Design questions to settle

- **Granularity:** one lock per resource, not one global lock, to avoid unnecessary contention.
- **Waiting:** clients can poll, or watch the lock key and be notified on release, which avoids a thundering herd when ordering waiters (ZooKeeper's sequential nodes let each waiter watch only its predecessor).
- **Reentrancy and ownership:** record the owner so only the holder can release; a stray release must not free someone else's lock.
- **Failure of the lock service:** decide whether clients should stop work (safe) or continue (available) when they cannot renew.

## A worked example

**Scenario:** three workers compete to be the single writer that compacts a shared file store.

- Each tries to create `/locks/compaction` in etcd with a 15-second lease. Worker 2 succeeds and receives token 7 (the key's revision number). The others watch the key.
- Worker 2 renews every 5 seconds and includes token 7 in every write to the storage layer. The storage layer keeps the highest token seen and rejects lower ones.
- Worker 2's VM freezes for 30 seconds. The lease expires, worker 1 acquires with token 8 and begins work.
- Worker 2 unfreezes and tries to write with token 7. Storage has seen 8 and rejects it. Worker 2 discovers it lost the lease on its next renewal and stops.

## Common mistakes

- **Using a single Redis node with SET NX and treating it as a correctness guarantee.** Failover can grant the lock twice, and there are no fencing tokens.
- **No expiry**, so crashed holders block everyone.
- **Believing "check then act" is safe** after a pause.
- **Relying on synchronized wall clocks** across machines.
- **A single global lock** that serializes unrelated work.
- **Using a lock where an idempotent operation or compare-and-set would do**, adding failure modes unnecessarily.
