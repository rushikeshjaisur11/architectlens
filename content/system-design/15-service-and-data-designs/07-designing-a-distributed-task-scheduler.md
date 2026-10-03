---
title: "Designing a Distributed Task Scheduler"
short_title: "Distributed Task Scheduler"
tags: ["scheduler", "queues", "workers", "reliability", "system-design"]
sources:
  - "Public documentation of task-queue systems such as Celery, Sidekiq and Amazon SQS (visibility timeout model)"
  - "Kleppmann, Designing Data-Intensive Applications (2017), chapters on batch processing and message brokers"
  - "Google SRE Book, chapter on distributed periodic scheduling"
predict:
  question: "A worker leases a task for 60 seconds, then crashes 10 seconds in without acknowledging. What happens?"
  options: ["The task is lost, because the worker removed it from the queue when it took it", "The task is retried immediately, because the scheduler detects the crash at once", "The lease expires at 60 seconds and the task becomes available to another worker"]
  answer: 2
  why: "A leased task is not removed; it is marked leased until its deadline. After expiry it returns to the queue, giving at-least-once execution."
check:
  - q: "Why must tasks be idempotent in this design?"
    options: ["Idempotency lets the scheduler skip leases and worker heartbeats entirely", "Exactly-once is achievable only when a dead-letter queue is present", "A lost ack can cause a rerun; exactly-once is unachievable across failures"]
    answer: 2
    why: "A worker may finish but its ack get lost, so the task runs again. Idempotency keys or upserts make the second run harmless."
  - q: "Why have long-running tasks heartbeat to extend their lease?"
    options: ["A slow healthy worker is not mistaken for a dead one", "Heartbeats make each task execute exactly once", "Heartbeats let failed tasks bypass the dead-letter queue"]
    answer: 0
    why: "Without heartbeats a slow worker's lease expires and another worker starts the same task. Heartbeats separate slow from dead."
  - q: "Why use separate priority queues rather than strict priority on one queue?"
    options: ["Strict priority makes high-priority work slower than separate queues", "A steady stream of urgent work could block lower priorities indefinitely", "Separate queues guarantee exactly-once delivery per priority"]
    answer: 1
    why: "Pure strict priority starves everything else. Workers poll high first but reserve some capacity for low."
---

## The problem

Applications need to run work **later, elsewhere, or reliably**: send a reminder in 24 hours, resize an uploaded image, retry a failed webhook, run a report. A task scheduler accepts those tasks, decides when each is due, hands them to workers, and guarantees they are not lost.

The requirements that shape the design:

- Tasks can be **immediate or delayed** (run at a specific time).
- Work must survive worker crashes and machine failures.
- Throughput can reach many thousands of tasks per second.
- Tasks have **priorities** and sometimes **dependencies**.
- A failed task is **retried** with limits, and persistently failing tasks are set aside for inspection.

## Core components

- **API / producers** — submit a task: payload, type, run-at time, priority, retry policy.
- **Task store** — durable record of every task and its state (pending, running, succeeded, failed, dead).
- **Scheduler / dispatcher** — finds tasks that are due and moves them to a ready queue.
- **Ready queues** — what workers pull from, usually one per priority or task type.
- **Workers** — stateless processes that pull a task, run it, and report the result.

## Handling delayed tasks

A million tasks scheduled for various times in the future cannot sit in a plain FIFO queue. Common approaches:

- **Time-indexed storage.** Store tasks in a database or sorted set keyed by run-at time. A scheduler repeatedly queries "tasks due before now", moves them to the ready queue, and marks them enqueued. An index on run-at time keeps the query cheap.
- **Time buckets.** Group tasks into buckets (for example one per minute). The scheduler loads only the current bucket, which limits memory and scan cost.
- **Timing wheels** for in-memory scheduling of very large numbers of short timers.

For tasks far in the future, keep them in durable storage and only pull them into memory shortly before they are due.

## At-least-once delivery and leases

The central reliability idea is the **lease** (also called a visibility timeout). When a worker takes a task, the task is not removed; it is marked as leased to that worker until a deadline. The worker must finish and acknowledge before the deadline. If it crashes or stalls, the lease expires and the task becomes available again for another worker.

This produces **at-least-once** execution: a task may run more than once, for example if a worker finishes but its acknowledgement is lost. Exactly-once is not achievable in general across failures, so tasks must be **idempotent** — safe to run twice. Typical techniques include an idempotency key checked before side effects, or writing results with an upsert.

Long tasks should **heartbeat** to extend their lease, so a slow but healthy worker is not mistaken for a dead one.

## Retries and dead letters

On failure, retry with **exponential backoff plus jitter** so a recovering dependency is not hit by a synchronized wave. Keep an attempt counter and a maximum. After the maximum, move the task to a **dead-letter queue** with its error history for human review rather than retrying forever or discarding it.

Distinguish retryable errors (timeouts, 503s) from permanent ones (validation failures), where retrying wastes capacity.

## Scaling and partitioning

- **Workers scale horizontally** and pull work, so adding capacity is just starting more of them. Pull-based consumption provides natural backpressure.
- **The store and scheduler** can be partitioned by task ID or tenant, with each scheduler instance owning a range of partitions. Use leader election or partition ownership so two schedulers do not enqueue the same due task. A uniqueness constraint or conditional update (mark as enqueued only if still pending) makes this safe even if both try.
- **Fairness.** One tenant flooding the queue can starve others. Use per-tenant queues or rate limits, and weighted dispatch.

## Priorities

Separate queues per priority, with workers polling high first but reserving some capacity for low, avoids starvation. Pure strict priority lets a steady stream of urgent work block everything else indefinitely.

## A worked example

**Scenario:** an e-commerce site schedules "abandoned cart" emails 2 hours after a cart is last updated.

- Each cart update creates or reschedules a task with run-at = now + 2 h and a deduplication key equal to the cart ID, so repeated updates replace the pending task instead of piling up.
- The scheduler wakes every second, queries for tasks with run-at before now and state pending, atomically flips them to enqueued, and pushes them to the `email` queue.
- A worker leases a task for 60 seconds, checks the cart is still unpurchased (a defensive check, since state may have changed), sends the email using the task ID as an idempotency key with the email provider, and acknowledges.
- If the provider returns 503, the task retries after 30 s, then 2 min, then 10 min with jitter; after five attempts it goes to the dead-letter queue and raises an alert.

## Common mistakes

- **Assuming exactly-once execution** and writing non-idempotent tasks.
- **No lease or heartbeat**, so a crashed worker's task is lost, or a slow worker's task is run twice concurrently.
- **Polling the whole task table** for due items without a time index.
- **Retrying instantly and forever**, amplifying outages.
- **One shared queue for everything**, letting a bulk job delay urgent work.
- **No dead-letter path**, so poisonous tasks block the queue or vanish.
