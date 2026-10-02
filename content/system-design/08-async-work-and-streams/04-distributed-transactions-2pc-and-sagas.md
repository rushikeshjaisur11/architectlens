---
title: "Distributed Transactions: Two-Phase Commit and Sagas"
short_title: "Distributed Transactions: 2PC and Sagas"
tags: ["transactions", "sagas", "two-phase-commit", "microservices"]
sources:
  - "Hector Garcia-Molina & Kenneth Salem, 'Sagas' (1987)"
  - "Chris Richardson, 'Microservices Patterns' (2018), chapter on managing transactions with sagas"
---

## The problem: one business action, several databases

Placing an order might reserve inventory (inventory service), charge a card (payment service), and create a shipment (shipping service), each with its own database. This track's ACID lesson covers atomicity inside one database: all changes commit or none do. Spanning several independent services, there's no single transaction to wrap around it all, yet you still can't end up charged for an order that has no stock reserved.

## Two-phase commit: strong atomicity, real costs

**Two-phase commit (2PC)** coordinates multiple participants through a coordinator:

1. **Prepare.** The coordinator asks every participant "can you commit?" Each does the work, durably records that it *can* commit, holds its locks, and votes yes or no.
2. **Commit or abort.** If all voted yes, the coordinator tells everyone to commit; if any voted no, it tells everyone to abort.

The guarantee is real: all participants commit or none do. The costs are also real:

- **Blocking.** If the coordinator crashes after participants have voted yes but before it announces the decision, those participants are stuck holding locks, unable to decide on their own without risking disagreement with the others.
- **Latency and lock holding.** Locks are held across network round trips to every participant, which hurts throughput under contention.
- **Availability coupling.** Every participant must be reachable for the transaction to progress, which is awkward when the participants are independently deployed services — the trade-off flagged in this track's CAP lesson.

2PC remains reasonable inside a tightly managed boundary (some databases use it internally across their own shards). It is a poor fit across independently owned services.

## Sagas: a chain of local transactions with undo steps

A **saga** replaces one big atomic transaction with a sequence of *local* transactions, each committed independently in its own service. If a later step fails, the saga runs **compensating transactions** for the steps already completed, undoing their business effect.

For the order example: reserve inventory → charge payment → create shipment. If shipment creation fails, the saga runs "refund payment" and "release inventory." Compensation is a *semantic* undo (issue a refund), not a database rollback — the original charge really happened and is visible until compensated.

## Orchestration vs. choreography

- **Orchestration.** A central orchestrator tells each service what to do next and handles failures. The flow is explicit and easy to follow and monitor, at the cost of a component that must be built, scaled, and kept correct.
- **Choreography.** Services react to each other's events (this track's message-queue and event-sourcing lessons) with no central controller. It's loosely coupled, but the overall flow is implicit, spread across services, and harder to reason about and debug as it grows.

## What sagas give up

Sagas provide atomicity-by-compensation but **not isolation**. Between steps, other transactions can see the intermediate state: inventory is reserved while payment hasn't happened yet. Common countermeasures:

- **Semantic locks** — mark records as "pending" so other flows know they're mid-saga.
- **Commutative updates** — design operations so order doesn't matter.
- **Re-reading before acting** — verify state before a step rather than trusting an earlier read.

Every step *and* every compensation must also be **idempotent** (per this track's idempotency lesson), because messages get redelivered and a compensation may itself be retried.

## Reliably publishing the next step: the outbox pattern

A service must update its own database *and* emit the event/command for the next step. Doing both separately risks one succeeding without the other. The **transactional outbox** writes the outgoing message into an "outbox" table in the same local transaction as the business change; a separate relay then publishes it. That turns "update and publish atomically" into a single local transaction plus at-least-once delivery.

## A worked example

**Scenario:** the order flow above, orchestrated.

- The orchestrator sends `ReserveInventory`; on success, `ChargePayment`; on success, `CreateShipment`.
- `CreateShipment` fails (no carrier available). The orchestrator runs `RefundPayment` then `ReleaseInventory`, in reverse order, each idempotent and retried until acknowledged.
- While the saga runs, the order is marked `PENDING` (a semantic lock) so the customer-facing page shows "processing" rather than a half-finished state.
- Each service writes its outgoing event through an outbox, so a crash between "payment recorded" and "event sent" can't strand the saga.

## Common mistakes

- **Using 2PC across independently owned services** and inheriting blocking and availability coupling the architecture was meant to avoid.
- **Writing compensations as an afterthought.** Some steps can't be cleanly undone (an email already sent); decide the failure behavior for those up front.
- **Ignoring the lack of isolation.** Assuming other flows can't observe mid-saga state leads to oversells and confusing intermediate screens.
- **Non-idempotent steps or compensations**, which turn ordinary message redelivery into double charges or double refunds.
