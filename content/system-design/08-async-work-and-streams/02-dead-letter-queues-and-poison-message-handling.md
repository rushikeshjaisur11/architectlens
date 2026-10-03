---
title: "Dead Letter Queues and Poison Message Handling"
short_title: "Dead Letter Queues"
tags: ["messaging", "queues", "async", "distributed-systems", "reliability"]
sources:
  - "AWS SQS documentation on dead-letter queues"
  - "Kafka documentation on error handling and DLQ patterns"
  - "Azure Service Bus documentation on dead-lettering"
banner:
  layout: line
  nodes:
    - [queue, "queue"]
    - [server, "consumer"]
    - [shield, "retries"]
    - [queue, "DLQ"]
predict:
  question: "An order consumer retries a record that references a nonexistent customer_id. Without a DLQ, what happens to the records behind it in the partition?"
  options: ["They are processed first, since Kafka reorders failed records", "They wait forever, since the failing record is retried each time", "They are dropped after the broker's redelivery limit is reached"]
  answer: 1
  why: "Kafka replays an uncommitted record on each poll, and ordered consumption means nothing behind it can proceed."
check:
  - q: "Why is Kafka's DLQ pattern implemented by the application rather than the broker?"
    options: ["Offset management is explicit, so retry policy is the consumer's responsibility", "Kafka brokers cannot store records that failed processing", "Kafka topics cannot be created dynamically for failed records"]
    answer: 0
    why: "Unlike SQS or Service Bus, Kafka has no redrive policy; the consumer publishes to a DLQ topic and commits the offset."
  - q: "What goes wrong if the retry threshold is set too low?"
    options: ["Poison messages block the queue for longer before being isolated", "Transient failures get dead-lettered and need manual intervention", "Alerting on DLQ depth stops working until the threshold is raised"]
    answer: 1
    why: "A brief downstream timeout could dead-letter a message that would have succeeded on retry."
  - q: "Why is a DLQ with no alerting 'functionally the same as data loss'?"
    options: ["Dead-lettered messages expire immediately unless someone replays them", "Messages in a DLQ cannot be replayed once the original topic moves on", "Failed messages pile up unnoticed until someone happens to look"]
    answer: 2
    why: "A DLQ only preserves messages usefully if someone is notified about its depth and reviews it."
---

## The poison message problem

A **poison message** is one that a consumer can never successfully process — malformed JSON, a schema mismatch, a reference to a deleted record, or a bug in the handler that throws on that specific payload every time. With at-least-once delivery (the realistic default for most queues), a failed message is normally redelivered for retry. That's correct behavior for transient failures — a downstream database being briefly unavailable, a timeout under load — but for a poison message, retrying is pointless: the same input produces the same failure, forever. Without a mechanism to break that cycle, the consumer keeps re-fetching, re-failing, and re-requeuing the same message, which for an ordered queue (a Kafka partition, an SQS FIFO group) **blocks every message behind it** since none can be processed out of order.

## What a dead-letter queue does

A **dead-letter queue (DLQ)** is a separate queue that a poison message gets moved to after it has failed processing a configured number of times, instead of being redelivered indefinitely to the main queue. This does two things: it unblocks the main queue (subsequent messages, or the rest of the ordered partition, can proceed), and it preserves the failed message somewhere inspectable rather than silently dropping it.

The redelivery threshold is a tunable, not a fixed constant — SQS calls it `maxReceiveCount`, Service Bus tracks a `DeliveryCount`, Kafka consumer frameworks (e.g., Spring Kafka, or a custom retry topic pattern) implement it as an application-level retry counter. Set too low, transient failures get dead-lettered prematurely; set too high, a genuinely poison message blocks the queue for longer before being isolated.

## Kafka's DLQ pattern is different from SQS's

SQS and Service Bus have **native DLQ support** — you attach a redrive policy to a queue, and the broker handles moving failed messages after the threshold. Kafka has no built-in DLQ concept: a Kafka consumer that fails to process a record and doesn't commit its offset will simply see that record again on the next poll, retrying indefinitely by default. The DLQ pattern in Kafka is implemented at the application or framework layer — the consumer catches the processing exception, publishes the failed record (often with the exception details and original metadata attached) to a separate `topic-name.DLQ` topic, and then commits the offset on the original topic so consumption can advance past it. This is a deliberate design choice in Kafka: offset management is explicit, so retry and dead-lettering policy is the consuming application's responsibility rather than the broker's.

## Handling messages once they're dead-lettered

A DLQ is not a place messages go to be forgotten — it needs a plan:

- **Alerting on DLQ depth.** A DLQ that's silently accumulating messages with no one watching it is equivalent to dropping them, just with extra steps. A non-zero or growing DLQ depth should page someone or at least surface on a dashboard.
- **Redrive/replay tooling.** Once the underlying bug or bad-data issue is fixed, messages in the DLQ need a way to be replayed back into the main processing path — SQS supports this natively (redrive from DLQ back to source queue); Kafka requires re-publishing DLQ records back to the original topic, typically via a small tool or script.
- **Retaining enough context to debug.** A DLQ message stripped down to just the raw payload is hard to diagnose. Attaching the failure reason, timestamp, retry count, and original headers at the point of dead-lettering turns the DLQ into a useful debugging log, not just a graveyard.

## A worked example

**Scenario:** an order-processing consumer reading from a Kafka topic occasionally receives an event referencing a `customer_id` that doesn't exist in the customer database (a data-quality bug upstream), and throws on every retry.

- The consumer catches the lookup failure, checks an in-memory or header-based retry count, and after 3 attempts, publishes the raw event plus the exception message and retry count to `orders.DLQ`, then commits the original offset so the partition can proceed.
- An alert fires when `orders.DLQ` consumer lag (effectively, queue depth) exceeds a small threshold, prompting investigation of the upstream data bug.
- Once fixed, a replay script re-publishes the DLQ's contents back to the `orders` topic with the corrected `customer_id`, letting them flow through the normal path.

## Common mistakes

- **No DLQ at all, relying on infinite retry.** A single bad message can stall an entire ordered partition or FIFO queue indefinitely, silently, until someone notices unrelated messages aren't being processed.
- **A DLQ with no alerting or review process.** Messages accumulate unnoticed, which is functionally the same as data loss until someone happens to look.
- **Setting the retry threshold too low**, dead-lettering messages that would have succeeded on a transient retry (e.g., a brief downstream timeout), turning recoverable failures into manual-intervention cases unnecessarily.
