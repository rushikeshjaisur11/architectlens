---
title: "Little's Law, Queueing and Tail Latency"
short_title: "Little's Law and Tail Latency"
tags: ["queueing", "latency", "capacity", "littles-law", "tail-latency"]
sources:
  - "Little, 'A Proof for the Queuing Formula: L = lambda W' (Operations Research, 1961)"
  - "Dean and Barroso, 'The Tail at Scale' (Communications of the ACM, 2013)"
  - "Kleinrock, Queueing Systems, Volume 1: Theory (1975)"
---

## Why systems fall off a cliff

A service that handles 100 requests a second at 20 ms feels fine. Push it to 95% utilisation and the same service can answer in 400 ms, though no single request got slower to compute. The difference is **waiting**. Most latency in a loaded system is queueing, not processing, and queueing has a mathematics that explains why capacity planning at "70% busy" is sensible and at "95% busy" is reckless.

## Little's Law

For any stable system, **L = lambda x W**:

- **L**: the average number of requests in the system (queued plus in service).
- **lambda**: the average arrival rate (requests per second).
- **W**: the average time a request spends in the system.

It needs no assumptions about arrival patterns or service times, which is why it is so useful. Examples:

- A service receives 500 requests a second and each takes 200 ms in total. Concurrency L = 500 x 0.2 = **100 requests in flight**. If each worker handles one request at a time, you need at least 100 workers; with 64, requests queue.
- A database connection pool of 50 and a query time of 25 ms caps throughput at 50 / 0.025 = **2,000 queries per second**. Past that rate, callers wait for a connection.
- A queue holds 12,000 messages and consumers process 400 per second: the average message waits W = 12,000 / 400 = **30 seconds**.

## Utilisation and the hockey stick

Utilisation rho is arrival rate divided by service capacity. For a simple single-server queue with random arrivals (M/M/1), the average time in the system is service time divided by (1 minus rho):

| utilisation | average time in system (service time 20 ms) |
|---|---|
| 50% | 40 ms |
| 70% | 67 ms |
| 90% | 200 ms |
| 95% | 400 ms |
| 99% | 2,000 ms |

Real services are not M/M/1, but the shape holds: delay grows slowly, then explodes as utilisation approaches 100%. Variability makes it worse: bursty arrivals and uneven request sizes produce queues even at moderate average load. Hence rules like "autoscale at 60 to 70% CPU" and "keep headroom for failures".

## Averages hide the tail

Users feel the slow requests. If the average is 80 ms but 1% of requests take 2 seconds, then a page that makes 20 backend calls hits at least one slow call about 18% of the time (1 minus 0.99 to the 20th power). **Tail latency amplification** is why fan-out systems (search, feeds, microservice calls) must manage the 99th percentile, not the mean. Dean and Barroso's *The Tail at Scale* shows that at large fan-out even rare slowness becomes the common case.

Causes of tail latency: queueing, garbage-collection pauses, noisy neighbours, cache misses, retries, background jobs, network loss. Mitigations: keep utilisation moderate, set timeouts, hedge requests, shed load, isolate resources, and cut variance (smaller requests, bounded work per call).

## A worked example

An API tier has 20 instances, each able to do 100 requests per second at 10 ms service time.

1. Peak traffic is 1,700 requests per second: utilisation 85%. Predicted average time in system for one server at 85%: about 10 ms / 0.15 = 67 ms, and the 99th percentile is several times that.
2. One instance fails: 19 instances share 1,700, so utilisation rises to 89% and average time to about 95 ms; p99 climbs sharply.
3. Adding 4 instances (24 in total) brings utilisation to 71%, and to 74% with one instance down: average about 35 to 40 ms, so the failure no longer causes a visible spike.
4. Little's Law check: at 1,700 per second and about 35 ms, requests in flight are about 60, spread across 24 instances, which is under 3 per instance, so thread pools of 16 per instance have room.

## Practical rules

- Size from **utilisation targets** (60 to 70% at peak), not from "it survived the load test".
- Use Little's Law to size pools: concurrency needed = rate x latency; compare with workers, connections and threads.
- **Measure percentiles** (p95, p99, p99.9) and track queue depth and time in queue separately from processing time.
- Bound queues; an unbounded queue turns overload into slow failure and memory exhaustion (see load shedding).
- Test at and beyond saturation to see how the system degrades.

## Common mistakes

- **Planning on average latency**.
- **Running hot to save money**, then missing the cliff on the first traffic burst or node loss.
- **Ignoring fan-out**, so one slow dependency dominates every page.
- **Unbounded queues** hiding overload until memory runs out.
- **Sizing pools by guess** instead of rate times latency.
