---
title: "Designing a Multi-Channel Notification System"
short_title: "Designing a Notification System"
tags: ["notifications", "operations", "case-study"]
sources:
  - "System design interview practice materials (general pattern, synthesized from multiple public writeups)"
---

## Why notification systems are a genuinely distinct design problem

A notification system's job is to reliably deliver a message to a user across whichever channel is appropriate (push notification, email, SMS, in-app) — this pulls together async processing (per this track's message-queue lesson), rate limiting (per the rate-limiter lesson, applied to avoid overwhelming a user with too many notifications), and third-party integration reliability (per the production-reliability patterns from the AI-systems track's counterpart lesson, applied here to third-party notification providers rather than LLM providers specifically) into one coherent operational system.

## Step 1: Clarify requirements

- Functional: send notifications across multiple channels (push, email, SMS, in-app), support both individual and bulk (broadcast) notifications, respect user notification preferences (which channels, which notification types they've opted into), and avoid notifying a user excessively.
- Non-functional: high delivery reliability (notifications shouldn't silently get lost), reasonable delivery latency for time-sensitive notifications, and the ability to handle very large bulk sends (a broadcast to millions of users) without overwhelming downstream notification providers.

## Step 2: Decoupling notification requests from actual delivery

Any service in the broader system that needs to trigger a notification (an order-confirmation service, a social-activity service) shouldn't need to know the details of how delivery actually happens, or wait synchronously for delivery to complete — this is the same async-decoupling pattern from this track's message-queue and video-pipeline lessons. A notification request is published to a queue, and a separate pool of notification workers consumes from it, handling the actual channel-specific delivery — keeping the triggering service's request/response cycle fast and independent of notification delivery's potentially slower, less reliable downstream path (third-party push/email/SMS providers).

## Step 3: Channel selection and user preferences

Before actually sending, the system needs to determine which channel(s) a given notification should use, based on the user's stored preferences (which channels they've enabled, which notification categories they want) and the notification's own priority/type (a security alert might override a user's general "reduce notifications" preference, while a marketing notification should strictly respect opt-outs). This lookup happens per notification, checking a preferences store, and is a natural place to also apply the deduplication and rate-limiting logic from Step 4 before any actual delivery attempt is made.

## Step 4: Rate limiting and batching to avoid overwhelming users

Sending every individual event as a separate notification can overwhelm a user (dozens of individual "X liked your post" notifications in quick succession) and, separately, can overwhelm downstream notification providers if a burst of individual sends isn't managed. Two related techniques:

- **User-facing rate limiting/batching** — rather than sending each event as a separate notification immediately, related events within a short window are batched into a single notification ("5 people liked your post" instead of 5 separate notifications) — a product-quality concern as much as a systems one, directly analogous to the rate-limiter lesson's token-bucket reasoning but applied to notification *volume per user* rather than API request volume.
- **Provider-facing rate limiting** — outbound calls to third-party push/email/SMS providers respect those providers' own rate limits (per this track's rate-limiter lesson, applied here as a client-side constraint rather than a server the system itself exposes), using backoff and queuing to smooth bursts rather than firing requests faster than a provider will accept them.

## Step 5: Delivery reliability across third-party providers

Notification delivery depends on external providers (Apple/Google push services, email delivery services, SMS gateways) that can fail, rate-limit, or degrade independently of the notification system's own health — directly connecting to the hard-failure handling patterns (retries with backoff, circuit breakers) covered in this track's reliability-and-operations lesson, applied here to third-party notification providers as the "dependency" rather than an internal service. A failed delivery attempt is retried with backoff; a provider experiencing sustained failures trips a circuit breaker (per the reliability lesson) rather than continuing to send doomed requests, and — where a notification is genuinely important enough to warrant it — a fallback channel (SMS if push repeatedly fails, for instance) can be attempted instead of simply giving up after the primary channel's failures.

## Step 6: Handling very large broadcast sends

A notification to millions of users at once (a platform-wide announcement) needs different handling than a single targeted notification — fanning out millions of individual notification-worker tasks simultaneously would overwhelm the queue and downstream providers instantly. This connects to the fanout strategies from this track's realtime-and-feeds lesson: rather than a single event fanning out to millions of individual notification jobs all at once, broadcast sends are throttled and paced (processed in controlled batches over a longer window) so downstream provider rate limits and the notification workers' own capacity aren't overwhelmed by trying to deliver everything in the first few seconds.

## A worked example

**Scenario:** a social app sends both time-sensitive individual notifications (a direct message received) and occasional large broadcast notifications (a platform announcement to all users).

- **Individual notification**: the triggering event is queued, a worker checks the recipient's channel preferences, batches it with any other very-recent related events if applicable, and delivers via push notification (their preferred channel), with retry-with-backoff and circuit-breaker protection around the actual push-provider call, per Step 5.
- **Broadcast notification**: rather than queuing millions of individual notification jobs simultaneously, the send is deliberately paced — processed in controlled batches over a period (minutes, not seconds), respecting both the notification workers' processing capacity and the push provider's own rate limits, directly applying the fanout-pacing reasoning from Step 6 rather than treating a broadcast as just a very large number of individual sends fired all at once.

## Common mistakes

- **Sending notifications synchronously from the triggering service**, coupling that service's response time and reliability to the notification system's (often less reliable, third-party-dependent) delivery path — the async decoupling from Step 2 exists specifically to avoid this.
- **No batching for rapidly repeated related events**, producing a poor, overwhelming user experience (a flood of individual notifications) that a small amount of batching logic would prevent, independent of any actual technical delivery failure.
- **Treating a broadcast send the same as many individual sends fired simultaneously**, without pacing — this is a predictable way to overwhelm both internal queue capacity and external provider rate limits at exactly the moment a large, important announcement needs to go out reliably.
