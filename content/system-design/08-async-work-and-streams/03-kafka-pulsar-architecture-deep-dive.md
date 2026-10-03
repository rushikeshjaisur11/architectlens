---
title: "Kafka/Pulsar Architecture Deep Dive: Partitions, Consumer Groups, Offsets"
short_title: "Kafka/Pulsar Architecture"
tags: ["messaging", "kafka", "pulsar", "distributed-systems", "streaming"]
sources:
  - "Apache Kafka documentation (kafka.apache.org) — design and implementation"
  - "Apache Pulsar documentation (pulsar.apache.org) — architecture overview"
  - "Apache Kafka 4.0 release announcement (March 2025) and Kafka 4.1 upgrade notes, kafka.apache.org (via search results, October 2026)"
banner:
  layout: line
  nodes:
    - [server, "producer"]
    - [queue, "partitions"]
    - [server, "consumer group"]
    - [db, "log segments"]
---

## The log as the core abstraction

Kafka's fundamental data structure is the **partitioned, append-only log**. A **topic** is a logical stream of records; each topic is split into one or more **partitions**, and each partition is a strictly ordered, immutable sequence of records, each assigned a sequential **offset** (its position in that partition). Ordering is guaranteed *within* a partition, never across the whole topic — a producer that needs related records processed in order (e.g., all events for one customer) must route them to the same partition, typically by hashing a partition key. Partitions are also the unit of parallelism: a topic with 12 partitions can be consumed by up to 12 consumer instances in parallel, each owning a disjoint subset.

Pulsar separates this differently: it splits the **serving layer** (brokers, which handle producer/consumer connections and topic logic) from the **storage layer** (Apache BookKeeper, which durably stores the log as segments called ledgers across "bookies"). Kafka couples both roles into one broker process, which owns both the client-facing protocol and the on-disk log for the partitions it leads. This is why Pulsar brokers are stateless with respect to storage — a broker crash means a topic's ownership fails over to another broker without any data needing to move, since the data lives in BookKeeper, not on the broker itself.

## Consumer groups: how parallel consumption is coordinated

A **consumer group** is a set of consumer instances sharing a group ID that jointly consume a topic, with Kafka guaranteeing that each partition is assigned to exactly one consumer within the group at a time — this is what makes parallel, non-overlapping consumption possible without consumers coordinating directly with each other. A **group coordinator** (a designated broker) tracks group membership and triggers a **rebalance** — reassigning partitions across the group's consumers — whenever a consumer joins, leaves, or is deemed dead via a missed heartbeat. Rebalances briefly pause consumption for the whole group while assignment settles, which is why frequent membership churn (consumers crashing and restarting, or overly aggressive `session.timeout.ms`) shows up as periodic consumption stalls.

Multiple consumer groups can independently consume the same topic at their own pace — this is the basis of Kafka's pub/sub model: each group gets its own full copy of the stream, tracked by its own offsets, so a topic can simultaneously feed a real-time fraud-detection consumer and a separate batch-loading-into-a-warehouse consumer without either affecting the other.

Pulsar generalizes this further with four native subscription modes on top of the same storage: **exclusive** (one consumer, like a single Kafka consumer), **shared** (multiple consumers round-robin individual messages, closer to a traditional queue — sacrificing per-partition ordering for finer-grained load balancing), **failover** (Kafka-consumer-group-like: one active consumer per partition, others standing by), and **key_shared** (messages with the same key always go to the same consumer, preserving per-key ordering while still load-balancing across consumers). Kafka only really offers the failover-equivalent mode natively; Pulsar's shared mode is a meaningfully different guarantee Kafka doesn't have an equivalent for.

## Offsets: consumption position, and who tracks it

An **offset** is a per-partition integer marking how far a consumer has read. In Kafka, offsets are committed by the consumer (automatically on an interval, or manually after successful processing) into a special internal topic, `__consumer_offsets` — meaning offset tracking is itself just another Kafka log, replicated and durable like any topic. Committing too early (before processing actually completes) risks message loss on a crash — the consumer would resume past a message it never truly finished; committing manually only after processing succeeds is the standard pattern for at-least-once semantics.

Pulsar tracks position differently: rather than a consumer-managed offset, each subscription maintains a **cursor** — the broker-side bookmark of what's been acknowledged — stored in BookKeeper alongside the data. Consumers acknowledge individual messages (or cumulatively, up to a point), and the broker advances the cursor accordingly. This shifts more of the position-tracking responsibility to the broker/storage layer rather than the client, which is consistent with Pulsar's general split of "smart storage, thinner client contract."

## A worked example

**Scenario:** an e-commerce platform has an `orders` topic with 6 partitions, keyed by `customer_id`, feeding two independent teams: a real-time inventory-reservation service and a nightly analytics loader.

- Both read the same topic through **separate consumer groups** (`inventory-service` and `analytics-loader`), each maintaining its own offsets — the analytics loader can fall behind by hours without affecting inventory reservation's near-real-time consumption.
- Within `inventory-service`, running 3 consumer instances against 6 partitions, Kafka assigns 2 partitions per instance; if one instance crashes, a rebalance reassigns its 2 partitions across the remaining 2 instances, briefly pausing consumption during reassignment.
- Because partitioning is by `customer_id`, all of one customer's order events land in the same partition and are guaranteed to be processed in order — critical for not reserving inventory against a canceled order.

## Current practice (verified October 2026)

Current state: **Apache Kafka 4.0 (18 March 2025) removed ZooKeeper entirely**; KRaft, Kafka's Raft-based controller quorum, is the only metadata mode, so older descriptions of ZooKeeper-managed clusters apply to earlier versions only. **KIP-932 share groups ("queues for Kafka")** let several consumers read from the same partition with per-message acknowledgement, giving a native work-queue model; they were early access in 4.0 and promoted to preview in 4.1 (September 2025). Plan upgrades through the supported KRaft migration path and confirm share-group maturity before relying on it in production.

## Common mistakes

- **Assuming topic-wide ordering.** Kafka and Pulsar (outside key_shared mode) only guarantee ordering within a partition; relying on global topic order silently breaks the moment there's more than one partition.
- **Over-partitioning for parallelism without considering rebalance cost.** More partitions means more parallelism headroom, but also a larger, slower rebalance when group membership changes, and more open file handles / replication overhead per broker.
- **Committing offsets before processing completes** (e.g., auto-commit on a timer regardless of processing outcome), which silently drops messages that were "consumed" from the offset's perspective but never actually finished processing before a crash.
