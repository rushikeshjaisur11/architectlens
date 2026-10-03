---
title: "CRDTs and Conflict Resolution: Merging Without Coordination"
short_title: "CRDTs and Conflict Resolution"
tags: ["crdt", "conflict-resolution", "eventual-consistency", "collaboration", "replication"]
sources:
  - "Shapiro, Preguica, Baquero and Zawirski, 'Conflict-free Replicated Data Types' (2011) and 'A comprehensive study of Convergent and Commutative Replicated Data Types' (INRIA, 2011)"
  - "Kleppmann et al., 'Local-first software: you own your data, in spite of the cloud' (Ink & Switch, 2019)"
  - "Yjs and Automerge project documentation (open-source CRDT libraries)"
predict:
  question: "Two offline replicas each increment a shared counter by 1 from the same start. After reconnecting, what do a G-counter and an LWW register show?"
  options:
    - "Both show +2, because any convergent merge keeps every increment"
    - "The G-counter shows +2, but an LWW register keeps only +1"
    - "Both show +1, because concurrent updates to one value always collapse"
  answer: 1
  why: "G-counter merge takes the element-wise maximum per replica, so both increments survive, while LWW discards one side's work."
check:
  - q: "Alice removes milk (seen as tag a1) while offline Bob re-adds milk (tag b7). What does an OR-set show after merge?"
    options:
      - "The remove deletes only tag a1, so Bob's re-add survives and milk stays"
      - "The remove wins, because removal always overrides concurrent adds of the same item"
      - "Milk disappears on one phone and stays on the other, as the replicas never converge"
    answer: 0
    why: "A remove only deletes tags it has seen, giving add-wins semantics."
  - q: "Why can a CRDT alone not enforce one booking per seat?"
    options:
      - "CRDT merges are too slow to check a seat, so the check runs asynchronously"
      - "Uniqueness and non-negativity invariants need coordination, which merging alone cannot enforce"
      - "CRDTs lose updates under concurrency, so two bookings would both be silently dropped"
    answer: 1
    why: "Merging guarantees convergence, not business invariants."
  - q: "What do CRDTs trade against operational transformation?"
    options:
      - "CRDTs need a central server to order operations, but they avoid any metadata growth"
      - "OT works peer-to-peer as easily as with a server, so CRDTs only add extra complexity"
      - "CRDTs carry extra metadata like unique ids and tombstones, but can merge anywhere, even peer-to-peer"
    answer: 2
    why: "OT leans on a central server, CRDTs pay in metadata for location independence."
---

## The conflict problem

Two people edit the same document offline. Two data centres accept writes to the same counter. A phone and a laptop both change a contact's phone number. When the replicas reconnect, their states differ and must be **merged**. Strong consistency avoids this by forcing one order (a leader or consensus), at the cost of latency and unavailability during partitions (see the CAP lesson). If you want replicas to accept writes locally and still converge, you need a merge rule that never loses information unpredictably.

## Last-writer-wins and why it is not enough

The simplest rule is **last writer wins (LWW)**: each write carries a timestamp and the larger timestamp survives. It is easy and always converges, but it silently **discards** one side's work, and clocks are imperfect (skew can make the "last" write win incorrectly). For a shared counter, two concurrent increments of +1 and +1 would produce +1, not +2. For text, one person's paragraph vanishes. LWW is fine for data where overwriting is acceptable (a profile photo), and wrong for collaborative or accumulating data.

## What a CRDT is

A **conflict-free replicated data type** is a data structure designed so that replicas can be updated independently and **any two replicas that have seen the same set of updates are in the same state**, regardless of the order or the number of times updates arrive. This property (strong eventual consistency) holds by construction, with no coordination, no locks and no central server required.

Two styles:

- **State-based (convergent) CRDTs** send their whole state (or deltas) and merge with a function that is **commutative, associative and idempotent**: merge(a, b) = merge(b, a); order of merging does not matter; merging the same state twice changes nothing. Together these properties are a semilattice, and they are why messages can be reordered, duplicated or delayed safely.
- **Operation-based (commutative) CRDTs** send operations that commute when applied in any causal order, and require the network to deliver each operation to each replica (exactly once, in causal order).

## Examples you can build by hand

- **G-counter (grow-only counter).** Each replica keeps its own count in a vector; value = sum of all entries; merge = element-wise maximum. Two replicas each increment once: [1,0] and [0,1] merge to [1,1], value 2. Correct where LWW would give 1.
- **PN-counter.** Two G-counters, one for increments and one for decrements; value = P minus N. Supports decrements.
- **G-set / OR-set.** A grow-only set merges by union. An **observed-remove set** tags each added element with a unique id; a remove deletes only the tags it has seen, so a concurrent re-add survives ("add wins").
- **LWW-register.** A single value with a timestamp; deterministic but lossy, as above.
- **Sequences for text (RGA, Logoot, Yjs, Automerge).** Each character gets a unique, ordered identifier so that concurrent inserts at the same place resolve identically on every replica. These power collaborative editors and local-first apps.

## Operational transformation versus CRDTs

Earlier collaborative editors (Google Docs' lineage) used **operational transformation (OT)**: a central server orders operations and transforms concurrent ones against each other. It works well with a central server but is notoriously hard to get right in peer-to-peer settings. CRDTs trade metadata (unique ids, tombstones for deleted items) for the ability to merge anywhere, including offline and peer-to-peer.

## Costs and limits

- **Metadata growth**: tombstones and per-replica vectors grow; long-lived documents need garbage collection or periodic compaction (which itself needs some coordination).
- **Semantics are limited to what merges cleanly.** Business invariants like "balance must stay non-negative" or "only one booking per seat" cannot be enforced by a CRDT alone; they need coordination (a leader, reservation, or escrow).
- **Intent can be violated**: merged text can be grammatically odd even though every replica agrees.
- **Security**: any replica can submit operations, so authorisation and validation must happen on receipt.

## A worked example

A shared shopping list on phones, working offline.

1. Alice adds "milk" and Bob adds "eggs" while offline. Each add is tagged with a unique id; the OR-set merge is a union, so both appear on both phones when they reconnect.
2. Alice removes "milk" (she saw tag a1). Bob, still offline, also adds "milk" again (tag b7). After merge, the remove deletes a1 only; b7 survives, so milk remains. That is "add wins", a defensible choice, and a documented semantic.
3. A counter for "items checked off" is a G-counter per device; the total is the sum of device counts, never lost.
4. Where the app needs a rule like "only one person may claim the last coupon", it asks the server, because that invariant needs coordination.

## Common mistakes

- **Using LWW for counters and collaborative text.**
- **Assuming a CRDT can enforce uniqueness or non-negativity.**
- **Ignoring tombstone growth** in long-lived data.
- **Trusting remote operations** without authorisation checks.
- **Choosing CRDTs when a single leader would be simpler** and the system is online anyway.
