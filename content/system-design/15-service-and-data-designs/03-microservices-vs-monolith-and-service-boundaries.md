---
title: "Microservices vs. Monolith: Drawing Service Boundaries"
short_title: "Microservices vs Monolith"
tags: ["microservices", "monolith", "service-design", "architecture"]
sources:
  - "Sam Newman, 'Building Microservices' (2015)"
  - "Martin Fowler, 'MonolithFirst' (martinfowler.com)"
---

## Why this is a genuine tradeoff, not a settled "microservices are modern" default

Despite microservices being widely discussed as a modern default, the actual tradeoff is real and cuts both ways — a monolith (a single deployable application, even if internally modular) has genuine advantages that get lost in a purely "microservices are more scalable" framing, and picking the wrong architecture for a given team and problem stage is a common, costly mistake in both directions: over-splitting a small system prematurely, and under-splitting a genuinely large, multi-team system for too long.

## What a monolith gets right, that's easy to undervalue

- **Simpler operational model** — one deployable unit, one set of logs, one process to debug when something goes wrong, rather than needing to trace a request across many independently-deployed services (directly connecting to the multi-step tracing complexity covered in this track's AI-systems counterpart lesson, but for general request tracing rather than LLM-specific pipelines).
- **No network calls between internal components** — a monolith's internal module boundaries are function calls, not network requests — meaning no need to reason about the partial-failure, latency, and serialization overhead that a network call between microservices introduces for what's conceptually the same kind of internal interaction.
- **Easier to refactor across boundaries.** Moving logic between two modules within a monolith is a straightforward code change; moving logic between two separately-deployed microservices means coordinating a change across service boundaries, API contracts, and independent deployment schedules — a monolith's internal boundaries stay cheap to reshape as understanding of the problem evolves, while microservice boundaries, once established, are genuinely more expensive to redraw.

## What microservices get right, and when that actually matters

- **Independent scaling** — if one part of a system (say, image processing) has genuinely different resource needs and load patterns than another part (say, user authentication), splitting them lets each scale independently rather than the whole monolith needing to scale together even though only one part's load actually demands it.
- **Independent deployment** — separate teams can deploy their own services on their own schedules without coordinating a single shared deployment, which matters specifically once an organization has grown enough that a single shared monolith deployment becomes an actual coordination bottleneck across multiple teams working on unrelated parts of the system.
- **Technology and failure isolation** — different services can use different technology stacks suited to their specific problem, and (per this track's circuit-breaker and bulkhead patterns) a failure in one service is more naturally contained from affecting unrelated services, versus a bug or resource exhaustion in one part of a monolith potentially affecting the whole process.

## The actual deciding factor: team structure and organizational scale, more than technical purity

A frequently underweighted point (associated with "Conway's Law" — systems tend to mirror the communication structure of the organizations that build them): microservices' independent-deployment benefit only actually matters once you have multiple teams that need to deploy independently without coordinating with each other — a single small team building a system gets little practical benefit from splitting it into microservices, since that team still needs to coordinate changes across those services themselves regardless of the architectural split, while paying the real added operational complexity (network calls, distributed tracing, independent deployment pipelines, per-service monitoring) that microservices introduce. This is the core reasoning behind the commonly-cited "monolith first" guidance: start with a well-structured, internally-modular monolith, and split out specific services only once there's a concrete, demonstrated reason (a genuine independent-scaling need, or a genuine multi-team coordination bottleneck) — not because microservices are assumed to be the more sophisticated or scalable default regardless of actual current need.

## Drawing service boundaries well, when you do split

When splitting is genuinely warranted, service boundaries should generally align with **bounded contexts** — a domain-driven-design concept meaning each service owns a cohesive piece of business logic and its own data, with minimal need for other services to reach into its internals. A boundary drawn along genuine business-domain lines (an "orders" service, a "payments" service, each owning their own data and business rules) tends to hold up better over time than a boundary drawn along a more arbitrary technical seam (splitting by database table, or by a layer like "all validation logic" as its own service) — the latter tends to produce services that are still tightly coupled to each other's internal changes despite being technically separate deployments, undermining much of the independent-deployment benefit splitting was meant to provide in the first place.

## A worked example

**Scenario:** a startup begins building an e-commerce platform with a single small engineering team, and needs to decide on initial architecture, with an eye toward how the system might need to evolve as the company (hopefully) grows.

- **Start as a well-modularized monolith**, with clear internal module boundaries (order management, payment processing, inventory) even though it deploys as a single unit — this gets the team fast iteration speed and operational simplicity appropriate for a single small team's current actual needs, while the clear internal modularity (following bounded-context reasoning even within the monolith) keeps a future split feasible if and when it's actually warranted, rather than needing a full rewrite at that point.
- **Split out a specific service only once a concrete driver emerges** — say, once the company has grown enough that a dedicated payments team needs to deploy payment-related changes independently of the broader engineering team's release cadence, or once the image-processing/recommendation workload genuinely needs independent scaling from the rest of the system's more moderate, steadier load — each split justified by an actual observed organizational or technical need, not undertaken preemptively based on an assumption that microservices are simply the more mature end-state to build toward from day one.
- **The eventual payments-service split follows the monolith's existing internal module boundary**, since that boundary was already drawn along genuine bounded-context lines rather than an arbitrary technical seam — making the actual extraction meaningfully more straightforward than it would have been if the original monolith's internal structure hadn't already respected domain boundaries.

## Common mistakes

- **Starting a new, small project with a microservices architecture "for scalability" before there's any team-structure or independent-scaling need actually driving it** — paying real operational complexity cost for a benefit (independent deployment/scaling) that a single small team building the whole system doesn't actually realize yet.
- **Splitting services along arbitrary technical boundaries rather than genuine business-domain (bounded-context) lines**, producing services that remain tightly coupled to each other's changes despite being technically separate — undermining the independent-deployment benefit the split was meant to achieve.
- **Never splitting a monolith even once a genuine multi-team coordination bottleneck or independent-scaling need has clearly emerged**, continuing to pay a real, growing coordination cost for a single shared deployment well past the point where a monolith's simplicity advantage still outweighs that cost.
