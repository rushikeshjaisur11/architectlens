---
title: "CAP Theorem: Why You Can't Have It All"
short_title: "CAP Theorem"
tags: ["distributed-systems", "consistency", "availability", "foundations"]
sources:
  - "Eric Brewer, PODC 2000 keynote (Brewer's conjecture)"
  - "Seth Gilbert & Nancy Lynch, 'Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services' (2002)"
banner:
  layout: line
  nodes:
    - [db, "node A"]
    - [cloud, "partition"]
    - [db, "node B"]
    - [shield, "C or A"]
predict:
  question: "A shopping cart is replicated across 3 regions and two regions are partitioned from each other. In the CP design, what happens to the minority region?"
  options: ["It keeps accepting writes and merges them once the partition heals", "It stops accepting writes rather than risk divergence", "It accepts writes locally but rejects all reads until healing"]
  answer: 1
  why: "A CP design requires majority acknowledgement, so the minority side refuses writes instead of diverging."
check:
  - q: "Why is the 'pick two of three' shorthand misleading?"
    options: ["Partitions will happen anyway, so the real choice is C or A during one", "Partition tolerance is optional on a fast network, so any two can be picked", "Consistency and availability can both always be kept during a partition"]
    answer: 0
    why: "Since partitions are a fact of life, CAP actually asks whether to sacrifice consistency or availability when one occurs."
  - q: "Why is PACELC often more useful day to day than CAP?"
    options: ["It removes the partition tradeoff, so systems can be both C and A", "It shows that AP systems have no consistency guarantee at all", "It captures that even without a partition you trade consistency against latency"]
    answer: 2
    why: "Every synchronous replication step added for consistency costs response time even when the network is healthy."
  - q: "A payments flow and a product view counter live in one architecture. How should CAP apply?"
    options: ["Label the whole system CP, since the payments flow needs consistency", "Choose per operation: CP for payments, AP for view counts", "Label the whole system AP, since view counts dominate traffic volume"]
    answer: 1
    why: "Real systems are often CP for some operations and AP for others, so a single system-wide label is a mistake."
---

## The three properties

Any distributed data store makes a tradeoff between three properties:

- **Consistency (C)** — every read receives the most recent write, or an error. All nodes see the same data at the same time.
- **Availability (A)** — every request receives a response (success or failure), without guarantee it contains the most recent write.
- **Partition tolerance (P)** — the system keeps operating despite network partitions (messages between nodes being dropped or delayed).

## The actual claim

The common shorthand — "pick two of three" — is misleading. In practice, network partitions *will* happen in any real distributed system, so partition tolerance isn't optional; it's a fact of life you must design around. The real choice CAP forces is:

**When a partition happens, do you sacrifice consistency or availability?**

- **CP systems** (e.g. a strongly consistent config store like etcd or ZooKeeper) refuse to serve a request if they can't guarantee it reflects the latest write. During a partition, some nodes return errors rather than stale data.
- **AP systems** (e.g. Cassandra in its default configuration, DynamoDB) keep serving requests during a partition, even if that means a client might read stale data from a node that hasn't caught up yet.

Outside of partitions, most systems try to offer both C and A — CAP only bites when the network actually splits.

<div data-anim="cap-partition"></div>

## Why this matters in practice

The theorem is a floor, not a design guide. It tells you what's impossible, not what to build. Two systems can both be "AP" and behave completely differently depending on:

- How long staleness windows are (milliseconds vs. seconds vs. minutes)
- Whether conflicts are resolved automatically (last-write-wins, vector clocks) or pushed to the application
- Whether the tradeoff is global or configurable per-request (Cassandra lets you choose consistency level per query)

This is why **PACELC** (an extension proposed by Daniel Abadi) is often more useful day-to-day: *if Partitioned, choose Availability or Consistency; Else (no partition), choose Latency or Consistency.* It captures that even without a partition, you're still trading consistency against latency — every synchronous replication step you add for consistency costs you response time.

## A concrete example

Imagine a shopping cart service replicated across three regions.

- **CP choice**: every add-to-cart write must be acknowledged by a majority of replicas before returning success. If two of three regions are partitioned from each other, the minority region stops accepting writes rather than risk divergence.
- **AP choice**: every region accepts writes locally and replicates asynchronously. If a partition happens, both sides keep accepting adds-to-cart independently; when the partition heals, the system merges the two carts (e.g. union of items) rather than picking a "winner."

Neither is wrong — it depends on whether a lost cart item (availability sacrifice) or a rejected checkout during a network blip (consistency sacrifice) is the worse user experience for your product.

## Common mistakes

- Treating CAP as a binary system-wide label. Real systems are often CP for some operations (e.g. payments) and AP for others (e.g. product view counts) within the same architecture.
- Forgetting that "consistency" in CAP means *linearizability*, a much stronger guarantee than the "ACID consistency" of a single-node database (which is about constraints like foreign keys, not cross-node ordering).
- Assuming AP means "no consistency at all." Most AP systems still offer *eventual consistency* — replicas converge once communication resumes — which is a real guarantee, just not an immediate one.
