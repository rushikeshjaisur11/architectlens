---
title: "Designing a Rate Limiter"
short_title: "Rate Limiter Design"
tags: ["rate-limiting", "service-design", "reliability"]
sources:
  - "Stripe engineering blog, posts on API rate limiting"
  - "Cloudflare Learning Center documentation on rate limiting algorithms"
---

## Why systems need rate limiting

A rate limiter caps how many requests a client (a user, an API key, an IP address) can make in a given time window, protecting a service from being overwhelmed — whether by a genuine traffic spike, a buggy client retrying too aggressively, or a deliberate abuse attempt. Without one, a single misbehaving client can degrade service for everyone else sharing the same backend capacity, since the system has no mechanism to distinguish "too much load from one source" from ordinary aggregate demand.

## Fixed window counter: simple, with a boundary problem

Count requests in fixed time windows (e.g., "max 100 requests per minute," where minutes are clock-aligned: 12:00:00-12:00:59, 12:01:00-12:01:59, and so on). Simple to implement and reason about, but has a real edge-case flaw: a client can send 100 requests in the last second of one window and another 100 in the first second of the next window — 200 requests in roughly two seconds, despite nominally being limited to 100/minute. The fixed window resets abruptly rather than continuously, and a burst timed around that boundary can exceed the intended rate by close to double.

## Sliding window: fixing the boundary problem

A **sliding window log** tracks the timestamp of every request in a rolling window (e.g., always checking "how many requests in the last 60 seconds, ending now," continuously, rather than clock-aligned buckets) — this eliminates the boundary-burst problem entirely, but requires storing a timestamp per request, which can be memory-intensive at high request volume.

A **sliding window counter** approximates this more cheaply: it keeps counts in the current and previous fixed windows, and estimates the sliding-window count as a weighted combination of the two based on how far into the current window the request falls (e.g., if 30% of the way through the current window, weight the previous window's count by 70% and add the current window's count). This gets most of the accuracy of a true sliding log at a fraction of the memory cost, and is the algorithm most production rate limiters (including Cloudflare's and many API gateways') actually use.

## Token bucket: allowing controlled bursts

A **token bucket** holds a capped number of tokens, refilled at a steady rate (e.g., 10 tokens/second, up to a max of 100). Each request consumes one token; a request with no tokens available is rejected or delayed. The key property distinguishing this from a pure rate-limited window: a client that hasn't made requests recently accumulates tokens up to the bucket's cap, letting it burst — spend all 100 tokens in a fraction of a second — before being throttled back to the steady refill rate. This models many real-world traffic patterns better than a hard uniform cap, since legitimate clients often have bursty, not uniform, request patterns (a page load triggering several API calls at once, followed by quiet periods).

**Leaky bucket** is the inverse framing: requests are added to a queue and processed at a strictly constant rate, smoothing bursts into a steady output stream rather than allowing them through — appropriate when the downstream system genuinely needs a steady request rate regardless of how bursty the input is, rather than when occasional legitimate bursts should be accommodated.

## Where the rate limiter's state actually lives

For a single server, an in-memory counter is enough. For a distributed system with multiple servers behind a load balancer, the rate limit needs to be enforced consistently across all of them — a client shouldn't be able to bypass a "100 requests/minute" limit just by having requests routed to different servers, each tracking its own independent count. This requires a shared, centralized store (commonly Redis, given its speed and native support for atomic increment operations) that all servers check against, rather than each server maintaining isolated local state.

This introduces its own tradeoff: the shared store becomes a dependency every rate-limited request now needs to check, adding latency and a new failure mode (what happens if the rate-limiter's own store is unavailable — fail open and allow all requests through, or fail closed and reject them, is a deliberate design decision, not an incidental detail).

## A worked example

**Scenario:** a public API needs to enforce a per-API-key limit of 1,000 requests/hour, while allowing legitimate short bursts (a client fetching a batch of related resources in quick succession) without unnecessarily throttling them.

- **Algorithm choice: token bucket**, with a refill rate matching the average (1,000/hour ≈ ~0.28 tokens/second) and a bucket capacity larger than the strict average-based rate (say, 50 tokens) — this lets a client that's been idle make a burst of up to 50 requests immediately, then settles into the steady long-run rate, rather than a hard per-second cap that would reject a legitimate short burst even though the client is well within its hourly budget overall.
- **Shared state**: token counts per API key are stored in Redis, using Redis's atomic `DECR`/`INCR` operations to avoid race conditions between concurrent requests from the same client hitting different backend servers simultaneously — without atomicity here, two nearly-simultaneous requests could both read "1 token remaining" and both proceed, silently allowing the limit to be exceeded.
- **Failure mode decision**: if Redis becomes unavailable, the system fails open (allows requests through, uncounted) rather than failing closed (rejecting all requests) — a deliberate choice reflecting that an outage in the rate limiter shouldn't take down the entire API's availability, accepting a temporary loss of rate-limiting protection as the lesser cost during that window.

## Common mistakes

- **Using a fixed window counter for a system where the burst-at-boundary flaw actually matters** (abuse prevention, cost control) without realizing the effective rate can be up to double the configured limit around window boundaries.
- **Building a distributed system's rate limiter with per-server local state**, letting clients trivially bypass the intended limit just by having requests land on different servers — a rate limit that isn't actually enforced consistently isn't providing the protection it's meant to.
- **Not deciding explicitly how the rate limiter should fail** when its own backing store is unavailable. Defaulting to "whatever the code happens to do" (which is often an unhandled exception, effectively failing closed and taking down the whole service) instead of a deliberate fail-open/fail-closed choice turns an availability question that should be a design decision into an accident.
