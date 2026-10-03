---
title: "Designing an LLM Gateway"
short_title: "LLM Gateway"
tags: ["gateway", "platform", "routing", "rate-limiting", "observability", "design"]
sources:
  - "Public documentation of open-source and commercial LLM gateway and proxy projects"
  - "Google SRE Book, chapters on handling overload and load balancing"
  - "Provider API documentation on rate limits, retries and streaming"
  - "Gateway comparisons and benchmarks, 2026 (secondary: dev.to, spheron.network, deepinspect.ai, requesty.ai)"
  - "MCP specification 2026-07-28 (header-based routing), blog.modelcontextprotocol.io (fetched Oct 2026)"
---

## The problem

A company has many teams calling several model providers directly. Each team handles keys, retries, logging, cost and safety differently, so spend is invisible, outages in one provider take down products, and sensitive data leaves in ways nobody reviewed. An **LLM gateway** is a single internal service in front of all model calls that centralises those concerns. It is the platform component that makes AI usage governable.

## Step 1: Requirements

- **Functional:** one API for many providers and models, streaming support, per-team keys and quotas.
- **Reliability:** fall back across providers when one is slow or down; retries without duplicate cost.
- **Governance:** usage and cost attribution per team and feature, audit logs, safety filters, data-handling policy.
- **Performance:** add very little latency (single-digit milliseconds) and never buffer streams.
- **Scale (example):** 3,000 requests per second, 200 million tokens per day, streaming responses.

## Step 2: Request flow

1. **Authenticate** the caller (service identity) and resolve its team, project and policies.
2. **Pre-checks:** rate limit and quota, request validation, PII redaction, prompt-injection and content filters where required.
3. **Cache lookup** for exact or semantic matches, scoped by tenant.
4. **Route** to a provider and model according to policy, health and cost.
5. **Call upstream** with timeouts, streaming the response back to the caller as it arrives.
6. **Post-processing:** response filters, token accounting, structured logging.

Keep the gateway **stateless**; state (quotas, cache, config) lives in fast shared stores so any instance can serve any request.

## Step 3: Routing and fallback

Routing rules map a logical model name (for example "fast-chat") to concrete provider models. Policies can choose by **cost, latency, region or capability**. Health tracking uses recent error rates and latencies per provider and model; a **circuit breaker** stops sending traffic to a failing target and probes it periodically. **Fallback chains** retry on a different provider for retryable failures (timeouts, 5xx, rate limits), and never for safety refusals or client errors. Because prompts differ in how they behave across models, fallback targets need to be evaluated for quality, not just availability.

## Step 4: Rate limiting and quotas

Providers limit **requests and tokens per minute**, so the gateway must meter both. Use token buckets per team and per provider key, with the token cost estimated up front (prompt tokens plus a maximum output) and reconciled after the response. Queue and prioritize rather than failing outright: interactive traffic gets priority over batch. Return clear 429s with retry hints when limits are hit. A **pool of provider keys** spreads load across rate-limit scopes.

## Step 5: Caching

- **Exact-match** cache on a hash of model, parameters and messages. Safe and effective for repeated prompts.
- **Semantic cache** on embedding similarity can lift hit rates but risks serving a wrong answer; use a high threshold, scope by tenant, and allow opt-in per route.
- Only cache **deterministic** requests (low temperature) and never responses containing user-specific private data unless the key includes the user.

## Step 6: Observability and cost

Emit a structured record per request: team, feature, model, prompt and completion tokens, latency (including time to first token), status, cache hit, fallback used and cost. Aggregate into dashboards and budgets with alerts on spend anomalies. Log prompts and responses **only where policy allows**, with redaction and retention limits. Propagate trace ids so a product trace shows the model call as a span.

## Step 7: Safety and governance

Central policy enforcement is the gateway's strongest benefit: PII detection, allow-lists of models per data classification, blocked providers per region for data residency, and consistent moderation. Version the policy configuration and roll it out like code, with review and rollback.

## Step 8: Streaming and failure details

Streams must pass through unbuffered; measure time to first token. If an upstream stream dies midway, the gateway cannot silently switch providers (the text already sent would be inconsistent), so surface a clean error and let the client retry. Idempotency keys and deduplication prevent double billing on client retries.

## A worked example

**Scenario:** the support team's service calls "chat-standard" during a provider outage.

1. The gateway authenticates the service and finds its quota: 200K tokens per minute, 80 percent used.
2. The prompt passes PII redaction (an email is masked). Exact cache misses.
3. Routing picks the primary provider, but its circuit breaker is open after error spikes, so the request goes to the secondary provider's equivalent model.
4. Tokens stream back with a time to first token of 420 ms. The log records the fallback and cost.
5. Dashboards show a spike in fallback rate; the on-call engineer sees the primary's status and decides to keep traffic on the secondary until it recovers, while a quality monitor confirms the secondary's answers still pass the evaluation set.

## Enterprise practice (verified October 2026)

**Basics.** One OpenAI-compatible endpoint in front of providers: auth, routing, retries, fallbacks, rate limits, budgets, logging (steps above).

**Landscape (secondary sources, October 2026).** **LiteLLM** (self-hosted, 100+ providers, virtual keys, per-team budgets, fallbacks) is the common open-source baseline; **Portkey** (250+ models, guardrails, prompt versioning, semantic caching; reported as now part of Palo Alto Networks); **Kong AI Gateway** and **Envoy AI Gateway** suit teams that already run those proxies on Kubernetes. Managed options come from the clouds.

**Numbers to treat carefully.** Reported added latency is roughly **4 to 20 ms** at p50 for the popular gateways, but one benchmark write-up warns that mock-upstream tests flatter results and another reports a single-worker Python proxy degrading badly at about 500 requests per second (p99 in the tens of seconds). LiteLLM's own June 2026 post reports about **7.5 ms** per request for the Python proxy and a Rust rewrite targeting far less. Lesson: load-test with realistic streaming responses, many concurrent connections and your real routing rules, and size gateway replicas separately from model capacity.

**Enterprise patterns.**

- **The gateway is the policy point.** Authenticate workloads, attach tenant and cost-centre tags, enforce budgets and rate limits, run guardrails, and log every call; agents' MCP traffic can use the same control plane since the 2026-07-28 MCP spec adds `Mcp-Method` and `Mcp-Name` headers for routing and metering without parsing bodies.
- **Fallback with care.** A provider fallback changes model behaviour; keep per-route prompts, run evaluation on the fallback model, and cap fallback spend.
- **Do not make the gateway a single point of failure:** stateless replicas, config as code, a bypass runbook, and streaming-safe timeouts.

## Common mistakes

- **Buffering streams** and destroying perceived latency.
- **Retrying non-retryable errors** or retrying without idempotency, doubling cost.
- **Failing over to a model never evaluated** for the prompt.
- **A global cache ignoring tenant and user**, leaking data.
- **Logging full prompts everywhere** without redaction and retention rules.
