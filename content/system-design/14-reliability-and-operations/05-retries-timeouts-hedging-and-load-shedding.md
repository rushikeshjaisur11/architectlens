---
title: "Retries, Timeouts, Hedging and Load Shedding"
short_title: "Retries, Timeouts and Load Shedding"
tags: ["resilience", "retries", "timeouts", "backpressure", "load-shedding", "hedging"]
sources:
  - "Amazon Builders' Library, 'Timeouts, retries and backoff with jitter' (Marc Brooker)"
  - "Amazon Builders' Library, 'Using load shedding to avoid overload'"
  - "Dean and Barroso, 'The Tail at Scale' (Communications of the ACM, 2013)"
  - "Google SRE Book, chapter 'Addressing Cascading Failures'"
banner:
  layout: line
  nodes:
    - [client, "client"]
    - [doc, "timeout"]
    - [server, "retry + jitter"]
    - [shield, "load shed"]
predict:
  question: "A gateway, a service and a database client each retry 3 times. The database slows while 1,000 requests per second arrive. How many attempts hit the database?"
  options: ["About 3,000 per second", "About 9,000 per second", "About 27,000 per second"]
  answer: 2
  why: "Stacked retries multiply: 3 x 3 x 3 = 27 attempts per request, so 27,000 per second."
check:
  - q: "Why add jitter to exponential backoff?"
    options: ["It lets clients skip the backoff on their first retry", "Clients that failed together would otherwise retry together in lockstep", "It raises the retry budget above the usual 10% cap"]
    answer: 1
    why: "Without randomization, many clients hit the recovering server at the same instant."
  - q: "Why shed excess load instead of queueing everything?"
    options: ["Queued requests finish sooner than rejected ones can be retried", "Rejecting requests lets the server ignore request priorities", "Queues grow past client timeouts, wasting capacity on abandoned requests"]
    answer: 2
    why: "An overloaded server that accepts everything serves nobody; early cheap rejection keeps accepted work on time."
  - q: "Why limit hedged requests to idempotent reads?"
    options: ["A second copy is sent, so it suits only repeatable, cheap reads", "Hedging needs a single replica, which writes cannot provide", "Hedged requests are cancelled at p50, which breaks writes"]
    answer: 0
    why: "Hedging duplicates work, so it fits only safe repeatable reads, not expensive or non-idempotent calls."
---

## Failure handling can cause failure

When a call fails, the instinct is to try again. That instinct, multiplied across thousands of clients, is a classic way to turn a small problem into an outage. Resilience mechanisms are tools with side effects; used well they hide transient errors, used badly they amplify them.

## Timeouts: no call may wait forever

Every remote call needs a timeout, because a slow dependency otherwise ties up a thread, a connection or a goroutine per request, and the caller runs out of capacity. Choose timeouts from data: slightly above the dependency's normal 99.9th percentile, not an arbitrary 30 seconds. Use a **deadline** passed down the call chain ("this request must finish by 12:00:03.200") so downstream services stop work that nobody is waiting for. A common bug is a timeout longer than the caller's own timeout, so work continues after the user has gone.

## Retries: helpful only when failures are transient

Retry when the error is likely temporary (a dropped connection, a 503) and the operation is **idempotent** (see the idempotency lesson). Do not retry client errors such as 400 or 404, and be careful with non-idempotent writes.

Rules that prevent retry storms:

- **Exponential backoff**: wait 100 ms, 200 ms, 400 ms and so on, up to a cap.
- **Jitter**: randomise each wait. Without it, a thousand clients that failed together retry together and hit the recovering server in lockstep.
- **Retry budgets**: allow at most about 10% extra traffic from retries in total, so a failing dependency sees at most 1.1x normal load, not 4x.
- **Retry at one layer only.** If three layers each retry three times, one user request can become 27 calls to the database. Choose the layer closest to the user or the one with the best information.

**Retry amplification example:** a request goes through a gateway, a service and a database client, each retrying 3 times. When the database slows, one request generates 3 x 3 x 3 = 27 attempts; at 1,000 requests per second the database sees 27,000, finishes off what was a slowdown, and the outage spreads upward.

<div data-anim="retry-storm"></div>

## Hedged requests: spend a little to cut the tail

For read-only calls to replicated services, send the request to one replica and, if no answer arrives within the p95 latency, send a second to another replica and use whichever returns first (cancelling the other). In *The Tail at Scale*, hedging only after a short delay cut the 99.9th-percentile latency of a large benchmark dramatically for a few percent of extra load. It suits idempotent reads; avoid it for expensive or non-idempotent work.

## Load shedding: refusing work to protect the rest

An overloaded server that accepts everything serves nobody: queues grow, latency exceeds client timeouts, and the server spends capacity on responses nobody is waiting for. **Load shedding** means deliberately rejecting excess work early and cheaply, so the work that is accepted completes on time.

- **Bound the queue** and reject when it is full, with a fast "503, retry later" (and a `Retry-After` header).
- **Prioritise**: shed background, batch and free-tier traffic first; protect checkout and login.
- **Shed by age**: drop requests that have already waited longer than their deadline; answering them is wasted work.
- **Adaptive concurrency limits**: lower the number of in-flight requests when latency rises.
- **Backpressure**: tell upstream callers to slow down (rate limits, window sizes, queue-based flow control) instead of buffering without limit.

## Circuit breakers

A circuit breaker watches the error rate for a dependency; when it passes a threshold it **opens** and fails calls immediately for a cool-off period, then lets a few trial calls through (**half-open**) before closing again. It prevents a struggling dependency from being hammered and lets the caller degrade gracefully (cached data, default value, reduced feature).

## A worked example

A checkout service calls a tax service (p99 80 ms, p99.9 150 ms).

1. Timeout: 250 ms with a request deadline of 800 ms for the whole checkout.
2. Retry: one retry on timeout or 503 with 50 to 100 ms jittered backoff; a client-side budget of 10% extra calls.
3. Hedging: not used (tax calls are cheap but correctness-sensitive; retries suffice).
4. The tax service degrades, p99 jumps to 2 s. Callers' timeouts fire at 250 ms; the circuit breaker opens after 50% failures in 10 seconds; checkout falls back to a cached rate table and flags the order for later reconciliation.
5. The tax service sheds low-priority batch traffic first and recovers in minutes instead of spiralling.

## Practical rules

- Timeouts everywhere, deadlines propagated.
- Retries: idempotent only, backoff plus jitter, a budget, one layer.
- Prefer shedding to queueing when overloaded.
- Test failure modes (slow dependency, not just dead dependency); slowness is the usual killer.

## Common mistakes

- **No timeout**, or one longer than the caller's.
- **Retrying immediately and in lockstep.**
- **Stacked retries at every layer.**
- **Retrying non-idempotent writes** and double-charging.
- **Unbounded queues** that convert overload into a slow, total outage.
