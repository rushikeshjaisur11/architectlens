---
title: "Message Queues and Delivery Guarantees"
short_title: "Message Queues and Delivery"
tags: ["messaging", "queues", "async", "distributed-systems"]
sources:
  - "Kafka documentation on delivery semantics"
  - "AWS SQS documentation on at-least-once delivery and idempotency"
  - "Apache Kafka KIP-932 'Queues for Kafka' and Kafka 4.1 release notes (via search results, October 2026)"
banner:
  layout: line
  nodes:
    - [server, "producer"]
    - [queue, "broker"]
    - [server, "consumer"]
    - [shield, "ack"]
predict:
  question: "Payment events for customer A and customer B are sent to a topic partitioned by customer_id. Consumer retries make a refund for A arrive twice. What is guaranteed?"
  options: ["Order within A's partition holds, and B's events may run in parallel", "Order across all customers holds, but A's refund can be skipped", "Neither order nor delivery is guaranteed across customers or within A"]
  answer: 0
  why: "A shared partition key keeps one customer's events ordered while different keys process in parallel; the duplicate still needs idempotency."
check:
  - q: "Why is at-least-once delivery the most common guarantee in practice?"
    options: ["It prevents duplicates by recording each message in a processed table", "It is achievable without expensive coordination, but pushes duplicate handling to consumers", "It is cheaper because consumers never need to acknowledge messages"]
    answer: 1
    why: "Redelivery after a missed ack is cheap for the queue, so consumers must tolerate duplicates."
  - q: "Why is 'increment balance by $10' a risk under at-least-once delivery while 'set status to active' is not?"
    options: ["Increments run out of order, while status updates keep their order", "Status updates are idempotent; a redelivered increment would apply twice", "Increments are rejected by queues that advertise exactly-once delivery"]
    answer: 1
    why: "Naturally idempotent operations are safe to repeat; the increment needs an idempotency key."
  - q: "What happens to an ordered partition if one malformed message has no dead-letter handling?"
    options: ["The consumer skips it after one failed attempt and continues", "Only that message is lost, and later messages are unaffected", "The consumer keeps retrying it and blocks everything behind it"]
    answer: 2
    why: "In an ordered stream nothing behind the failing message can be processed, so retries stall the whole partition."
---

## Why decouple with a queue at all

A message queue sits between a producer (something creating work) and a consumer (something processing it), letting them operate independently instead of the producer calling the consumer directly. This buys three things a direct call doesn't: the producer isn't blocked waiting for processing to finish, a slow or temporarily-down consumer doesn't take the producer down with it, and load can be smoothed — a burst of 10,000 incoming requests can be queued and processed at a steady rate instead of overwhelming downstream systems all at once.

The cost is complexity: a direct function call either succeeds or throws, immediately, and you know which. A queued message might be delivered once, more than once, or (in some failure modes) not at all — and reasoning about which of those your system actually needs, and handles correctly, is the core design problem here.

## The three delivery guarantees

- **At-most-once** — a message is delivered zero or one times; if something fails after it's sent but before it's confirmed processed, it's simply lost. Rarely desirable on its own, but sometimes an acceptable tradeoff for high-frequency, loss-tolerant data (e.g., a metrics data point where losing an occasional sample doesn't matter).
- **At-least-once** — a message is guaranteed to be delivered, but might be delivered more than once (e.g., the consumer processes it, crashes before acknowledging, and the queue redelivers it to be safe). This is the most common guarantee in practice, because it's achievable without expensive coordination — but it pushes the responsibility for handling duplicates onto the consumer.
- **Exactly-once** — a message is delivered and processed exactly one time, no duplicates, no loss. This is what people actually want intuitively, but it's expensive or, across truly independent systems, sometimes provably impossible to guarantee end-to-end without extra coordination — most "exactly-once" systems actually provide at-least-once delivery plus idempotent processing, which achieves the same observable effect without the theoretical cost of true exactly-once semantics.

<div data-anim="delivery-guarantees"></div>

## Idempotency: the practical answer to "exactly-once"

Since at-least-once delivery is the realistic default, the standard solution is to make message *processing* idempotent — applying the same message twice produces the same result as applying it once. This turns "the queue might redeliver" from a correctness problem into a non-issue.

Common techniques:

- **Idempotency keys** — each message carries a unique ID; the consumer checks (in a database, typically) whether that ID has already been processed before acting on it, and skips (or safely no-ops) if so.
- **Natural idempotency in the operation itself** — "set user's status to active" is naturally idempotent (running it twice has the same effect as once); "increment user's balance by $10" is not (running it twice doubles the effect) unless paired with an idempotency key that prevents the second increment from applying.

Idempotency needs to be designed deliberately into the consumer — it's not something a message queue provides automatically, regardless of the delivery guarantee it advertises.

## Ordering: another guarantee that isn't free

Many queues (plain SQS standard queues, for instance) don't guarantee message order across the whole queue — messages can be processed out of the order they were sent, especially under retries or parallel consumers. If your system depends on ordering (e.g., "user's address update" must be processed before "order placed using that address"), you need a queue that explicitly supports it — often via a **partition key**: messages with the same key (e.g., the same user ID) are guaranteed to stay in order relative to each other, while messages with different keys can be processed in parallel across partitions, giving ordering where it matters without sacrificing all parallelism.

Kafka's partitioning model is a common example: ordering is guaranteed within a partition, not across the whole topic, and producers choose the partition key deliberately based on what ordering guarantee the application actually needs.

## A worked example

**Scenario:** an order-processing pipeline where "payment charged" events must be processed in order per customer (so a refund event never gets applied before its corresponding charge event, for the same customer), but different customers' events can process fully in parallel.

- **Queue choice**: a partitioned queue (Kafka, or SQS FIFO with per-customer message groups) using `customer_id` as the partition/group key — guarantees ordering within a customer's event stream while letting different customers' events flow through independent partitions concurrently.
- **Delivery guarantee**: at-least-once (the realistic default), paired with an idempotency key on each event (a unique event ID stored in a processed-events table, checked before applying any charge/refund) — so a redelivered "payment charged" event after a consumer crash doesn't double-charge the customer.
- **Failure handling**: a dead-letter queue captures events that fail processing repeatedly (e.g., malformed data), so they don't block the rest of that customer's ordered stream indefinitely while still being available for manual investigation.

## Current practice (verified October 2026)

The boundary between logs and queues is blurring: Kafka's share groups (KIP-932, preview in 4.1) add per-message acknowledgement and redelivery to a partitioned log, covering workloads previously sent to RabbitMQ or SQS. The delivery-guarantee rules do not change: at-least-once delivery plus idempotent consumers is the dependable default; use the transactional outbox for publishing from a database.

## Common mistakes

- **Assuming "the queue guarantees exactly-once" and skipping idempotency in the consumer.** Most systems that advertise this are really providing at-least-once plus some assistance toward idempotency (deduplication windows, for instance) — not a hard guarantee under all failure modes, and relying on the label instead of verifying the actual mechanism is a common source of duplicate-processing bugs.
- **Using a queue without ordering guarantees for data that requires strict ordering**, and only discovering it under load or retries, when out-of-order delivery finally becomes likely enough to observe.
- **No dead-letter handling for repeatedly-failing messages.** Without one, a single malformed or unprocessable message can block an entire ordered partition/queue behind it indefinitely, since the consumer keeps retrying and failing the same message before it can move on.
