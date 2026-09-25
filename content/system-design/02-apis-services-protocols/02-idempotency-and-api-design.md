---
title: "Idempotency and Safe API Design"
short_title: "Idempotency in API Design"
tags: ["apis", "idempotency", "reliability", "protocols"]
sources:
  - "Stripe API documentation on idempotent requests"
  - "RFC 7231, section 4.2.2 (HTTP method idempotency definitions)"
---

## What idempotency actually means

An operation is idempotent if performing it multiple times has the same effect as performing it once. This matters enormously in distributed systems because networks are unreliable — a client can send a request, the server can process it successfully, and the response can get lost on the way back. From the client's perspective, this looks identical to the request never arriving at all, and the only safe recovery is to retry. Whether that retry is safe depends entirely on whether the operation is idempotent.

## Which HTTP methods are idempotent by convention

- **GET, PUT, DELETE** — idempotent by HTTP specification convention. Fetching a resource twice returns the same thing; setting a resource to a specific state twice leaves it in that same state; deleting an already-deleted resource is still "deleted" (typically returning success or a 404, either way with no further side effect).
- **POST** — explicitly *not* idempotent by convention, because POST typically means "create a new thing" — retrying a POST naturally tends to create a second thing, which is rarely what a retry actually intends.

This convention is a contract, not an enforced guarantee — a `PUT` endpoint implemented with side effects that aren't actually idempotent (e.g., one that increments a counter as a side effect of "setting" a value) violates the convention silently, and clients relying on the convention for safe retries will be wrong without any obvious signal that something's off.

## Why POST needs its own solution: idempotency keys

Since POST requests (payments, order creation, any "do this action" endpoint) are inherently the risky case for retries, and they're also often the most consequential to get wrong (charging a customer twice is a worse failure than a lost GET request), APIs that need safe retries on POST commonly implement **idempotency keys**: the client generates a unique key (often a UUID) for a logical operation and sends it with the request. The server records which keys it has already processed and, on seeing a repeated key, returns the original response without re-executing the operation's side effects.

This turns a fundamentally non-idempotent operation (charge $50) into an idempotent one from the client's perspective (charge $50, but only once, no matter how many times this specific request is retried) — the client can safely retry on any ambiguous failure (timeout, connection drop, 5xx) without needing to first figure out whether the original request actually succeeded server-side.

## Where idempotency records need to live, and for how long

Storing "which idempotency keys have been processed, and what was the resulting response" needs to be durable and fast to check — typically a database table or a fast key-value store, keyed by the idempotency key, storing enough of the original response to replay it exactly on a duplicate request. This record needs an expiration policy (Stripe, for instance, expires idempotency keys after 24 hours) — keeping them forever is unnecessary storage growth, but expiring them too soon reopens the window for a legitimately-delayed retry (from a client that queued the retry for longer than expected) to be treated as a new request and executed twice.

## A worked example

**Scenario:** a payments API where a client's network connection drops right after sending a "charge $50" request, and the client can't tell whether the charge succeeded before the connection dropped.

- **Without an idempotency key**: the client has no safe choice. Retrying risks a double charge if the original request actually succeeded server-side before the response was lost; not retrying risks the customer never being charged if the original request actually failed. Either way, the client is guessing.
- **With an idempotency key**: the client generates one key for this logical charge attempt and includes it on both the original request and any retry. If the original request already succeeded, the server sees the repeated key, skips re-charging, and returns the same success response as before — the client can retry freely and safely, with the server guaranteeing the charge only happens once regardless of how many times the same key arrives.
- **The key's scope matters**: it needs to be unique per logical operation (one key per distinct $50 charge intent), not reused across genuinely different charges — reusing a key for a different, later purchase would incorrectly return the first charge's cached response instead of processing the new one.

## Common mistakes

- **Assuming a POST endpoint is safe to retry blindly**, without the endpoint actually implementing idempotency-key support — this is exactly the double-charge, double-order, double-email scenario that idempotency keys exist to prevent, and skipping it isn't a minor gap for anything with a real-world side effect.
- **Building a `PUT` or `DELETE` endpoint that isn't actually idempotent** despite the convention implying it should be — silently breaking client assumptions about safe retries, since clients built against the HTTP convention won't know to guard against it.
- **Expiring idempotency key records too aggressively.** A key expired too soon means a legitimately delayed retry (a client that backed off longer than the server's expiration window) gets treated as a brand-new request, re-executing the side effect the mechanism was supposed to prevent.
