---
title: "Designing an E-Commerce Inventory and Checkout System"
short_title: "E-Commerce Inventory and Checkout"
tags: ["e-commerce", "inventory", "checkout", "saga", "consistency"]
sources:
  - "Garcia-Molina and Salem, 'Sagas' (ACM SIGMOD 1987)"
  - "Public engineering articles on inventory reservation and flash-sale design"
  - "Kleppmann, Designing Data-Intensive Applications (2017), chapters on transactions and distributed consistency"
banner:
  layout: line
  nodes:
    - [user, "shopper"]
    - [db, "inventory"]
    - [lock, "reserve"]
    - [server, "checkout"]
predict:
  question: "In the sneaker sale, 500 reservations are made and 40 expire unpaid. What happens to those 40 pairs?"
  options: ["They stay reserved until a nightly job clears them", "They are released back to the pool for the next buyers in line", "They are counted as sold because the stock was already decremented"]
  answer: 1
  why: "Expired reservations are released, returning stock to the pool for waiting buyers."
check:
  - q: "Why reserve stock with an expiry instead of decrementing only when payment succeeds?"
    options: ["Payment-time decrements need a distributed transaction, which is too slow", "The database cannot make a decrement atomic at payment time", "Two customers could both pay for the last item, and expiry frees abandoned reservations"]
    answer: 2
    why: "Reservations prevent double payment for the last item, and expiry avoids locking stock for abandoned checkouts."
  - q: "Why model checkout as a saga rather than one distributed transaction?"
    options: ["Each service owns its data, so compensating actions undo steps if a later one fails", "Sagas give stronger isolation than transactions, so no half-done state is ever visible", "Sagas are faster because they skip persisting progress between steps"]
    answer: 0
    why: "No single transaction spans the services, so local transactions with compensations handle failures."
  - q: "Why store the charged price on the order line rather than recomputing it from the catalog?"
    options: ["Catalog lookups are served from slow caches, making recomputation expensive", "Recomputing later would rewrite history, since catalog prices change", "Stored prices let checkout skip re-validating the cart's prices and discounts"]
    answer: 1
    why: "Prices change, so recomputing from the live catalog would alter past orders."
---

## The core tension

Browsing a catalog is a read-heavy, cache-friendly workload where slightly stale data is fine. **Checkout is the opposite**: it writes, it moves money, and it must never sell stock that does not exist or charge for an order that cannot be fulfilled. A good design makes browsing fast and approximate, and checkout slow, careful and exact.

## Separating the read path from the write path

- **Catalog and search** serve product details, images and "in stock" hints from caches, a search index and a CDN. The stock shown is an approximation, such as "in stock", "low stock", or "out of stock", refreshed every few seconds.
- **Inventory service** owns the exact available quantity and is consulted at the moments that matter: adding to a cart (optionally) and definitely at checkout.

A page that says "5 left" may be stale by the time the customer clicks buy, and that is acceptable as long as the **checkout step enforces truth**.

## Inventory as reservations

Decrementing stock when an order is paid is too late (two customers can both pay for the last item), and decrementing at add-to-cart locks stock for abandoned carts. The usual compromise is a **reservation with expiry**:

1. At the start of checkout, the system **reserves** the requested quantity. Available stock drops by that amount, and a reservation record is created with a time limit (for example 10 minutes).
2. If payment succeeds, the reservation is **committed** and becomes a permanent decrement.
3. If payment fails, the customer abandons, or the time limit passes, the reservation is **released** and stock returns to the pool.

A background job sweeps expired reservations. Stock is thus divided into three buckets: available, reserved, and sold.

## Preventing overselling

Reserving stock must be atomic. The classic bug is read-then-write: two requests both read "1 left" and both decrement. Safe approaches:

- **Conditional update:** `UPDATE stock SET available = available - 1 WHERE sku = ? AND available >= 1`, and check that a row changed. The database serializes concurrent updates to the same row.
- **Optimistic concurrency** with a version column, retrying on conflict.
- **A single-writer partition per SKU**, where all updates to a given product go through one serialized worker, useful for extremely hot items.

For flash sales on a single popular item, the hot row becomes a bottleneck. Mitigations include splitting the stock into several **sub-counters** (shards) and picking one at random, queueing requests so the system accepts only as many as there is stock for, and shedding excess traffic early with a clear "sold out" response.

## Checkout as a saga

A checkout touches several services: inventory, pricing and promotions, payment, order, shipping, notifications. Each owns its data, so a single database transaction across them is not available. Instead use a **saga**: a sequence of local transactions, each with a **compensating action** that undoes it if a later step fails.

Example sequence: reserve stock, create order (pending), charge payment, confirm order, trigger fulfilment. If payment fails, compensate by releasing the reservation and cancelling the order.

A saga can be run by an **orchestrator** that explicitly drives each step and tracks state, or by **choreography** where services react to each other's events. Orchestration is easier to reason about and debug for a flow like checkout. Whichever you pick, steps must be **idempotent** and the saga's progress durable, so a crash resumes instead of leaving half-done state.

## Pricing and cart consistency

Prices and promotions change. Re-validate the cart's prices and applicable discounts at checkout, and show the customer the final total **before** charging. Store the price actually charged on the order line, never recompute it later from the current catalog price.

## A worked example

**Scenario:** a limited sneaker release with 500 pairs and 50,000 simultaneous buyers.

- The catalog page is static and CDN-cached; a virtual waiting room admits a controlled number of buyers into checkout at a time, protecting the inventory service.
- Stock is split into 10 sub-counters of 50. A checkout request picks one sub-counter and runs the conditional decrement. If it is empty, it tries another before reporting sold out.
- Each successful reservation lasts 5 minutes. Of 500 reservations, 40 expire unpaid and are released, becoming available to the next buyers in line.
- Payment success commits the reservation and emits an order-confirmed event; failure triggers the compensating release.

## Common mistakes

- **Read-then-write stock updates**, causing overselling under concurrency.
- **Decrementing only on payment**, or **at add-to-cart with no expiry**.
- **Trying to wrap checkout in a distributed transaction** across services instead of a saga with compensation.
- **Non-idempotent steps**, so retries double-reserve or double-charge.
- **Recomputing historical prices from the live catalog**, rewriting history.
- **Letting the hot SKU's row take unlimited traffic** instead of queuing and shedding.
