---
title: "Availability Math: Understanding the Nines"
short_title: "Availability and the Nines"
tags: ["availability", "reliability", "foundations", "slo"]
sources:
  - "Google SRE Book, chapter on service level objectives"
  - "AWS documentation on availability design goals"
---

## What "three nines" actually means

Availability is usually expressed as a percentage of time a system is up and correctly serving requests — "99.9% availability" ("three nines"). The practical way to internalize this: convert the percentage into actual downtime allowed per year, since the percentage alone doesn't build intuition for what it costs to hit.

| Availability | Downtime per year | Downtime per month |
|---|---|---|
| 99% (two nines) | ~3.65 days | ~7.3 hours |
| 99.9% (three nines) | ~8.76 hours | ~43.8 minutes |
| 99.99% (four nines) | ~52.6 minutes | ~4.4 minutes |
| 99.999% (five nines) | ~5.26 minutes | ~26 seconds |

Each additional nine is roughly a 10x reduction in allowed downtime — the jump from three nines to four nines isn't a small tightening, it's an order-of-magnitude harder engineering target, usually requiring fundamentally different architecture (multi-region failover, automated remediation, extensive redundancy) rather than just "being more careful."

## Why availability composes multiplicatively across dependencies

If a request depends on multiple services in sequence, each with its own availability, the overall availability is (approximately) the product of each dependency's availability, not the average or the minimum. A request touching 5 services each at 99.9% availability has a combined availability closer to 99.5% (0.999^5 ≈ 0.995) — noticeably worse than any single component's stated availability. This is a direct, easy-to-miss consequence of chaining dependencies: **each additional hop in a request's critical path drags overall availability down**, even if every individual service meets its own target, which is why minimizing the number of hard dependencies on a critical path is itself a real availability lever, not just a performance one.

## Redundancy: how systems actually beat a single component's availability ceiling

If a single component has 99% availability, how does a system built from such components achieve 99.99%? Through **redundancy** — running multiple independent instances such that the request only fails if *all* of them fail simultaneously. If two independent instances each have a 1% chance of being down at a given moment, and their failures are truly independent, the chance both are down simultaneously is roughly 0.01 × 0.01 = 0.0001 (99.99% combined availability) — redundancy is what turns a modest single-component availability into a much higher effective availability, provided the redundant instances' failures are genuinely independent (not correlated by a shared underlying cause, like the same power supply, same rack, or same region).

This is exactly why the replication strategies covered in this track's storage-engines lesson and the load-balancing/health-check pattern from the reliability-and-operations lesson exist — they're the concrete mechanisms that turn the abstract "redundancy improves availability" math into an actual working system.

## The critical caveat: correlated failures break the math

The multiplicative-independence math above assumes failures are genuinely independent. In practice, failures are often **correlated** — multiple redundant instances in the same datacenter can all go down together from a single power outage, multiple replicas across "different" availability zones can share an underlying dependency (a shared network path, a shared DNS provider) that fails once and takes all of them down simultaneously. This is why genuine high availability requires redundancy across *independent failure domains* (different racks, different availability zones, sometimes different regions or cloud providers entirely) — redundancy within the same failure domain provides far less real protection than the naive independence-based math would suggest, since a single correlated event can defeat it entirely.

## SLIs, SLOs, and error budgets: making availability an operational tool

- **SLI (Service Level Indicator)** — an actual measured metric, like "percentage of requests returning successfully within 200ms."
- **SLO (Service Level Objective)** — a target for that metric, like "99.9% of requests meet the SLI over a rolling 30-day window."
- **Error budget** — the inverse of the SLO: if the SLO is 99.9%, the error budget is the remaining 0.1% of requests/time allowed to fail without violating the objective. This reframes reliability work practically — an error budget that's mostly unspent gives room to ship riskier changes faster; a nearly-exhausted error budget is a signal to slow down and prioritize stability work over new features, providing a concrete, quantified basis for that tradeoff rather than a vague, unquantified debate.

## A worked example

**Scenario:** an e-commerce checkout flow has an internal SLO target of 99.95% availability, and its critical path touches an inventory service, a payment service, and an order-creation service in sequence.

- **Composability check**: if each of the three services independently targets 99.99% availability, the combined critical-path availability is approximately 0.9999^3 ≈ 99.97% — comfortably meeting the 99.95% target, showing the individual service targets were set with the multiplicative composition in mind, not chosen independently without checking how they combine.
- **Redundancy design**: each service runs multiple instances across at least two independent availability zones (not just multiple instances in the same zone), specifically to avoid the correlated-failure trap — a single zone-level outage shouldn't be able to take down all instances of any one service simultaneously.
- **Error budget in practice**: the team tracks actual measured availability against the 99.95% SLO; when the error budget for the current period is largely unspent, the team feels comfortable shipping a riskier checkout-flow change; when a recent incident has consumed most of the budget, that same team explicitly delays non-critical changes until the budget partially recovers — a concrete decision rule grounded in the SLO math rather than an ad hoc judgment call each time.

## Common mistakes

- **Setting a system-wide availability target without accounting for how dependencies compose.** A target set without the multiplicative-composition math in mind can be quietly unachievable even if every individual component meets its own stated target, per the worked example's composability check.
- **Assuming redundancy automatically delivers the independence-based math's promised availability gain**, without verifying the redundant instances don't share a hidden common failure domain — this is the single most common reason "we have redundancy" doesn't actually prevent a major outage in practice.
- **Treating an availability target as an abstract number rather than an operational tool.** Without translating it into an error budget that actually informs day-to-day decisions (how much risk to take on with new changes), an availability SLO becomes a number nobody actually uses to make decisions, rather than the practical tradeoff-management tool it's meant to be.
