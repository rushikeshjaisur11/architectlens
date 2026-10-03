---
title: "Long-Running Operations and Async API Design"
short_title: "Async API Design"
tags: ["async-api", "webhooks", "polling", "system-design", "api-design"]
sources:
  - "Stripe API documentation — webhooks and async endpoints"
  - "Google AIP-151 — Long-running operations (google.aip.dev)"
  - "AWS API Gateway documentation — async invocation patterns"
---

## Why synchronous request/response breaks down

A plain REST call assumes the server can produce a result before the client's connection times out — fine for a database lookup, wrong for a video transcode, a bulk export, or an ML training job that takes minutes to hours. Holding an HTTP connection open for that long wastes a thread/connection per in-flight request, fights against typical gateway and load-balancer timeouts (usually 30-60s), and gives the client no way to recover from a dropped connection without redoing the whole operation. Long-running operations need a different contract: **kick off the work, return immediately, let the client learn about completion separately.**

## Pattern 1: polling

The client submits a request; the server immediately returns `202 Accepted` with a resource URL (or operation ID) representing the in-progress job. The client then repeatedly `GET`s that URL until the status flips to `completed` or `failed`.

```
POST /v1/exports          -> 202 Accepted, Location: /v1/exports/abc123
GET  /v1/exports/abc123    -> { "status": "running", "progress": 0.4 }
GET  /v1/exports/abc123    -> { "status": "completed", "result_url": "..." }
```

Google's API Improvement Proposal AIP-151 formalizes this as the **Operation resource** pattern: a long-running call returns an `Operation` object with `name`, `done`, and either `error` or `response` once finished — the same shape whether polled or watched, which is why it's the dominant convention across gRPC and REST APIs alike.

- **Pros**: simple, works through any firewall/proxy since it's just repeated GETs, client controls its own retry/backoff behavior, no inbound connectivity required on the client side.
- **Cons**: wastes requests when polling faster than necessary, and adds latency to completion detection equal to the polling interval. Naive fixed-interval polling from many clients can itself become a load spike; production clients should poll with exponential backoff or respect a server-suggested interval (`Retry-After` header works here too).

## Pattern 2: webhooks

Instead of the client asking "are you done yet," the server calls the client back when the result is ready. The client registers a callback URL in advance (via dashboard config or an API call); on completion, the server sends an HTTP `POST` to that URL with the result or a reference to it. Stripe, GitHub, and most payment/webhook-heavy platforms use this for events that can happen at unpredictable times (a payment settling, a PR being merged) rather than for a single request's completion.

Webhooks introduce problems polling doesn't have, all of which need explicit handling:

- **Delivery isn't guaranteed.** The receiving endpoint might be down; sender-side retry with exponential backoff is standard, but the receiver must be idempotent (see the companion lesson on idempotency) because retries mean the same event can arrive more than once.
- **Authenticity must be verified.** Anyone who discovers the callback URL can POST fake events to it. The standard mitigation is a signed payload — Stripe signs webhook bodies with an HMAC-SHA256 signature in a header (`Stripe-Signature`), which the receiver recomputes and compares before trusting the payload.
- **Ordering isn't guaranteed** across retries and concurrent events; receivers that assume events arrive in the order they occurred will occasionally be wrong.
- **The client needs a public, reachable endpoint** — a nonstarter for a mobile app or a client behind NAT without its own infrastructure, which is part of why webhooks are a server-to-server pattern, not a client-facing one.

## Pattern 3: callbacks within a synchronous-feeling flow

A hybrid used heavily in chat/streaming UIs and job queues: the client opens a **long-lived connection** (Server-Sent Events, WebSocket, or gRPC streaming) instead of polling, and the server pushes status updates or partial results down that connection as they happen. This gets webhook-like low latency without requiring the client to expose a public endpoint — the connection is client-initiated, so it works through NAT/firewalls like polling does, but avoids polling's wasted round trips. The cost is holding a connection open per client, which is a different (and generally more scalable, given connection multiplexing) resource cost than holding a request thread open.

## Choosing among them

- Client can't receive inbound requests (mobile, browser, NAT'd service) → **polling** or a **streaming connection**.
- Server-to-server, event can fire at any time, receiver has stable infrastructure → **webhooks**.
- Need near-real-time updates without exposing an endpoint → **SSE/WebSocket push**.

## Common mistakes

- **Polling with a fixed short interval and no backoff**, turning a completion check into a self-inflicted load spike as job volume grows.
- **Webhook receivers that aren't idempotent**, double-processing a retried delivery (e.g., fulfilling an order twice).
- **Trusting webhook payloads without verifying the signature**, letting anyone who learns the URL inject fabricated events.
- **No operation status endpoint at all** — firing an async job with only a webhook and no way for the client to check status directly leaves them stuck if the webhook delivery fails silently.
