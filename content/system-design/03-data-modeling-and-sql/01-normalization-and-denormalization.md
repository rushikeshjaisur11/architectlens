---
title: "Normalization and Denormalization: Choosing Your Schema's Tradeoff"
short_title: "Normalization vs Denormalization"
tags: ["data-modeling", "sql", "databases", "foundations"]
sources:
  - "Edgar F. Codd, 'A Relational Model of Data for Large Shared Data Banks' (1970)"
  - "PostgreSQL documentation, chapter on data definition and normalization"
---

## What normalization actually buys you

Normalization means structuring tables so each piece of data lives in exactly one place. A normalized schema (typically aiming for Third Normal Form, or 3NF) stores a customer's address once, in a `customers` table, and every order references it by `customer_id` rather than copying the address into every `orders` row.

The payoff is integrity: update the address once, and every order that references it sees the change instantly. There's no risk of one row saying "123 Main St" and another saying "123 Main Street" for the same customer because a copy went stale.

The cost is joins. Reading an order with its customer's address means joining two tables. Reading a report across a million orders with their customers means a million-row join, which gets expensive as tables grow — especially if the join key isn't well-indexed or the tables live on different shards.

## What denormalization actually buys you

Denormalization deliberately duplicates data to avoid joins. Instead of looking up the customer's address at read time, you copy `customer_name` and `shipping_address` directly onto the `orders` row when it's created.

The payoff is read speed — one table, one query, no join. This matters most for read-heavy paths where the data rarely changes after creation (an order's shipping address at time of purchase is a good candidate; a user's current email address is a worse one, since it's fetched fresh each time and duplicating it multiplies the update surface).

The cost is write complexity and staleness risk. If the customer's name legitimately needs to change on old records too (rare) or if you duplicated something that *does* change often (common mistake), you now have an update-anomaly problem: N copies to update instead of one, and any copy you miss silently drifts out of sync.

## The rule of thumb

Normalize by default. Denormalize deliberately, for a specific read path, once you can point to the actual query that's slow and explain why an index or a join optimization won't fix it. Denormalization introduced speculatively — "this might be slow someday" — adds write complexity for a performance problem that may never materialize.

A useful test before denormalizing a field: **does this value change after the row is created, and if it does, do old rows need to reflect the new value?** Order shipping address: no (it's a snapshot of a moment, correctly duplicated). Customer's current tier/plan: yes (duplicating this means every plan change needs a backfill across every referencing row, which is exactly the anomaly normalization exists to prevent).

## A worked example

**Scenario:** an e-commerce `orders` table needs to display, for each order, the customer's name and the product names in that order.

**Normalized version:**

```sql
orders(id, customer_id, created_at)
order_items(order_id, product_id, quantity)
customers(id, name, email)
products(id, name, price)
```

Listing an order's contents requires joining `orders` → `order_items` → `products`, and `orders` → `customers` for the buyer's name. Correct, but a dashboard rendering 500 recent orders with names and product summaries pays for that join 500 times (or once, batched — but still non-trivial SQL).

**Denormalized read path**, without abandoning the normalized write model:

```sql
order_summary(order_id, customer_name, product_names_json, created_at)
```

populated by a trigger or an application-level write whenever an order is placed, kept purely as a read-optimized cache table alongside the source-of-truth normalized tables. The dashboard reads from `order_summary` directly — no joins — while the normalized tables remain the system of record for anything that needs a correct update (refunds, inventory adjustments, customer profile edits).

This pattern — normalized source of truth, denormalized read-optimized copy — is common enough to have its own name in some systems: a *materialized view*, which many databases (Postgres, among others) can maintain for you automatically on a refresh schedule, instead of hand-rolled triggers.

## Common mistakes

- **Denormalizing everything "for performance" before measuring anything.** Most reads are fast enough with proper indexes; premature denormalization just adds update-anomaly risk for no measured benefit.
- **Denormalizing a field that changes frequently and needs retroactive correctness** (e.g., duplicating a "current subscription tier" onto every historical event row) — this creates a background-job requirement to keep copies in sync that often gets forgotten.
- **Forgetting that a materialized view or cache table can go stale** if the refresh mechanism (trigger, cron, event handler) silently breaks — a denormalized table needs the same operational attention as any other derived, cached data.
