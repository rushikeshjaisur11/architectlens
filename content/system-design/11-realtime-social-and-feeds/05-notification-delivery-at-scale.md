---
title: "Notification Delivery at Scale: Push, Email, SMS Fanout and Deduplication"
short_title: "Notification Delivery"
tags: ["notifications", "push", "fanout", "system-design", "real-time"]
sources:
  - "Firebase Cloud Messaging (FCM) official documentation (firebase.google.com/docs/cloud-messaging)"
  - "Apple Push Notification service (APNs) documentation (developer.apple.com/documentation/usernotifications)"
  - "Uber Engineering — \"Scaling Notifications\" blog posts (uber.com/blog/engineering)"
banner:
  layout: line
  nodes:
    - [server, "event"]
    - [queue, "queue"]
    - [server, "provider"]
    - [phone, "device"]
predict:
  question: "Idempotency keys like like:{post_id}:{user_id} are in place, but there is no coalescing. Five different users like a post within a minute. How many pushes does the owner get?"
  options: ["One push, since all five keys refer to the same post", "Five pushes, since each like has a distinct key", "Zero pushes, since the duplicates are all dropped"]
  answer: 1
  why: "Keys only dedupe the same event; five different likes are five valid events, so coalescing is needed to merge them."
check:
  - q: "Why publish notification events to a queue instead of calling FCM or APNs directly from the request path?"
    options: ["Provider latency and rate limits should not block the action that triggered the event", "FCM and APNs reject any call that arrives from a user request path", "A queue removes the need to store device tokens for each user"]
    answer: 0
    why: "Decoupling keeps provider outages and limits from blocking the producing service."
  - q: "What happens if 'unregistered token' responses from FCM or APNs are ignored?"
    options: ["FCM deletes dead tokens automatically, so nothing changes", "Sends to live devices get rejected until every token is reset", "A growing share of sends silently fail against dead tokens"]
    answer: 2
    why: "Tokens rotate and expire, so the token table rots without cleanup."
  - q: "Why need both idempotency keys and product-level coalescing?"
    options: ["Keys group five likes into one message, making coalescing a repeated step", "Keys stop one event firing twice; coalescing tames many distinct events", "Coalescing prevents queue redelivery, while keys only reduce user noise"]
    answer: 1
    why: "They solve different problems: retries duplicating one event versus a storm of separate events."
---

## The multi-channel fanout problem

A single event — someone likes your post, a payment fails, a flight is delayed — can need delivery across **push** (mobile OS notification), **email**, **SMS**, and in-app channels, each with different latency, cost, and reliability characteristics. A **notification service** sits between the event source (the system that knows something happened) and these channels, deciding what to send, where, and whether to send it at all.

The architecture is almost always event-driven: producers publish a notification event to a queue (Kafka, SQS, Pub/Sub) rather than calling delivery APIs directly. This decouples "something happened" from "how it gets delivered," which matters because delivery involves per-channel rate limits, retries, and provider outages that shouldn't block the producing service.

## Push delivery: FCM and APNs

Mobile push has two dominant delivery paths: **Firebase Cloud Messaging (FCM)** for Android (and cross-platform) and **Apple Push Notification service (APNs)** for iOS. Both work the same way structurally: the app registers a **device token** with the OS-level push service, sends that token to your backend, and your backend hands a message plus the token to FCM/APNs, which maintains the actual persistent connection to the device and handles final delivery.

This means your notification service never talks to the phone directly — it talks to FCM or APNs, which absorbs the hard problem (holding millions of long-lived device connections) that you'd otherwise have to build yourself, similar in spirit to why WebSocket fanout for feeds gets delegated to specialized gateway layers. Device tokens **rotate and expire** — apps reinstall, users switch devices — so a production system must handle token-invalid responses from FCM/APNs by removing stale tokens, or delivery rates quietly degrade over time as the token table rots.

## Fanout at write time vs. read time

For a notification triggered by one user's action affecting many recipients (an announcement to a 500-person channel, a viral post's likes), the same fanout trade-off from feed systems applies:

- **Fanout-on-write**: enqueue an individual delivery job per recipient at event time. Simple to reason about, but a single event can explode into millions of jobs for a large audience — the same "celebrity problem" that news feed fanout hits.
- **Batched/grouped delivery**: for high-fanout events, group recipients and send in provider-side batches (FCM supports multicast sends to up to 500 tokens per request) rather than one job per user, cutting request volume by orders of magnitude.

## Deduplication

Because notification pipelines involve retries (a queue redelivery, a producer double-publish, a client reconnect replaying missed events), the same logical notification can be generated more than once. Sending "you have a new like" three times for one like is a correctness bug, not just an annoyance.

The standard fix is an **idempotency key** — a deterministic identifier derived from the triggering event (e.g., `like:{post_id}:{user_id}`) — checked against a short-lived dedup store (Redis with a TTL matching the retry window) before a delivery job is enqueued. If the key was already seen, the duplicate is dropped. This is the same idempotency pattern used for payment processing and message queues generally: at-least-once delivery at the transport layer, deduplicated to effectively-once at the application layer.

A second, product-level layer of deduplication **coalesces** semantically related notifications: five people liking your post within a minute becomes one "Alice and 4 others liked your post" notification instead of five pushes. This isn't just about reducing noise — undeduplicated high-frequency events (a popular post getting hundreds of likes) can otherwise generate a notification storm that overwhelms both the delivery pipeline and the user.

## Common mistakes

- **Calling FCM/APNs synchronously from the request path that triggered the event.** Push provider latency and rate limits shouldn't block the action that caused the notification (e.g., the like itself); always go through a queue.
- **Not handling stale device tokens.** Ignoring "unregistered token" responses from FCM/APNs leaves a growing fraction of push sends silently failing against dead tokens.
- **Deduplicating only at the transport layer.** Idempotency keys prevent the *same* event from firing twice, but without product-level coalescing, *different* events (five separate likes) still produce a flood of individually correct but collectively excessive notifications.
