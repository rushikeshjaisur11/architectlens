---
title: "Graceful Degradation and Circuit Breakers"
short_title: "Graceful Degradation and Circuit Breakers"
tags: ["reliability", "resilience", "circuit-breakers"]
sources:
  - "Michael Nygard, 'Release It!' (2007), chapter introducing the circuit breaker pattern"
  - "Netflix Hystrix documentation (archived) on circuit breaker implementation"
---

## Why failures need to be contained, not just detected

A system built from many interconnected services has a real risk that isn't obvious until it happens: a failure in one dependency can cascade into a much larger outage if the rest of the system doesn't handle that failure gracefully. A slow or unresponsive downstream service can cause requests to pile up in the calling service (each one waiting on a response that never comes, or comes too slowly), exhausting connection pools or thread capacity in the caller — turning one struggling dependency into an outage of everything that depends on it, even parts of the system that had nothing wrong with them directly.

## The circuit breaker pattern

A **circuit breaker** wraps calls to a dependency and tracks its recent failure rate, operating in three states, directly analogous to an electrical circuit breaker:

- **Closed** — normal operation; requests pass through to the dependency as usual, and failures are tracked.
- **Open** — once failures exceed a configured threshold, the circuit "trips" open: further requests fail immediately (without even attempting to call the struggling dependency) for a cooldown period. This is the core protective mechanism — it stops sending load to a dependency that's already struggling, giving it room to recover instead of being kept down by continued load, and it stops the calling service from wasting its own resources (threads, connections) waiting on calls likely to fail or time out anyway.
- **Half-open** — after the cooldown period, the circuit allows a small number of trial requests through to check whether the dependency has recovered. If they succeed, the circuit closes and normal operation resumes; if they still fail, it reopens for another cooldown period.

This pattern turns "keep hammering a struggling dependency with the same load that's contributing to its struggle" into "back off automatically, then carefully check for recovery" — directly addressing the cascading-failure risk described above, without needing a human to notice and manually intervene during the initial failure window.

## Graceful degradation: what to do while the circuit is open

A circuit breaker stopping calls to a failing dependency is only half the story — the calling service still needs to decide what to actually do for the user during that window, rather than simply failing the whole request. **Graceful degradation** means designing a fallback behavior for when a dependency is unavailable, so the overall user-facing experience degrades in a limited, acceptable way rather than failing completely:

- **Serve stale or cached data** instead of live data, if slightly outdated information is better than none (a product page showing a cached price from a few minutes ago rather than failing entirely because the live pricing service is down).
- **Disable a non-essential feature** while keeping the core experience working (a recommendation widget disabled while checkout still functions, if the recommendation service is what's failing).
- **Return a simplified, default response** rather than a personalized one (a generic "popular items" list instead of a personalized recommendation, if the personalization service is unavailable).

The key design principle: identify, ahead of time, which dependencies are truly essential to a given user flow and which are enhancements that flow can survive without — this determines which fallback is appropriate, and needs to be decided deliberately during design, not improvised during an actual incident.

## Bulkheads: isolating failure domains

A related pattern, **bulkheading** (named after a ship's watertight compartments), limits how much of a system's resources (connection pool slots, thread pool capacity) any single dependency can consume — so a struggling dependency that would otherwise exhaust an entire shared resource pool (starving calls to unrelated, healthy dependencies of the resources they need) is instead confined to its own bounded allocation. This complements circuit breakers: a circuit breaker stops calling a failing dependency once its failure rate crosses a threshold, while a bulkhead limits the damage that dependency can do to shared resources even before that threshold is crossed.

## A worked example

**Scenario:** an e-commerce checkout page calls several services: inventory check, payment processing, and a "customers also bought" recommendation widget — and the recommendation service starts timing out under unrelated load.

- **Circuit breaker on the recommendation service call**: once its failure/timeout rate crosses a threshold, the circuit trips open, and further requests to it fail fast (immediately, without waiting for a timeout) rather than continuing to add load to an already-struggling service and tying up the checkout page's own request-handling resources waiting on it.
- **Graceful degradation**: the checkout page's design treats the recommendation widget as non-essential to the actual checkout flow — when its circuit is open, the page simply omits the widget rather than failing the entire checkout, since inventory check and payment processing (the actually essential dependencies for completing a purchase) are unaffected and continue normally.
- **Bulkheading**: the recommendation service's calls use a separate, bounded connection pool from the payment service's calls, so even before the circuit breaker trips, a struggling recommendation service can't exhaust connections that the payment flow needs — the two dependencies' resource usage is isolated from each other.
- **Recovery**: once the recommendation service's underlying issue is resolved, the circuit breaker's half-open trial requests detect the recovery and the circuit closes automatically, restoring the widget without requiring manual intervention to notice and re-enable it.

## Common mistakes

- **Treating every dependency as equally essential**, with no fallback plan for non-critical ones — this means any dependency's failure, regardless of actual importance to the user's core goal, takes down the entire request rather than degrading gracefully.
- **No circuit breaker on calls to a genuinely unreliable or rate-limited external dependency**, letting a struggling downstream service's problems directly propagate into resource exhaustion in the calling service, worsening rather than containing the original issue.
- **Sharing a single resource pool (connections, threads) across calls to multiple different dependencies without bulkheading.** One dependency's failure can then exhaust shared resources needed by calls to entirely unrelated, healthy dependencies — a failure in one area spreading to cause failures in unrelated areas purely due to resource contention, not any actual problem with those unrelated dependencies themselves.
