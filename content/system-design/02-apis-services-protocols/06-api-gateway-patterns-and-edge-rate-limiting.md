---
title: "API Gateway Patterns and Edge Rate Limiting"
short_title: "API Gateways & Rate Limiting"
tags: ["api-gateway", "rate-limiting", "system-design", "edge"]
sources:
  - "Kong Gateway documentation (docs.konghq.com)"
  - "Envoy Proxy documentation (envoyproxy.io) — rate limit filter"
  - "NGINX rate limiting docs (nginx.org)"
  - "Stripe API rate limits documentation"
  - "MCP specification 2026-07-28 release notes, blog.modelcontextprotocol.io (fetched October 2026)"
banner:
  layout: fan
  nodes:
    - [lb, "gateway"]
    - [client, "client"]
    - [shield, "auth + limits"]
    - [server, "services"]
predict:
  question: "A fixed-window limit of 100 per minute resets at :00. A client sends 100 requests at 11:59:59 and 100 more at 12:00:00. What happens?"
  options: ["The second batch is rejected, because the limit is 100 per minute", "Both batches pass, giving a 2x burst across the window boundary", "Half of the second batch passes, since the windows are averaged"]
  answer: 1
  why: "Fixed windows reset sharply, so a client can burst 2x the limit around the boundary."
check:
  - q: "Why does a per-instance in-memory counter break rate limits on a scaled gateway?"
    options: ["Memory counters reset on every request, so no limit is ever enforced", "In-memory counters add enough latency that the gateway times out", "A client hitting N gateway pods gets N times the limit, so a shared store is needed"]
    answer: 2
    why: "Without a shared store such as Redis, horizontal scaling silently multiplies the effective limit."
  - q: "Which fits a public API, and which fits protecting a fixed-capacity worker pool?"
    options: ["Token bucket allows short bursts for public APIs; leaky bucket smooths load for a worker pool", "Leaky bucket allows bursts for public APIs; token bucket smooths load for a worker pool", "Both behave identically, since each rejects traffic only when its bucket is empty"]
    answer: 0
    why: "Token bucket spends accumulated tokens on bursts; leaky bucket drains at a constant rate to protect downstream stability."
  - q: "Why is IP-only rate limiting weak?"
    options: ["The gateway cannot read client IPs, so counting by IP is impossible", "Users behind NAT are throttled together, yet distributed attackers still evade it", "IP limits cost more memory than API-key limits because addresses are longer"]
    answer: 1
    why: "NAT and carrier CGNAT put many real users behind one IP, while a distributed attacker spreads across many."
---

## Why a gateway sits in front of everything

A microservice architecture without a gateway forces every client to know the address of every service, handle auth for each one separately, and absorb the blast radius of a slow downstream dependency directly. An **API gateway** (Kong, Envoy, AWS API Gateway, NGINX) is a reverse proxy purpose-built for this: it terminates client connections, applies cross-cutting policy once, and routes to the right backend. The alternative — pushing auth, rate limiting, and TLS termination into every service — means N implementations of the same logic, each one a chance to get it wrong.

The core responsibilities a gateway centralizes:

- **Routing** — path/host-based dispatch to the correct upstream service, often with weighted traffic splitting for canary releases.
- **AuthN termination** — validating API keys, JWTs, or mTLS certs at the edge so backend services trust an already-authenticated request (see the companion lesson on AuthN/AuthZ).
- **Rate limiting and quota enforcement** — the focus of this lesson.
- **Observability** — a single place to emit consistent request logs, latency histograms, and error rates across every service behind it.
- **Protocol translation** — e.g., REST-in/gRPC-out, common in gateways fronting internal gRPC meshes.

A gateway is distinct from a **service mesh sidecar** (Envoy in Istio, Linkerd): the gateway sits at the edge, handling north-south traffic (client-to-cluster); a mesh handles east-west traffic (service-to-service) inside the cluster. Many production systems run both — Envoy is popular for either role because the same data plane binary can serve as edge gateway or mesh sidecar.

## Rate limiting algorithms

Rate limiting exists to protect backends from being overwhelmed and to enforce fair usage across tenants. The algorithm choice matters because naive implementations either burst too aggressively or throttle too smoothly to be useful.

- **Fixed window counter.** Count requests per client in discrete windows (e.g., 100/minute, reset at :00). Cheap (one counter per window), but allows a 2x burst at window boundaries — a client can send 100 requests at 11:59:59 and another 100 at 12:00:00.
- **Sliding window log.** Store a timestamp per request and count how many fall within the trailing window. Accurate, but memory cost scales with request volume per client.
- **Sliding window counter.** A weighted average of the current and previous fixed windows — approximates the sliding log at fixed-window cost. This is what NGINX's `limit_req` and most production gateways actually implement.
- **Token bucket.** A bucket holds up to N tokens, refilled at a fixed rate; each request consumes one token, and requests are rejected when the bucket is empty. This is the standard choice because it naturally allows short bursts (spend accumulated tokens) while enforcing a long-run average rate — Stripe, GitHub, and most public APIs document their limits in these terms.
- **Leaky bucket.** Requests queue and drain at a constant rate, smoothing bursts entirely rather than allowing them — used when the concern is downstream stability (e.g., protecting a fixed-capacity worker pool) rather than fairness.

Envoy's rate limit filter and Kong's rate-limiting plugin both implement token-bucket-style algorithms, typically backed by Redis so limits are enforced consistently across a horizontally scaled fleet of gateway instances — a per-instance in-memory counter would let a client get N× the limit by hitting N different gateway pods.

## Enforcing limits fairly: keys and tiers

A rate limit needs a **key** to count against — per-API-key, per-IP, per-user, or per-tenant. IP-based limiting is the weakest (NAT and shared proxies put many real users behind one IP) and easiest to bypass; API-key or authenticated-identity-based limiting is standard for anything beyond basic abuse protection. Production APIs commonly layer both: a coarse IP-based limit as an anti-DoS backstop, and a precise per-key quota for billing-tier enforcement (free tier: 100 req/min; paid tier: 10,000 req/min).

Clients need feedback to back off correctly. The convention, though not a single binding RFC, is:
- `429 Too Many Requests` status code (defined in RFC 6585).
- `Retry-After` header telling the client when to retry.
- `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers (de facto standard, used by GitHub, Stripe, Twitter) so well-behaved clients can self-throttle before hitting the wall.

## Current practice (verified October 2026)

Gateways now also front AI traffic. LLM gateways add per-key budgets, token-based rate limits, fallbacks and guardrails, and MCP's 2026-07-28 revision adds `Mcp-Method` and `Mcp-Name` request headers so a gateway or WAF can route, meter and authorise agent tool calls without parsing JSON bodies. Rate limits for model traffic should count tokens as well as requests.

## Common mistakes

- **Rate limiting per gateway instance instead of globally.** Without a shared store (Redis, or a distributed counter), horizontal scaling of the gateway silently multiplies the effective limit.
- **Using IP as the only key.** Punishes every user behind a corporate NAT or mobile carrier CGNAT range collectively, while doing little against a distributed attacker.
- **No `Retry-After` header.** Forces clients to guess a backoff interval, which usually means either hammering the API immediately or backing off far more than necessary.
- **Conflating the gateway with the service mesh.** Putting business logic (request transformation beyond simple routing, complex retries) in the gateway couples deployment of that logic to gateway upgrades, and makes the edge a single point of coupling for every backend team.
