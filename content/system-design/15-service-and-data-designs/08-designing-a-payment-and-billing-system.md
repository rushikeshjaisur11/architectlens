---
title: "Designing a Payment and Billing System"
short_title: "Payment and Billing System"
tags: ["payments", "billing", "idempotency", "ledger", "consistency"]
sources:
  - "Stripe API documentation on idempotent requests"
  - "Public engineering articles on double-entry ledgers and payment reconciliation"
  - "Kleppmann, Designing Data-Intensive Applications (2017), chapters on transactions and exactly-once semantics"
banner:
  layout: line
  nodes:
    - [user, "buyer"]
    - [lock, "PSP"]
    - [db, "ledger"]
    - [doc, "reconcile"]
---

## What makes payments different

Most systems tolerate an occasional lost or duplicated event. Payments do not: charging a customer twice or losing a payment is a financial and legal problem. The design priorities are therefore **correctness, auditability and recoverability first, throughput second**.

Never claim exactly-once over an unreliable network. Instead, build **at-least-once delivery plus idempotency**, which together behave like exactly-once for the business outcome.

## The shape of a payment flow

A card payment involves your service, a **payment service provider (PSP)** that talks to card networks and banks, and your own records. A typical flow:

1. The client starts checkout; your server creates a **payment intent** in a `created` state with an amount, currency and a unique ID.
2. The customer's payment details go **directly to the PSP** (via a hosted field or token), so your servers never touch raw card numbers. This sharply reduces your PCI compliance scope.
3. Your server asks the PSP to authorize or charge the intent.
4. The PSP responds, and also sends an **asynchronous webhook** with the final status.
5. Your system updates the intent to `succeeded` or `failed` and triggers fulfilment.

Payment status is a **state machine** with explicit allowed transitions (created, processing, succeeded, failed, refunded). Reject illegal transitions, so a late duplicate webhook cannot move a refunded payment back to succeeded.

## Idempotency

Network calls fail ambiguously: a timeout does not tell you whether the charge happened. The client may retry, and a naive retry charges twice.

The standard fix is an **idempotency key**: a unique value generated per logical operation and sent with every attempt. The server stores the key and the result of the first completed attempt. A repeat with the same key returns the stored result without redoing the work. Rules that make this safe:

- The key is scoped to the operation and the account.
- Store the key and the operation's outcome **atomically** with the state change.
- If a second request arrives while the first is still in flight, return a conflict or wait, rather than starting another.
- Reject a reused key with different parameters.

## The ledger

Balances should not be a single mutable number that gets overwritten. Use a **double-entry ledger**: every movement of money is recorded as an **immutable pair of entries**, a debit in one account and an equal credit in another, so the total across the system always sums to zero.

Properties this gives you:

- **Auditability:** every balance can be explained by replaying entries.
- **Corrections without erasure:** a mistake is fixed by appending a reversing entry, never by editing history.
- **Easy invariants:** the sum of all entries must be zero, and this can be checked continuously.

Write both entries of a transaction in **one database transaction**, so you never record half a transfer. Use integer minor units (cents) or a decimal type, never floating point, for money.

## Webhooks and asynchronous truth

The PSP's webhook is often the authoritative result, because the synchronous call might time out. Handle webhooks carefully:

- **Verify signatures** so forged events are rejected.
- Treat delivery as **at-least-once and out of order**: deduplicate by event ID and check state transitions.
- Respond quickly, then process asynchronously from a durable queue.
- Provide a way to **re-fetch** the payment from the PSP, so a missed webhook cannot leave you permanently wrong.

## Reconciliation

Even with careful engineering, your records and the PSP's or the bank's will sometimes disagree. **Reconciliation** is a scheduled job that compares your ledger against the provider's settlement reports, flags mismatches (missing payments, amount differences, unexpected refunds), and routes them for review. It is the safety net that finds problems the online path missed, and it is not optional in a real payment system.

## Billing on top of payments

Subscription billing adds a layer: plans, billing periods, **proration** when a customer changes plan mid-cycle, invoices, taxes, retries for failed renewals (a "dunning" schedule), and usage metering. Model invoices as immutable documents generated from usage and plan data at period end, and keep usage events in an append-only log so disputes can be traced.

## A worked example

**Scenario:** a customer pays $49.99, and the request to the PSP times out.

- The client had attached idempotency key `K-831`. Your server stored the intent as `processing`.
- The retry with `K-831` reaches the PSP, which recognizes the key and returns the original result: the charge succeeded. No second charge occurs.
- Meanwhile the webhook arrives; your handler deduplicates it, confirms `processing` to `succeeded` is a legal transition, and writes ledger entries: debit customer clearing 4,999, credit revenue 4,999, in one transaction.
- The nightly reconciliation compares the day's ledger totals against the PSP settlement file and finds them equal.

## Common mistakes

- **Using floats for money.** Rounding errors accumulate; use integers.
- **Retrying charges without idempotency keys.**
- **Mutating a balance in place** with no history.
- **Trusting the synchronous response alone** and ignoring webhooks and reconciliation.
- **Storing card numbers yourself** rather than using the PSP's tokenization.
- **Allowing any state transition**, so late events corrupt status.
