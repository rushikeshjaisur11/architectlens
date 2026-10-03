---
title: "Chaos Engineering and Disaster Recovery Planning"
short_title: "Chaos Engineering and Disaster Recovery"
tags: ["reliability", "chaos-engineering", "disaster-recovery"]
sources:
  - "Netflix Technology Blog, posts introducing Chaos Monkey and the Simian Army"
  - "AWS Well-Architected Framework documentation on disaster recovery strategies"
---

## Why untested resilience mechanisms often aren't actually resilient

This track's reliability-and-operations lesson covered circuit breakers, graceful degradation, and bulkheads as resilience mechanisms. A genuinely common, easy-to-overlook failure: these mechanisms are built and deployed, assumed to work, and then never actually triggered by a real failure until an actual production incident — at which point the team discovers the fallback logic has a bug, the circuit breaker's threshold was misconfigured, or the "essential vs. non-essential" categorization from the graceful-degradation design was wrong in a way nobody noticed because it was never actually tested under real failure conditions. **Chaos engineering** exists specifically to close this gap: deliberately, proactively injecting controlled failures into a system to verify its resilience mechanisms actually work as designed, rather than trusting untested assumptions.

## The core idea: verify resilience the same way you'd test any other critical code path

Just as automated tests verify business logic behaves correctly, chaos engineering verifies that failure-handling logic behaves correctly — and the reasoning for why this needs deliberate, active testing rather than passive trust is the same: code that's never actually executed (a circuit breaker that's never actually tripped, a fallback path that's never actually taken) is exactly the code most likely to have an undiscovered bug, since normal operation never exercises it. Netflix's Chaos Monkey (and the broader "Simian Army" of related tools) pioneered this practice by randomly terminating production instances during business hours specifically to force the team to build genuinely resilient systems — if an instance termination could cause a real outage, that's a resilience gap the team needs to know about and fix, and finding it via a controlled, deliberate test is far preferable to finding it via an actual uncontrolled production incident.

## Progression: from controlled experiments to more realistic failure injection

Mature chaos engineering practice typically progresses through increasing realism and scope:

- **Single-instance failure injection** — terminating individual servers/instances, verifying load balancing and redundancy (per this track's load-balancing lesson) correctly route around the loss without user-visible impact.
- **Dependency failure injection** — simulating a specific downstream service becoming slow or unavailable, verifying circuit breakers and graceful degradation actually engage correctly and the "essential vs. non-essential" categorization from the graceful-degradation design holds up under a genuine, if controlled, failure.
- **Regional/zone failure injection** — simulating an entire availability zone or region becoming unavailable, verifying multi-region failover (per the AI-systems track's multi-region-deployment counterpart lesson, applied here to general infrastructure rather than LLM-specific concerns) actually works at the scale and speed the design assumed, not just in theory.
- **Game days** — scheduled, larger-scale exercises simulating a significant incident scenario (a full regional outage, a critical dependency failure) with the actual on-call team responding as they would to a real incident, testing not just the technical resilience mechanisms but also the human incident-response process, communication, and runbooks — since a technically resilient system can still suffer a worse-than-necessary outage if the team's actual incident response is slow or confused.

## Disaster recovery planning: the broader discipline chaos engineering feeds into

**Disaster recovery (DR)** planning addresses the question chaos engineering helps validate: if a significant failure occurs (not just a single instance, but a full region, or a catastrophic data-corruption event), what's the actual, tested plan for recovery, and how quickly can the system be restored? Two standard metrics frame this:

- **RTO (Recovery Time Objective)** — how long the system can be down before recovery, driving decisions about failover automation and speed (an RTO of minutes requires automated failover; an RTO of hours can tolerate more manual intervention).
- **RPO (Recovery Point Objective)** — how much data loss is acceptable, measured as time (an RPO of zero requires synchronous replication, per this track's replication-strategies lesson, accepting its latency cost; a longer RPO can tolerate asynchronous replication's small data-loss window in exchange for better normal-operation performance).

These metrics directly connect back to the replication and redundancy design choices covered earlier in this track — an RTO/RPO target isn't just a stated goal, it's a concrete constraint that should have driven the actual replication strategy and failover mechanism chosen, and chaos engineering (specifically the regional-failure-injection and game-day exercises) is how a team actually verifies the system meets its stated RTO/RPO in practice, rather than just on paper.

## A worked example

**Scenario:** a financial services platform has stated an RTO of 15 minutes and an RPO of near-zero for its transactional database, and needs to verify these targets are actually achievable, not just architecturally intended.

- **Synchronous replication** (per this track's replication-strategies lesson) is used specifically to support the near-zero RPO target, accepting the added write latency cost as a deliberate tradeoff justified by the stated recovery objective.
- **A scheduled game day** simulates a full primary-region failure, with the on-call team executing the actual failover procedure (not just discussing it hypothetically) — measuring the actual elapsed time from failure detection to full service restoration in the secondary region, and comparing that measured time against the stated 15-minute RTO.
- **The exercise reveals a gap**: the actual measured failover time is 25 minutes, not 15 — DNS propagation delay and a manual approval step in the failover runbook are identified as the specific bottlenecks, previously invisible because the failover procedure had never actually been exercised under realistic conditions before this game day. This directly leads to concrete fixes (automating the approval step for this specific failure scenario, adjusting DNS TTL settings) that wouldn't have been discovered without the deliberate chaos-engineering exercise forcing the gap to surface.

## Common mistakes

- **Documenting an RTO/RPO target without ever actually testing whether the system meets it.** A stated target that's never verified against a real (even if controlled) failure scenario is an assumption, not a validated guarantee — exactly the gap chaos engineering and game-day exercises exist to close.
- **Only testing resilience mechanisms in a staging environment that doesn't accurately reflect production's actual scale, configuration, or load.** A failover mechanism that works cleanly in a small staging environment can behave very differently under real production data volumes and traffic patterns — the most valuable chaos engineering findings often only surface at genuine production scale.
- **Treating chaos engineering as purely a technical exercise, separate from testing the human incident-response process.** As the game-day example shows, a real gap can be in the human/process layer (an unnecessary manual approval step) just as easily as in the technical failover mechanism itself — a comprehensive DR validation needs to exercise both together, not just the technical failover in isolation.
