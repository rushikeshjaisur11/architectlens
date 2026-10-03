---
title: "Designing a Stock Exchange Matching Engine"
short_title: "Stock Exchange Matching Engine"
tags: ["matching-engine", "order-book", "low-latency", "event-sourcing", "determinism", "design"]
sources:
  - "LMAX Architecture, Martin Fowler's description of the LMAX Disruptor and single-threaded business logic (martinfowler.com, 2011)"
  - "Thompson et al., 'Disruptor: High performance alternative to bounded queues for exchanging data between concurrent threads' (LMAX, 2011)"
  - "Public exchange documentation on price-time priority matching (for example Nasdaq and CME order matching overviews)"
predict:
  question: "Asks: A 500 at 10.02 (earlier), B 300 at 10.02 (later), 800 at 10.03. A buy limit of 700 at 10.02 arrives. What results?"
  options: ["B fills 300 and A fills 400, leaving 100 of A resting", "A fills 500 and the next 200 buy from the 10.03 level", "A fills 500 and B fills 200, leaving 100 of B resting at 10.02"]
  answer: 2
  why: "Price-time priority fills the earlier order A first; a 10.02 limit cannot reach the 10.03 level."
check:
  - q: "Why run matching on a single thread per book instead of using locks?"
    options: ["Locks add jitter and non-determinism, and partitioning by instrument still scales out", "A single thread is faster only because it can use more cores than lock-based code", "Locks cannot protect an order book, so only lock-free queues work"]
    answer: 0
    why: "One thread avoids locks and context switches; parallelism comes from separate books per thread or machine."
  - q: "Why order events with sequencer-assigned numbers rather than wall-clock timestamps?"
    options: ["Reading wall clocks is too slow for microsecond latency targets", "Timestamps cannot be written to the journal in a replicated form", "One authoritative order makes replay and failover reproduce identical results"]
    answer: 2
    why: "A monotonically increasing sequence is the single order that deterministic replay depends on."
  - q: "Why can a hot standby take over without losing or duplicating trades?"
    options: ["The primary streams its in-memory book to the standby after every trade", "The engine is deterministic, so replaying the same journal gives an identical book", "Clients resubmit all of their open orders to the standby after a failover"]
    answer: 1
    why: "A deterministic function of the sequenced input means the standby resumes at the next sequence number."
---

## The problem

An exchange accepts buy and sell orders, matches them according to strict rules, and publishes the results, with **fairness, determinism and very low, predictable latency**. A bug or an unfair delay is a regulatory issue; a lost order is a financial one. Throughput targets are large (hundreds of thousands to millions of orders per second per market) and latency targets are measured in microseconds.

## Core concepts

- **Order**: a request to buy or sell a quantity of an instrument. A **limit order** names a price; a **market order** accepts the best available price.
- **Order book**: for each instrument, a list of **bids** (buy orders) sorted from highest to lowest price and **asks** (sell orders) from lowest to highest.
- **Matching**: when the best bid is at or above the best ask, a trade occurs. The standard rule is **price-time priority**: the best price first, and among equal prices the earliest order first.
- **Trade price** is normally the price of the resting (earlier) order.

**Example:** the book has asks 10.02 (500 shares, order A), 10.02 (300, order B placed later), 10.03 (800). A buy limit of 700 at 10.02 arrives. It matches A for 500 and B for 200 (price-time), leaving B with 100 resting; the trades are at 10.02.

## Requirements

- **Determinism**: the same input sequence must always produce the same output (essential for audit, replay and failover).
- **Total ordering** of all events per instrument.
- **Latency**: single-digit to tens of microseconds in the engine; low variance (no garbage-collection pauses).
- **Durability and recovery**: no accepted order lost; fast failover.
- **Fairness**: no participant is served early; sequencing rules are transparent.
- **Auditability and risk controls**: pre-trade risk checks, kill switches, full event history.

## The surprising design: a single-threaded core

Concurrency control with locks is slow and non-deterministic. The LMAX exchange architecture showed that a **single thread** running all business logic in memory, fed by a lock-free ring buffer (the Disruptor), can process millions of events per second, because it avoids locks, context switches and cache misses and keeps all state in one core's cache. Parallelism comes from **partitioning by instrument**: each instrument's order book is owned by exactly one thread (or one machine), so books never contend, and the system scales by adding books across cores and servers.

## Pipeline

1. **Gateways** terminate client connections (FIX or binary protocols), authenticate, validate messages and apply **pre-trade risk checks** (position, credit and price-band limits).
2. A **sequencer** assigns every inbound message a **monotonically increasing sequence number**, creating the single authoritative order of events, and writes it to a **journal** (a durable, replicated log).
3. The **matching engine** consumes the sequenced stream, applies each message to the in-memory order book deterministically, and emits events: acknowledgements, trades, order-book updates.
4. **Outbound distribution** publishes market data (public) and execution reports (private to participants) through multicast or low-latency feeds, with identical delivery timing to all subscribers for fairness.
5. **Clearing and settlement** systems receive trades asynchronously.

## Recovery and high availability by replaying the log

Because the engine is a deterministic function of the sequenced input, **state is recoverable by replay**: run a hot standby that consumes the same journal and holds an identical order book. If the primary fails, the standby takes over from the last sequence number processed; periodic **snapshots** of the book bound replay time. This is event sourcing (see that lesson) applied at extreme speed. Replication of the journal to a quorum before acknowledging gives durability without sacrificing determinism.

## Low-latency engineering

- Pre-allocated memory and object pools; no allocation or garbage collection on the hot path (or a runtime without a collector).
- Cache-friendly data structures: price levels in arrays or tree structures with contiguous queues of orders; avoid pointer chasing.
- Pin threads to cores, isolate them from interrupts, use kernel-bypass networking and hardware timestamps.
- Binary, fixed-layout messages instead of text or JSON.
- Measure latency distributions (p99.99), not averages; jitter is the enemy.

## A worked example

One instrument sees 200,000 messages per second at peak.

1. Gateways validate and risk-check orders (about 5 microseconds) and forward them to the sequencer.
2. The sequencer stamps sequence numbers and writes to a journal replicated to two other machines (about 20 microseconds with a fast network).
3. The matching thread processes each message in about 2 microseconds (a single-threaded loop easily handles 200,000 messages per second using about 40% of one core).
4. A standby engine replays the journal; the primary crashes at sequence 48,201,553; the standby resumes at 48,201,554 in under a second, and no client sees a lost or duplicated trade (clients reconcile by sequence).
5. An auditor replays the day's journal into a fresh engine and gets byte-identical trades.

## Common mistakes

- **Multi-threaded matching with locks**, causing latency jitter and non-determinism.
- **Using wall-clock timestamps for ordering** instead of sequence numbers.
- **Doing risk checks and logging in the matching loop.**
- **Unequal data delivery** to participants.
- **No replayable journal**, so recovery and audit rely on trust.
