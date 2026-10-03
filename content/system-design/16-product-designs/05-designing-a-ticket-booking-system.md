---
title: "Designing a Ticket-Booking System"
short_title: "Ticket-Booking System"
tags: ["booking", "seat-inventory", "concurrency", "holds", "system-design"]
sources:
  - "Public engineering articles on seat holds and flash-sale queues for event ticketing"
  - "PostgreSQL documentation on row-level locking and SELECT ... FOR UPDATE SKIP LOCKED"
  - "Kleppmann, Designing Data-Intensive Applications (2017), chapters on transactions and write skew"
banner:
  layout: line
  nodes:
    - [user, "buyer"]
    - [lock, "seat hold"]
    - [server, "checkout"]
    - [db, "orders"]
predict:
  question: "Two buyers run the conditional hold update for seat 14B in the same millisecond. What does the second buyer's update report?"
  options: ["One row updated, so both hold the seat until payment resolves it", "A deadlock error, so both requests must retry", "Zero rows updated, so they see that the seat was just taken"]
  answer: 2
  why: "The database serializes the updates; the second finds the seat held and unexpired, so it matches no rows."
check:
  - q: "Why do the availability check and hold in one conditional UPDATE instead of reading in application code first?"
    options: ["The read-then-write gap lets two buyers both succeed, which the single update closes", "Application code cannot read the seat table without taking a table-wide lock", "A single update makes the hold last longer than a two-step check would"]
    answer: 0
    why: "The database serializes concurrent updates to a row, so only one conditional update wins."
  - q: "Why should the authoritative seat hold not live only in a TTL cache?"
    options: ["Caches cannot expire keys, so abandoned holds would lock seats forever", "A cache restart can lose holds, so the database must remain the source of truth", "Caches cannot do single-key atomic updates, so double booking is unavoidable"]
    answer: 1
    why: "A volatile hold lost on restart creates inconsistencies unless the sale re-validates against durable storage."
  - q: "Why use a virtual waiting room rather than letting the on-sale spike reach the booking database?"
    options: ["It removes the need for seat holds because admitted users never compete", "It makes seat availability exactly consistent for every user in the queue", "It turns a destructive spike into a controlled stream the backend can handle"]
    answer: 2
    why: "Admitting users at a sustainable rate protects the booking database from the thundering herd."
---

## What makes booking hard

Selling tickets looks like checkout but differs in three ways:

1. **Every unit is unique.** A seat (section C, row 5, seat 12) is a specific resource, not an interchangeable count of stock.
2. **Demand is violently bursty.** Tens of thousands of people hit the same few thousand seats within seconds of release.
3. **Overselling is unacceptable.** Two people holding a ticket to the same seat is a visible, public failure.

## Requirements and scale

Functional: browse events and seat maps, select seats, hold them while paying, complete purchase, and release unpurchased seats. Non-functional: strong correctness on seat assignment, fairness, and survival of the opening-minute spike. Typical sizing: 50,000 concurrent users competing for 20,000 seats, with the on-sale moment generating most of the day's traffic in a few minutes.

## The seat state machine

Each seat is in one of three states: **available**, **held** (temporarily reserved for a specific user until an expiry time), or **sold**. Transitions:

- available to held: user selects the seat.
- held to sold: payment succeeds before the hold expires.
- held to available: payment fails, user abandons, or the hold expires.

The hold is the key mechanism. It gives the user a fair window to pay (commonly 5 to 10 minutes) without blocking the seat forever.

## Preventing double booking

The guarantee is made at the **database row for each seat**, using an atomic conditional update:

```sql
UPDATE seats
SET status = 'held', held_by = :user, hold_expires = now() + interval '8 minutes'
WHERE seat_id = :seat
  AND (status = 'available' OR (status = 'held' AND hold_expires < now()));
```

If one row was updated, the hold succeeded; if zero, someone else got there first. The database serializes concurrent updates to that row, so only one wins. Multi-seat selections should be acquired in a **consistent order** (for example by seat ID) within one transaction to avoid deadlocks, and either all seats are held or none.

Do not rely on checking availability in application code and then updating. That read-then-write gap is precisely where two buyers both succeed.

For finding free seats among many candidates ("any two adjacent seats in this section"), queue workers can use `SELECT ... FOR UPDATE SKIP LOCKED`, which skips rows other transactions have already locked, avoiding contention on the same few rows.

## Expiring holds

Expired holds must return seats to the pool. Two mechanisms work together:

- **Lazy check:** the conditional update above treats an expired hold as available, so correctness does not depend on a cleaner running.
- **Background sweeper:** periodically resets expired holds so the seat map shows accurate availability and downstream counts stay correct.

Holding in a cache with a TTL is tempting, but the database remains the source of truth for the final sold state; a purely in-cache hold that is lost on restart can create inconsistencies unless the sale commit re-validates against durable storage.

## Surviving the opening spike

When tickets go on sale, the system faces a thundering herd. Standard defenses:

- **Virtual waiting room / queue.** Place arriving users in a queue and admit them to the booking flow at a rate the backend can handle. This turns a destructive spike into a controlled stream and can be made fair with randomized or first-come ordering.
- **Static seat map from cache; dynamic availability separately.** The seat layout rarely changes and is CDN-cached. Only the small availability layer is dynamic, and it can be slightly stale, updated by push or short polling.
- **Rate limiting and bot defense.** Scalpers and bots can swallow inventory; apply per-user limits, CAPTCHA or verification, and caps on tickets per order.
- **Shard by event.** One hot event should not degrade others, so partition data and capacity per event.

## Payment and completion

When the user pays, the order service re-checks that the hold is still valid, charges using an **idempotency key**, then converts held to sold in the same logical operation. If payment succeeds but the hold had just expired and been taken by someone else, the system must refund automatically and apologize. Making the hold-expiry check and the sold update **one atomic conditional update** shrinks that window to nothing.

Issue tickets only after the sold state is committed, with unique, verifiable codes (signed tokens or barcodes) to prevent duplication.

## A worked example

**Scenario:** two users click seat 14B within the same millisecond.

- Both requests run the conditional update. The database processes them in some serial order: the first changes the row from available to held and reports one row affected; the second finds the status is held with an unexpired time, matches no rows, and reports zero.
- The second user immediately sees "that seat was just taken" and is returned to the seat map, which refreshes.
- The first user has eight minutes. They pay at minute six, and the system updates held to sold, conditioned on `held_by` equaling that user and the hold not having expired.

## Common mistakes

- **Read-then-write availability checks**, producing double bookings.
- **No hold expiry**, letting abandoned sessions lock seats forever.
- **Putting the authoritative hold only in a volatile cache.**
- **Locking seats in inconsistent order**, causing deadlocks on multi-seat orders.
- **Letting the full spike hit the booking database** instead of queuing admissions.
- **Charging before verifying the hold is still valid**, forcing refunds.
