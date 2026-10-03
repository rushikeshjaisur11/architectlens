---
title: "Event Sourcing and CQRS"
short_title: "Event Sourcing and CQRS"
tags: ["event-sourcing", "cqrs", "architecture"]
sources:
  - "Martin Fowler, 'Event Sourcing' (martinfowler.com)"
  - "Greg Young, talks and writing introducing CQRS"
---

## The core idea behind event sourcing: store what happened, not just the current state

A conventional data model stores the current state of an entity (an order's current status, a bank account's current balance), overwriting the previous value on each update — the history of *how* that state was reached is generally lost unless separately logged. **Event sourcing** inverts this: instead of storing current state directly, the system stores an append-only sequence of events representing every change that ever happened ("order created," "item added," "payment received," "order shipped"), and current state is derived by replaying those events in order — the event log is the actual source of truth, and any "current state" view is a computed projection of it, not independently stored ground truth.

## Why this is a genuinely different tradeoff than conventional storage

**Full auditability, by construction.** Since every change is a permanently retained event, there's no separate audit-log system needed to answer "how did we arrive at this state" — the event log *is* the complete history, inherently, rather than requiring a bolted-on logging mechanism that could itself be incomplete or inconsistent with the actual state changes.

**Ability to reconstruct state at any past point in time.** Replaying events up to a specific point in the log reconstructs exactly what the state looked like at that moment — genuinely useful for debugging ("what did this order look like right before the bug occurred") or for business requirements needing historical state reconstruction (a financial system needing to show account state as of a specific past date for compliance purposes).

**The cost: reading current state requires replaying events, which needs a strategy to stay fast.** Replaying every event from the beginning of time on every read would get progressively slower as the event log grows — practical event-sourced systems use **snapshots**: periodically materializing and storing the current computed state (or state as of a specific point), so a read only needs to replay events since the most recent snapshot, not the entire history — directly analogous in spirit to this track's LSM-Tree lesson's compaction process, which similarly exists to bound the cost of reconstructing current state from an otherwise-growing log of changes.

## CQRS: separating how you write from how you read

**CQRS (Command Query Responsibility Segregation)** is a closely related, often paired pattern: rather than using the same data model for both writing (commands, which change state) and reading (queries, which retrieve state), the write side and read side use genuinely separate models, each optimized independently for its own access pattern. This connects directly to this track's caching-strategies and denormalization reasoning: the write side can remain normalized and strict (validating business rules on each command), while one or more read-side models are denormalized, precomputed projections specifically optimized for the actual queries the application needs — the same "optimize deliberately for known read paths" principle from the normalization lesson, but elevated to a full architectural split rather than a per-table denormalization decision.

Event sourcing and CQRS pair naturally: the event log serves as the write-side source of truth, and one or more read-side projections are built by consuming that event stream and materializing it into whatever shape each specific query pattern needs — a direct application of the async, event-driven processing pattern from this track's message-queue and stream-processing lessons, applied specifically to keeping read projections current as new events arrive.

## Why this combination isn't a universal default

Event sourcing plus CQRS adds real complexity: maintaining an event schema that can evolve over time without breaking replay of old events, building and maintaining snapshot logic, and keeping read-side projections correctly synchronized with the event log (an eventually-consistent relationship, similar in spirit to the replication-lag considerations from this track's replication-strategies lesson) — meaningfully more moving parts than a conventional CRUD data model. This tradeoff is worth making specifically for domains where the audit trail and point-in-time reconstruction capabilities are genuinely valuable to the business (financial systems, systems with real regulatory audit requirements, or domains where understanding "how did we get here" is itself a core product feature), not as a default architecture reached for without a specific need driving it.

## A worked example

**Scenario:** an order-management system for a business with real regulatory requirements to reconstruct exactly what an order's state was at any past point, and to prove the sequence of events leading to any disputed order outcome.

- **Event sourcing** is chosen specifically because of the audit and point-in-time-reconstruction requirement — a conventional current-state-only data model would require building a separate, potentially incomplete audit log to satisfy the regulatory need, whereas an event-sourced design gets this capability inherently from the architecture itself.
- **CQRS separates the write side** (validating and recording each order event against business rules) **from multiple read-side projections**: a fast, denormalized "current order status" view for the customer-facing order-tracking page, and a separate analytical projection aggregating order events for the business-reporting dashboard — each optimized independently for its own very different access pattern, rather than one shared data model trying to serve both well.
- **Snapshotting** is applied to the write-side event replay for orders with unusually long event histories (rare edge cases, like an order with many modifications), so reconstructing current state for those specific orders doesn't require replaying an ever-growing full history on every access.

## Common mistakes

- **Adopting event sourcing and CQRS as a default "best practice" architecture without a specific need** (audit requirements, point-in-time reconstruction, genuinely divergent read/write access patterns) driving the decision — the added complexity is a real, ongoing cost that needs a correspondingly real benefit to justify it, not a default reached for out of general enthusiasm for the pattern.
- **Not planning for event schema evolution from the start.** As the business logic changes over time, old events in the log were recorded under an older schema — a system that can't correctly replay old-schema events alongside new ones breaks the entire premise of event sourcing's historical-reconstruction guarantee.
- **Treating read-side projections as always perfectly synchronized with the write-side event log**, forgetting that the projection-update process is itself asynchronous (per the event-driven processing connection above) — a read immediately following a write can, in principle, see a projection that hasn't yet caught up to that write, a real eventual-consistency consideration that needs explicit handling (or acceptance) in the application design, not an assumption of instant consistency.
