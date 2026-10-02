---
title: "Exactly-Once Processing Semantics"
short_title: "Exactly-Once Semantics"
tags: ["messaging", "async", "distributed-systems", "consistency", "kafka"]
sources:
  - "Kafka documentation on exactly-once semantics (transactions, idempotent producer)"
  - "Kleppmann, 'Designing Data-Intensive Applications' — exactly-once processing chapter"
  - "Google Cloud Dataflow documentation on exactly-once processing"
---

## Why "exactly-once delivery" is the wrong target

Across two independent systems connected by an unreliable network, **exactly-once delivery is provably unachievable** — this follows from the Two Generals' Problem: neither side can ever be perfectly certain the other received a message, because the acknowledgment itself can be lost. Any attempt to guarantee delivery in the presence of network failure has to fall back to retrying, and retrying inherently risks duplication. This is why every real "exactly-once" messaging system is, underneath, at-least-once delivery combined with a mechanism that makes duplicate delivery harmless. The achievable and useful goal is **exactly-once processing** (also called "effectively-once"): each message may be delivered more than once, but its effect on the system state is applied exactly once.

## The building blocks of exactly-once processing

- **Idempotent producers.** Kafka's idempotent producer (enabled via `enable.idempotence=true`) assigns each message a producer ID and sequence number; the broker deduplicates retries of the same message from the same producer session, so a network blip that causes a producer to resend doesn't create duplicate records on the topic. This solves duplication on the *write* side of a single stage.
- **Transactions across read-process-write.** Kafka's transactional API lets a consume-transform-produce application (read from topic A, do some work, write to topic B, and commit the consumer offset) do all three atomically — either all of it is visible downstream or none of it is, even across a crash mid-processing. This is what Kafka Streams uses internally to provide exactly-once semantics for stream processing topologies.
- **Idempotent consumers / deduplication.** Where transactions aren't available (writing to an external database, calling a third-party API), the consumer itself enforces idempotency: each message carries a unique ID, and the consumer checks a dedup store (a unique constraint on an `event_id` column, a Redis SET, a processed-IDs table written in the same transaction as the business effect) before applying the effect, so a redelivered message is a safe no-op.

## Exactly-once is a property of a pipeline, not a single hop

A common misunderstanding is treating exactly-once as a flag you turn on for a queue. In practice it has to hold end-to-end across every hop: producer-to-broker, broker-to-consumer, and consumer-to-external-side-effect (a database write, an email send, a payment charge). Kafka's transactional guarantees cover the Kafka-internal hops (produce, and consume-transform-produce within Kafka), but the moment a consumer's output leaves Kafka for a system that doesn't participate in that transaction — an HTTP call to a payment provider, for instance — the guarantee breaks unless that external write is made idempotent separately. Google Cloud Dataflow's model makes this explicit by distinguishing exactly-once *processing* (guaranteed within the pipeline) from exactly-once *effects*, which still require idempotent sinks for genuinely external side effects.

## Cost and when to skip it

Exactly-once machinery isn't free: Kafka transactions add coordination overhead and latency (the transaction coordinator, commit markers written to the log, consumers configured to read only committed data), and idempotency stores add a read-and-write per message. For data where an occasional duplicate is harmless or self-correcting — a metrics counter that's periodically resynced from a source of truth, a "user viewed page" analytics event — at-least-once with no dedup is often the right tradeoff, because the operational cost of full exactly-once isn't buying anything the use case actually needs.

## A worked example

**Scenario:** a Kafka Streams application reads payment-charge events from topic `charges`, aggregates a running balance per customer, and writes the updated balance to topic `balances`, which a downstream service uses to actually debit the customer.

- Kafka Streams is configured with `processing.guarantee=exactly_once_v2`, so the read-aggregate-write-commit cycle for each input record is wrapped in a transaction — a crash mid-batch rolls back the whole step rather than leaving a partial aggregate applied while the input offset is marked consumed.
- The downstream debit service, reading from `balances`, is a hop outside that transaction boundary — so it separately enforces idempotency using a unique `balance_update_id` on each record, rejecting (or no-op'ing) an update it has already applied, since Kafka's guarantee alone doesn't extend to this external system.

## Common mistakes

- **Assuming "exactly-once" configuration on the broker covers external side effects.** Kafka transactions guarantee exactly-once *within* Kafka; a consumer that calls an external API or writes to an external database as a side effect still needs its own idempotency for that hop.
- **Paying the coordination cost of exactly-once for data where duplicates are harmless.** This adds latency and operational complexity (transaction timeouts, coordinator failures) for no correctness benefit.
- **Confusing "idempotent producer" with full exactly-once processing.** The idempotent producer only deduplicates a single producer's retries at the broker; it says nothing about whether the consumer's downstream effect is applied more than once.
