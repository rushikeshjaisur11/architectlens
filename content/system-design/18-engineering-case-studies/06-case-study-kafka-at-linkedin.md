---
title: "Case Study: Kafka at LinkedIn"
short_title: "Kafka at LinkedIn"
tags: ["case-study", "kafka", "log", "streaming", "linkedin"]
sources:
  - "Kreps, Narkhede and Rao, 'Kafka: a Distributed Messaging System for Log Processing' (NetDB 2011)"
  - "Jay Kreps, 'The Log: What every software engineer should know about real-time data's unifying abstraction' (LinkedIn Engineering, 2013)"
  - "Apache Kafka documentation, design section"
---

*Provenance note: this lesson summarizes the published Kafka paper and LinkedIn's engineering writing from memory. Verify exact figures and release history in the primary sources.*

## Where Kafka came from

By around 2010 LinkedIn had a growing mess of point-to-point data pipelines: activity events (page views, searches, clicks), operational metrics, logs, and database changes all had to reach various consumers such as search indexing, the news feed, analytics and Hadoop. Each new data source needing to reach each new consumer meant another custom pipeline. Existing message brokers did not fit well: they were designed for reliable delivery of individual transactional messages, were slow when messages accumulated, and did not scale out for the volume of activity data, which is huge but individually low in value.

The team built **Kafka** to be a single, high-throughput, durable pipeline that all producers write to and all consumers read from, decoupling the two sides.

## The central idea: the log

Kafka's abstraction is the **append-only log**: an ordered, immutable sequence of records. Producers append to the end. Each record gets a sequential number called an **offset**. Consumers read from a position they choose and move forward.

This simple structure gives surprising power:

- **Ordering** within the log is explicit.
- **Replayability:** because records are retained rather than deleted on read, a consumer can rewind to reprocess history after a bug or to add a new consumer later that starts from the beginning.
- **Decoupling:** a slow consumer does not affect others, since each tracks its own offset independently.

## Design decisions that made it fast

Kafka's performance came from leaning on how hardware and the operating system actually behave, rather than fighting them:

- **Sequential disk I/O.** Appending to a log and reading sequentially is very fast on disks, close to memory speed in aggregate, much faster than random access. Kafka writes everything to disk, and that is the design, not a fallback.
- **The OS page cache.** Instead of managing a large in-process cache, Kafka relies on the operating system's page cache. Recently written data is typically served from memory, and the cache survives process restarts.
- **Batching.** Producers send batches of messages and consumers fetch batches, amortizing network and disk overhead. Compression is applied to batches.
- **Zero-copy transfer.** For sending log data to consumers, Kafka uses the operating system's `sendfile` call so bytes move from the page cache to the network socket without being copied through user space.
- **A simple, stateless broker design.** The broker does not track per-message delivery state. The **consumer** tracks its own offset, which makes the broker's job cheap and pull-based consumption natural: consumers fetch at their own pace, giving built-in backpressure.

## Scaling out: topics and partitions

A **topic** is a named stream, split into **partitions**, each an independent ordered log. Partitions are spread across brokers, which gives horizontal scalability: more partitions mean more parallel writes and reads.

Ordering is guaranteed **only within a partition**. Producers choose the partition, often by hashing a key (such as a member ID) so all events for one key land in the same partition and stay ordered. This is a central trade-off: global ordering is sacrificed for scale.

**Consumer groups** let a set of consumers share a topic's work: each partition is assigned to exactly one consumer in the group, so parallelism is bounded by the partition count, and adding consumers beyond that does not help.

## Durability and availability

Each partition is **replicated** across several brokers: one leader handles reads and writes, followers copy the log. Followers that are fully caught up form the in-sync replica set; a write is acknowledged to the producer once the configured set has it, trading latency for durability. If a leader fails, an in-sync follower is promoted. Early versions coordinated membership and leadership through ZooKeeper, with later versions moving that responsibility into Kafka itself.

The delivery guarantee historically was **at-least-once**: a producer retry can produce duplicates, and consumers that crash after processing but before committing an offset reprocess records. Later versions added idempotent producers and transactions to support exactly-once processing within Kafka's own pipelines.

## What it changed at LinkedIn

Kafka became a **central nervous system**: instead of n by m pipelines, each system publishes to Kafka once, and any number of consumers subscribe. The log also made **stream processing** natural, since derived datasets such as search indexes and caches can be rebuilt by replaying a log, and databases can publish their changes as a stream for others to follow.

## A worked example

**Scenario:** a member views a profile.

- The web tier produces an event keyed by member ID to the `page-views` topic, which has 64 partitions. The key hash places it in partition 23, and it is appended at offset 9,114,882.
- A real-time analytics consumer group reads partition 23 in order, counting views. A separate consumer group feeding Hadoop reads the same data at its own, slower pace. Neither affects the other.
- Later, a bug is found in the analytics code. After a fix, that group resets its offsets to yesterday and reprocesses, which is possible because the log retains seven days of data.

## Common mistakes

- **Assuming global ordering** across partitions.
- **Too few partitions**, capping consumer parallelism, or **far too many**, increasing overhead and recovery time.
- **Treating Kafka as a database for arbitrary queries.** It is a log: reads are by offset, not by predicate.
- **Auto-committing offsets before processing**, losing messages on crash.
- **Ignoring duplicates** with at-least-once delivery; make consumers idempotent.
- **Putting a poor key choice on a hot value**, creating a hot partition.
