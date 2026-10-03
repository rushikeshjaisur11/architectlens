---
title: "Handling LLM Failures in Production"
short_title: "Handling LLM Failures"
tags: ["reliability", "production", "llm", "failure-handling"]
sources:
  - "OpenAI and Anthropic API documentation on rate limits, retries, and error handling"
  - "Google SRE Book, chapters on graceful degradation and reliability patterns (applicable to LLM-dependent systems)"
  - "Amazon Builders' Library, 'Using load shedding to avoid overload' and 'Timeouts, retries and backoff with jitter'"
  - "Amazon Bedrock documentation on Guardrails streaming (docs.aws.amazon.com)"
banner:
  layout: line
  nodes:
    - [user, "request"]
    - [server, "retry"]
    - [cache, "fallback"]
    - [doc, "safe reply"]
predict:
  question: "A product-description call returns HTTP 200 but fails schema validation, and the corrective retry also fails. What should happen next?"
  options: ["Fall back to a template-based, non-LLM description", "Show a user-facing error, since the retry already failed", "Retry the same prompt until validation passes"]
  answer: 0
  why: "A feature that must always show output should degrade to a simpler default rather than break or loop."
check:
  - q: "Why track p99 latency instead of only the average for LLM calls?"
    options: ["Rare very slow requests hurt users yet barely move an average", "Averages cannot be computed for streaming LLM responses", "p99 matters only when the provider is fully down"]
    answer: 0
    why: "LLM latency varies widely, so tail percentiles reveal user pain that averages hide."
  - q: "Why is retrying immediately after a rate-limit error a mistake?"
    options: ["It succeeds quickly because the limit resets per request", "It re-triggers the limit and adds load to a struggling provider", "It is fine as long as the retry count is capped at three"]
    answer: 1
    why: "Backoff gives the rate limit window time to reset; instant retries just add more load."
  - q: "What does tracking validation failure rate over time catch?"
    options: ["Provider outages, which uptime checks would miss", "Only cost anomalies from retry storms", "A silent quality regression, before it appears as hard errors"]
    answer: 2
    why: "Soft failures like a model version change show up in validation failures well before error rates spike."
---

## Why LLM calls fail differently than typical API calls

A regular internal API call usually either succeeds or fails cleanly and predictably. An LLM API call introduces failure modes a typical service call doesn't have: rate limiting under load (providers cap requests per minute, and production traffic can exceed it), variable latency (a call that normally takes 2 seconds can occasionally take 20), content that fails safety filters, and — distinct from outright failure — a response that returns successfully but is wrong, malformed, or doesn't follow the requested format. Reliability engineering for LLM systems has to account for both categories: hard failures (the call didn't complete) and soft failures (the call completed but the output isn't usable).

## Handling hard failures: retries, backoff, and rate limits

- **Retries with exponential backoff** for transient failures (timeouts, 5xx errors, rate-limit responses) — retrying immediately after a rate-limit error usually just gets rate-limited again; backing off (waiting progressively longer between retries) gives the provider's rate limit window time to reset.
- **Respecting rate-limit headers.** Most LLM APIs return information about remaining quota and reset timing in response headers; a well-behaved client uses this to pace requests proactively rather than discovering the limit by repeatedly hitting it.
- **Circuit breakers** — if a provider is failing at a high rate, continuing to send full traffic at it wastes time on calls likely to fail anyway; a circuit breaker temporarily stops sending requests (or reduces the rate) after a failure threshold, checking periodically whether the provider has recovered before resuming full traffic.
- **Provider fallback.** Systems with a hard availability requirement sometimes maintain a secondary model provider (or a different model from the same provider) to fall back to if the primary is down or degraded — at the cost of maintaining compatibility across providers' differing APIs and potentially different output characteristics.

## Handling soft failures: output validation

A response that returns HTTP 200 can still be wrong in ways a typical API response can't be — a required JSON field missing, a hallucinated fact, a response that ignores the system prompt's constraints. This is unique to LLM systems and needs its own handling layer, distinct from network-level error handling:

- **Schema validation** for structured outputs — if the response is supposed to be JSON matching a specific shape, validate it before using it, and treat a validation failure as a retriable error (often with a corrective follow-up prompt: "your last response didn't match the required format, here's the error, please retry").
- **Guardrail checks** on content — for consequential outputs, a second, cheaper validation pass (a smaller model, or rule-based checks) can catch obviously wrong or unsafe outputs before they reach a user, without needing the full generation to be perfect on the first attempt.
- **Graceful degradation to a simpler fallback.** If a sophisticated feature (a generated summary, a personalized recommendation) fails validation repeatedly, falling back to a simpler, non-LLM-dependent default (a generic message, an unpersonalized default) is often better than surfacing an error or blocking the user entirely — the feature degrades rather than breaks.

## Timeouts need to be set deliberately, not left at a library default

LLM response times vary meaningfully with output length and load, so a timeout that's too short cuts off legitimate long-running generations, while one that's too long lets a single stuck request hold resources (and a user waiting) far longer than acceptable. Setting an appropriate timeout requires actually knowing your system's expected latency distribution (from real production data, not a guess), and pairing it with streaming (covered in this track's cost-and-latency lesson) so a long generation can start showing partial output to the user well before the full response completes, rather than the user staring at nothing until either a full response or a timeout arrives.

## Monitoring: what to alert on beyond "is the API down"

- **Latency percentiles (p50/p95/p99), not just averages** — a small fraction of very slow requests can badly hurt user experience while barely moving an average, so tracking tail latency specifically matters more for LLM calls than for most typical API dependencies, given how much latency variance LLM inference can have.
- **Validation failure rate** — tracking how often outputs fail schema or guardrail checks over time surfaces a silent quality regression (e.g., after a model version change) well before it would show up as a hard error rate spike.
- **Cost per request, tracked continuously** — an unexpected cost spike (from a prompt change, a retry storm, or a shift in usage pattern) is a production signal worth alerting on in its own right, distinct from correctness or latency.

## A worked example

**Scenario:** a production feature generating structured product descriptions from a JSON schema, called at moderate volume, where the description must always be shown to the user (no acceptable "feature unavailable" state).

- **Hard failure handling**: exponential backoff retries for transient errors, with a circuit breaker that, if the primary provider degrades badly, temporarily routes to a fallback (either a secondary provider or a cached/previous version of similarly-shaped content) rather than surfacing an error to the user.
- **Soft failure handling**: every response is schema-validated before use; a validation failure triggers one corrective retry with the specific validation error included in the follow-up prompt, and if that also fails, the system falls back to a template-based, non-LLM-generated description rather than showing nothing or an error.
- **Monitoring**: p95/p99 latency, validation failure rate, and cost-per-request are all tracked on dashboards with alerting thresholds, not just uptime — so a quality regression (rising validation failures) or a cost anomaly surfaces as an alert before a user complaint does.

## Current practice (verified October 2026)

Treat slowness, not just errors, as the failure mode: set timeouts and deadlines, cap retries (budget about +10% load, jitter, one layer), shed low-priority work when overloaded, use circuit breakers with a degradation ladder (smaller model, cached or retrieval-only answer, non-AI path), and decide per surface whether safety checks run synchronously or asynchronously. Rehearse with game days that disable the primary model, the vector store and the guardrail service in turn. See the system design lesson on retries, timeouts and load shedding.

## Common mistakes

- **Treating "the API call returned successfully" as equivalent to "the output is correct and usable."** This misses the entire category of soft failures that are specific to LLM outputs and don't exist for typical deterministic API responses.
- **Retrying immediately without backoff on rate-limit errors**, which typically just triggers the same rate limit again and can make an already-degraded situation worse by adding more load to a provider that's already struggling to keep up.
- **No fallback path for validation failures**, so a persistent schema or content issue (from a prompt regression, a model update, or unusual input) results in a hard user-facing failure instead of a graceful, less-personalized degraded experience.
