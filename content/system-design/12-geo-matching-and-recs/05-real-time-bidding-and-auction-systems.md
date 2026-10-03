---
title: "Real-Time Bidding and Auction Systems"
short_title: "Real-Time Bidding and Auctions"
tags: ["advertising", "auctions", "low-latency", "real-time", "matching"]
sources:
  - "IAB Tech Lab, OpenRTB specification (bid request and bid response model)"
  - "Vickrey, 'Counterspeculation, Auctions, and Competitive Sealed Tenders' (1961), on second-price auctions"
  - "Public engineering write-ups on ad exchange and demand-side platform latency budgets"
---

## The problem in one sentence

When a page or app loads, an ad slot becomes available and **many buyers compete for it, and the winner has to be chosen and the ad served within roughly 100 milliseconds** — before the user notices a blank space. Real-time bidding (RTB) is that auction, run billions of times a day.

Everything in the design follows from the deadline. There is no time to look things up slowly, retry, or run a heavy model. Every component either answers inside its budget or is ignored.

## The actors and the flow

- **Publisher / SSP (supply-side platform)** — owns the slot and wants the highest price.
- **Ad exchange** — runs the auction. It receives the slot, fans it out, collects bids and picks a winner.
- **DSP (demand-side platform)** — represents advertisers. It receives a bid request, decides whether and how much to bid, and replies.

The flow is: the slot becomes available, the exchange builds a **bid request** (the page, a device and user hint, the slot size, a floor price) and sends it to dozens or hundreds of DSPs in parallel. Each DSP has a strict timeout, typically a few tens of milliseconds. The exchange collects whatever bids arrive in time, runs the auction rule, and returns the winning creative.

## The latency budget is the architecture

Suppose the whole thing must finish in 120 ms. A reasonable split is roughly: network to and from the exchange, 30 ms; exchange fan-out and collection, a timeout of about 60 ms for bidders; auction and response, 10 ms. That leaves a DSP perhaps 30 to 40 ms to decide.

Inside the DSP, this forces:

- **Everything hot lives in memory.** Campaign definitions, budgets, targeting rules and user-segment lookups are held in RAM or a local cache, not fetched from a remote database per request.
- **Precomputed, not computed.** A bid model is evaluated with a small, fast model. Heavy training happens offline; serving uses compact weights.
- **Fail by dropping.** A DSP that cannot answer in time simply does not bid. The exchange never waits for the slowest participant.
- **No-bid is a valid, cheap answer.** Most requests are not worth bidding on, and a fast "pass" saves resources.

## Auction rules

- **First-price** — the winner pays what it bid. Simple, but it invites bid shading: bidders try to bid just enough to win, which requires modelling what others will bid.
- **Second-price (Vickrey)** — the winner pays the second-highest bid (plus a small increment). Truthful bidding is the best strategy for each bidder, which made it the long-standing default. The industry has since moved heavily toward first-price, so DSPs now do explicit bid shading.

A **floor price** from the publisher sets the minimum. If no bid clears the floor, the slot goes unsold or falls back to a direct deal.

## Budget pacing and the double-spend problem

An advertiser with a $1,000 daily budget should not burn it in the first ten minutes. **Pacing** spreads spend over the day, usually by adjusting the probability of bidding or the bid multiplier so spend tracks a target curve.

The hard part: hundreds of bidder instances win auctions concurrently, and each cannot consult one central counter on every request. The usual compromise is **local budget allocation with periodic reconciliation** — each bidder gets a slice of budget to spend locally, and a coordinator rebalances slices every few seconds. A small overspend is accepted as the price of speed, and it is bounded by the slice size.

## A worked example

**Scenario:** an exchange handles 200,000 requests per second and fans each out to 50 DSPs.

- That is **10 million outbound bid requests per second**, so the exchange runs many stateless fan-out nodes, partitioned by request ID, and uses persistent connections rather than opening one per call.
- A DSP receives its share, checks a 1 ms in-memory rule filter, and no-bids on about 90 percent. For the remaining 10 percent it runs a model in about 5 ms and returns a bid with a price.
- The exchange waits at most 60 ms, takes the bids that arrived, applies a $0.50 CPM floor, picks the highest, and logs the result asynchronously to a stream for billing and analytics.
- Billing and reporting are **not** in the hot path. Events go to a durable log and are reconciled later, which keeps the auction itself small.

## Common mistakes

- **Calling a remote database inside the bid path.** One slow lookup blows the whole budget. Preload and cache, and accept slightly stale data.
- **Treating timeouts as errors to retry.** A late bid is a lost bid; retrying only adds load at the worst moment. Drop and move on.
- **One global budget counter.** It becomes a bottleneck and a single point of failure. Allocate slices and reconcile.
- **Doing billing inline.** Write an event and let a pipeline settle it; the auction should never wait on accounting.
- **Ignoring fraud and invalid traffic.** Bots can drain budgets quickly; filtering belongs early and cheap, before the model runs.
