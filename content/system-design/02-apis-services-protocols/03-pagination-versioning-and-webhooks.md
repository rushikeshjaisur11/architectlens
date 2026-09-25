---
title: "Pagination, API Versioning, and Webhooks"
short_title: "Pagination, Versioning, and Webhooks"
tags: ["apis", "pagination", "versioning", "webhooks"]
sources:
  - "Stripe API documentation on pagination and versioning practices"
  - "GitHub API documentation on cursor-based pagination"
---

## Pagination: why "just return everything" breaks down

An endpoint returning a list of resources (`GET /orders`) can't reasonably return every matching row in one response once a dataset grows large — the response payload becomes unwieldy, and the underlying query becomes expensive. Pagination splits results into manageable pages, but the specific pagination technique chosen has real correctness implications, not just a size-limiting one.

- **Offset-based pagination** (`?offset=100&limit=20`) — simple to implement and understand, but breaks under concurrent modification: if a row is inserted or deleted between two paginated requests, offsets shift, and a client can see a duplicate row across two pages or miss a row entirely, since "the 100th row" isn't a stable identity — it's a position that changes as the underlying data changes.
- **Cursor-based pagination** (`?after=<opaque_cursor>`) — the cursor encodes a stable reference point (typically the last seen row's unique ID or a composite sort key), and the next page is defined relative to that specific row rather than a numeric position. This is stable under concurrent insertions/deletions elsewhere in the dataset — a row inserted before the cursor's position doesn't shift what "after this specific row" means. Most modern high-scale APIs (GitHub, Stripe) use cursor-based pagination specifically for this correctness property, not just for performance, even though performance is also generally better since it avoids the "skip N rows" cost that offset-based pagination incurs on large offsets.

## API versioning: managing change without breaking existing clients

Once an API has real external consumers, changing its behavior (adding a required field, changing a response shape, removing a deprecated field) risks breaking clients that depend on the previous behavior — and unlike an internal service where you control every caller, a public API's callers are often entirely outside your control, making a breaking change a real, hard-to-coordinate cost.

- **URL path versioning** (`/v1/orders`, `/v2/orders`) — explicit and easy to understand from the URL alone, but means maintaining genuinely separate code paths (or careful conditional logic) for each supported version, and clients must explicitly migrate to a new URL to get new behavior.
- **Header-based versioning** (a custom header like `API-Version: 2026-01-15`) — keeps URLs stable across versions, and some APIs (Stripe notably) use date-based version strings tied to when a client integrated, letting the platform evolve the "current" behavior for new integrations while explicitly pinning existing integrations to the behavior they were built against, unless they deliberately opt into a newer version.
- **No formal versioning, strict backward compatibility instead** — never make a breaking change; only add new optional fields or new endpoints, never remove or change the meaning of existing ones. This avoids the operational overhead of maintaining multiple versions entirely, at the cost of real constraint on API evolution — fixing a genuinely bad original design decision becomes much harder without ever being able to make a breaking change.

The right choice depends on how much control you have over your API's consumers: an internal API with a small number of known, coordinated callers can tolerate a more aggressive, less formally-versioned evolution process than a public API with thousands of independent, uncoordinated integrations.

## Webhooks: inverting the request direction for event notification

Most of this lesson concerns request-response APIs, where the client initiates every interaction. **Webhooks** invert this: instead of a client repeatedly polling "has anything changed," the server proactively sends an HTTP request to a client-provided URL when a relevant event occurs (a payment succeeded, an order shipped) — eliminating the latency and wasted-request cost of polling, similar in spirit to this track's realtime-and-feeds lesson's point about push versus pull tradeoffs, but applied at the level of server-to-server integration rather than a live user-facing connection.

Webhooks introduce their own reliability considerations that a request-response API doesn't have to the same degree: the receiving endpoint might be temporarily down when the webhook fires, so the sending system needs retry logic (with backoff, per this track's production-reliability-adjacent reasoning) for failed webhook deliveries; and since a webhook can be delivered more than once under retry, the receiving endpoint needs to handle delivery idempotently (directly applying this track's idempotency lesson, but from the *receiving* side of an inherently at-least-once delivery mechanism) — a well-designed webhook payload includes a unique event ID specifically so receivers can deduplicate reliably.

## A worked example

**Scenario:** a payments platform's public API needs to let integrators list historical transactions (potentially millions per account) and receive real-time notification when a payment's status changes.

- **Cursor-based pagination** for the transaction-listing endpoint, since offset-based pagination's instability under concurrent new transactions being created (a very real, constant occurrence for an active payments account) would cause integrators to see duplicate or skipped transactions depending on exactly when they paginated relative to new transaction creation — a correctness bug, not just a minor inconvenience, for a domain where transaction completeness matters.
- **Date-based header versioning**, following the Stripe-style pattern, so existing integrations continue receiving the exact response shape they were built against indefinitely, while the platform can still evolve the "current" API shape for new integrations without needing to coordinate a breaking migration across every existing integrator.
- **Webhooks with a unique event ID and documented retry behavior**: a payment-status-change webhook includes a unique `event_id`, and the receiving integration is explicitly documented as needing to handle repeated deliveries of the same `event_id` idempotently — directly following this track's idempotency lesson's pattern, since webhook delivery is fundamentally an at-least-once mechanism, not exactly-once.

## Common mistakes

- **Using offset-based pagination for a dataset with frequent concurrent writes**, producing subtle, hard-to-notice correctness bugs (duplicate or missing rows across pages) that only manifest under real concurrent load, not in simple manual testing.
- **Making a breaking API change without any versioning strategy**, silently breaking every existing integration at once rather than providing a controlled migration path.
- **Building webhook-receiving logic that isn't idempotent**, assuming each webhook event will only ever be delivered once — this breaks under the very real retry scenario where a receiving endpoint's acknowledgment gets lost even though it actually processed the event successfully, triggering a redelivery of an already-handled event.
