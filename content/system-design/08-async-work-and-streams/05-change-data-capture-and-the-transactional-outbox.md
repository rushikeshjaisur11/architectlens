---
title: "Change Data Capture and the Transactional Outbox"
short_title: "CDC and the Transactional Outbox"
tags: ["cdc", "outbox", "events", "consistency", "kafka", "dual-write"]
sources:
  - "Debezium documentation, 'Outbox Event Router' and change data capture architecture, debezium.io"
  - "Richardson, Microservices Patterns: 'Transactional outbox' and 'Transaction log tailing' (Manning, 2018)"
  - "Apache Kafka 4.0 release notes (March 2025), kafka.apache.org (KRaft-only; via search results October 2026)"
---

## The dual-write problem

A service must save an order to its database **and** tell other services about it (publish an event to a message broker). These are two different systems, and you cannot update both atomically. Consider the order of operations:

1. Write the database, then publish. If the process crashes between them, the order exists but no event is sent; downstream systems never learn of it.
2. Publish, then write the database. If the write fails, an event announces an order that does not exist.

Wrapping both in a distributed transaction (2PC) is possible but slow, fragile and unsupported by most brokers. The reliable alternative is to make the *database* the single source of truth for both facts.

## The transactional outbox

Add an **outbox table** in the same database as the business data. In **one local transaction**, the service writes the order row and inserts an event row into the outbox table. The transaction commits both or neither, so a state change and its event can never disagree. A separate process then reads the outbox and publishes each row to the broker, marking it sent.

```
BEGIN;
  INSERT INTO orders (...);
  INSERT INTO outbox (id, aggregate, type, payload, created_at) VALUES (...);
COMMIT;
```

The publisher can crash and restart at any time; unsent rows are still there. Delivery to the broker is therefore **at least once**: after a crash the same event may be published twice. Consumers must be **idempotent**, deduplicating on the event id.

## Change data capture (CDC)

Polling the outbox table works but adds load and latency. **Change data capture** reads the database's own **transaction log** (the write-ahead log, such as PostgreSQL's WAL or MySQL's binlog), which already records every committed change in order, and turns it into a stream of events. Tools such as **Debezium** run as connectors (commonly on Kafka Connect) that tail the log and publish row-level changes to topics, with low latency and no extra queries against tables.

CDC has two main uses:

- **Outbox relay.** Capture only the outbox table's inserts and route them to topics (Debezium provides an *outbox event router*), giving transactional publication without polling.
- **Database replication to other systems.** Stream changes into a search index, a cache, a data warehouse or a lakehouse, keeping them in sync without dual writes in application code.

Kafka's metadata layer now runs on its own Raft-based controllers (Kafka 4.0, March 2025, removed ZooKeeper entirely), which simplifies operating the broker that typically carries CDC streams.

## Design details that matter

- **Ordering**: events for one entity must stay in order; key messages by entity id so they land in one partition.
- **Schema evolution**: events outlive code versions; use a schema registry and compatible changes (add optional fields).
- **Initial snapshot**: when you attach CDC to an existing table, take a consistent snapshot first, then stream changes from the log position at that moment.
- **Deletes and tombstones**: represent deletions explicitly so consumers can remove data (also needed for erasure requests).
- **Outbox cleanup**: delete or archive published rows so the table does not grow forever.
- **Lag monitoring**: replication lag from the log to consumers is the key health metric.
- **Sensitive data**: CDC streams copy every column by default; filter or mask personal and secret fields before they reach shared topics.

## A worked example

An order service uses PostgreSQL and Kafka.

1. A checkout writes `orders` and `outbox` in one transaction (4 ms).
2. A Debezium connector tails the WAL, sees the new outbox row within about 50 ms and publishes `OrderPlaced` to `orders.events`, keyed by order id.
3. The connector crashes after publishing but before saving its log offset; on restart it republishes the same event.
4. The inventory service deduplicates by event id (it stores processed ids for 7 days), so stock is reserved once.
5. The same table's changes also feed a search index, with a consumer lag alert at 5 seconds.

## Common mistakes

- **Dual writes** (database then broker) with no outbox.
- **Assuming exactly-once delivery** and skipping consumer idempotency.
- **Publishing from inside the transaction** before it commits.
- **Streaming every column** into widely readable topics.
- **No snapshot plan**, so new consumers start with partial data.
- **Never cleaning the outbox.**
