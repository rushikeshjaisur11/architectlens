---
title: "Hot Partition Mitigation and Rebalancing"
short_title: "Hot Partition Mitigation"
tags: ["hot-partition", "nosql", "distributed-systems", "rebalancing"]
sources:
  - "AWS DynamoDB documentation, 'Best practices for designing and using partition keys'"
  - "AWS DynamoDB documentation, 'Adaptive capacity'"
  - "DeCandia et al., 'Dynamo: Amazon's Highly Available Key-value Store' (SOSP 2007)"
---

## What a hot partition actually is

Sharding distributes data across partitions assuming access is roughly uniform, but real traffic rarely is. A **hot partition** is a shard receiving disproportionate read or write load relative to its peers — even when data volume is evenly distributed. The distinction matters: hot partitions are a *traffic* skew problem, not necessarily a *storage* skew problem, so fixes that only rebalance data volume (like plain consistent hashing) don't automatically fix them.

## Why it happens

- **Low-cardinality or skewed partition keys.** A `status` field with values `active`/`inactive` gives you at most two partitions no matter how the system scales — this is the textbook DynamoDB anti-pattern. A `user_id` key is fine in aggregate but hot for celebrity accounts with millions of followers.
- **Temporal/sequential keys.** Partitioning by `date` or a monotonically increasing ID (including naive Snowflake-ordered IDs used as partition keys) concentrates all *current* writes on whichever partition owns "now," while older partitions sit idle — a pattern sometimes called the "write hotspot" in time-series workloads.
- **Celebrity/skewed key distribution.** Even a high-cardinality key like `user_id` goes hot if a small number of values (viral posts, popular products) dominate request volume — a power-law access pattern no amount of key cardinality alone fixes.

## Mitigation techniques

- **Key salting / sharding suffix.** Append a random or hashed suffix (e.g., `user123#7` where the suffix is `hash(request) % N`) to spread one logical key's writes across N physical partitions, then fan out reads across all N and merge. This is the standard DynamoDB-recommended fix for write-heavy hot keys — it trades read complexity for write distribution.
- **Composite partition keys.** Combine a coarse key with a finer one (e.g., `date` + `user_id`) so no single partition absorbs an entire day's or entire user's traffic.
- **Write buffering/batching in front of the hot key**, so bursts get absorbed by a queue or in-memory aggregator before hitting the partition, converting a spike into steady throughput.
- **Caching hot reads** at a layer in front of the partition (CDN, Redis, local cache) so read amplification from a hot key never reaches the underlying store at all.

## Adaptive capacity and online rebalancing

Static mitigation (salting, composite keys) requires anticipating hot keys at schema-design time. Managed systems increasingly do this reactively instead. DynamoDB's **adaptive capacity** monitors per-partition throughput and, without any user action or downtime, isolates a hot key's traffic onto dedicated throughput within the partition and can split a partition further if a single item continues to dominate it — up to per-item throughput limits that still apply regardless of table-level provisioning. Cassandra and Dynamo-style ring systems achieve a related effect through **virtual nodes** (covered in the consistent hashing lesson): because each physical node owns many small, scattered ring segments rather than one contiguous range, a temporal or skewed-key hotspot's load is more likely to land across many physical nodes rather than concentrating on one.

The general principle across both approaches: **decouple the unit of data distribution from the unit of physical placement.** Whether that's DynamoDB splitting an overloaded partition transparently or a ring system spreading vnodes, the system adds a layer of indirection between "logical partition" and "physical resource" specifically so rebalancing doesn't require a client-visible resharding event.

## Common mistakes

- **Choosing a partition key for read convenience (e.g., grouping all of one user's data together) without checking whether that user's access pattern is itself skewed.** Data-locality wins and hot-partition risk pull in opposite directions; the tradeoff needs to be explicit, not accidental.
- **Salting writes but forgetting reads must fan out to all N suffixes and merge results**, silently returning partial data or requiring the caller to know the salting scheme.
- **Assuming adaptive capacity or vnodes eliminates the need for key design.** These mechanisms mitigate hotspots after the fact and have limits (DynamoDB still enforces per-partition and per-item throughput ceilings); they are a safety net, not a substitute for choosing a high-cardinality, access-pattern-aware key up front.
