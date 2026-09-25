---
title: "Distributed Transactions: Two-Phase Commit and the Saga Pattern"
short_title: "2PC & Sagas"
tags: ["distributed-transactions", "2pc", "saga", "microservices", "consistency"]
sources:
  - "Jim Gray, 'Notes on Data Base Operating Systems' (1978, origin of two-phase commit)"
  - "Hector Garcia-Molina & Kenneth Salem, 'Sagas' (SIGMOD, 1987)"
  - "Pat Helland, 'Life Beyond Distributed Transactions: An Apostate's Opinion' (CIDR, 2007)"
---

## The problem: atomicity across nodes

A single database gives you ACID transactions for free because one process owns the commit log. The moment a "transaction" spans multiple independently-failing nodes — separate databases, separate microservices — atomicity has to be engineered explicitly. Two approaches dominate: **two-phase commit (2PC)**, which preserves atomicity by blocking until every participant agrees, and the **Saga pattern**, which abandons atomicity in favor of a sequence of compensable local transactions.

## Two-phase commit

2PC, formalized by Jim Gray, coordinates a **coordinator** and a set of **participants** (resource managers) through two rounds:

1. **Prepare (vote) phase.** The coordinator asks every participant to prepare the transaction — participants do all the work, write it to a durable log, and reply "yes" (ready to commit) or "no" (abort), but do not yet make changes visible.
2. **Commit phase.** If all participants voted yes, the coordinator logs the decision and sends `commit`; if any voted no (or timed out), it sends `abort`. Participants then apply or discard the prepared work and acknowledge.

The guarantee is strong: either everyone commits or everyone aborts. The cost is equally strong. Once a participant votes "yes," it must hold locks on the affected rows until it hears back from the coordinator — if the coordinator crashes after collecting votes but before broadcasting the decision, participants are **blocked indefinitely**, holding locks and unable to unilaterally decide (this is the well-known "2PC blocking problem," solved only partially by protocols like three-phase commit, which trade more round trips for reduced blocking under specific failure assumptions). 2PC also assumes all participants are reachable and roughly synchronously available, which is a poor fit for microservices that are deployed, scaled, and fail independently. X/Open XA is the standard interface most relational databases and message brokers implement for 2PC participation.

## The Saga pattern

Garcia-Molina and Salem proposed Sagas for exactly this failure mode: long-lived transactions where holding locks for the full duration is unacceptable. A saga is a sequence of local transactions `T1...Tn`, each committing independently, paired with **compensating transactions** `C1...Cn-1` that semantically undo a prior step if a later one fails. There's no global lock and no blocking coordinator — each `Ti` commits immediately in its own service, and if `Tk` fails, the saga runs `Ck-1, Ck-2, ..., C1` in reverse to unwind the partial work.

Two coordination styles are used in practice:

- **Choreography.** Each service publishes an event when its local step completes; downstream services react to events and, on failure, publish compensating events. No central coordinator — this scales well but makes the overall transaction flow hard to observe, since the logic is smeared across every participant's event handlers.
- **Orchestration.** A dedicated orchestrator explicitly calls each step and, on failure, explicitly invokes the compensations in order. This centralizes the flow (easier to trace and modify) at the cost of a new component that itself needs to be highly available.

Compensations are **not** a rollback in the ACID sense — they're a forward-moving business operation (e.g., "issue a refund" rather than "undo the charge"), because the original transaction's effects (an email sent, a payment captured by a third party) may already be externally visible and can't be un-happened. This is the practical consequence of Pat Helland's core argument: at scale, you don't get to pretend distributed operations are atomic — you design compensable business processes instead.

## Choosing between them

2PC fits when participants are few, co-located (same data center, low latency), and you control all of them (e.g., a single service writing to its own DB plus a Kafka transaction). Sagas fit microservice architectures where services are owned by different teams, deployed independently, and the transaction may span seconds to days — exactly the domain where blocking coordination is untenable.

## Common mistakes

- **Using 2PC across a wide-area network or across services you don't operate end-to-end.** The blocking window becomes a real availability hazard, and you can't fix a stuck participant you don't control.
- **Writing a Saga without idempotent steps.** Network retries mean a step or its compensation can be invoked more than once; both must be safe to repeat.
- **Assuming compensations restore the exact prior state.** They restore business-level correctness (refund issued), not bit-for-bit reversal — design each compensation as its own operation with its own failure handling.
- **Skipping the isolation discussion.** Sagas give up isolation, not just atomicity — intermediate states are visible to concurrent reads, so concurrent sagas touching the same data need explicit design (semantic locks, versioning) to avoid anomalies.
