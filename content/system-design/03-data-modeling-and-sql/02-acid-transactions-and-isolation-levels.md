---
title: "ACID Transactions and Isolation Levels"
short_title: "ACID and Isolation Levels"
tags: ["acid", "transactions", "sql", "databases"]
sources:
  - "PostgreSQL documentation on transaction isolation"
  - "Jim Gray, 'The Transaction Concept: Virtues and Limitations' (1981)"
---

## What ACID actually guarantees

ACID names four properties a database transaction is expected to provide:

- **Atomicity** — a transaction's operations either all succeed or all fail together; there's no partial-completion state visible to anyone else. Transferring money between two accounts (debit one, credit another) either both happen or neither does — never a state where the debit succeeded but the credit didn't.
- **Consistency** — a transaction moves the database from one valid state to another, respecting all defined constraints (foreign keys, unique constraints, check constraints). This is the database-level meaning of "consistency," distinct from the CAP theorem's use of the same word (covered in this track's CAP theorem lesson) — worth explicitly noting, since the two are frequently and understandably confused despite describing different things.
- **Isolation** — concurrent transactions shouldn't see each other's uncommitted, in-progress changes. How strictly this is enforced is genuinely tunable, covered in detail below.
- **Durability** — once a transaction commits, it survives a subsequent crash. This is typically achieved via a write-ahead log (mentioned in this track's storage engines lesson), where a commit isn't considered complete until the change is durably recorded, not just applied to an in-memory structure.

## Isolation is a spectrum, not a binary

Of the four ACID properties, isolation is the one with real, commonly-used, weaker-than-maximum options — because full isolation (as if every transaction ran completely alone, one at a time) is correct but expensive, serializing all concurrent work and destroying throughput. SQL defines four standard isolation levels, each allowing a specific category of anomaly the stricter levels prevent:

- **Read Uncommitted** — a transaction can see another transaction's uncommitted changes (a "dirty read"). Rarely used in practice, since it can read data that later gets rolled back and never actually existed from any consistent point of view.
- **Read Committed** — a transaction only sees committed data, but two reads of the same row within one transaction can return different values if another transaction committed a change in between (a "non-repeatable read"). This is the default isolation level in PostgreSQL and many other databases, since it's a reasonable balance of correctness and concurrency for most workloads.
- **Repeatable Read** — guarantees that if a transaction reads a row once, it'll see the same value if it reads that row again within the same transaction, even if another transaction commits a change to it in between. Still permits "phantom reads" — a query re-run within the same transaction can return additional rows that were inserted by another transaction, even though existing rows are stable.
- **Serializable** — the strictest level, guaranteeing that the outcome of concurrently-running transactions is equivalent to some serial (one-at-a-time) execution order. Prevents all the anomalies above, at the highest cost to concurrency — the database may need to abort and retry transactions that would violate this guarantee under concurrent execution.

## Why the default isn't always the right choice

Most applications run happily on the database's default isolation level (often Read Committed) without ever needing to think about this — but specific operations can silently produce wrong results under too-weak an isolation level, and the failure mode is subtle: no error, just an incorrect outcome that's hard to catch without specifically testing for concurrent access. A classic example: checking a bank account's balance is sufficient before a withdrawal, then performing the withdrawal, as two separate steps within a Read Committed transaction — another concurrent transaction could withdraw funds in between the check and the actual withdrawal, and Read Committed doesn't prevent this "check-then-act" race, since each individual read is consistent, just not the sequence of two reads relative to a concurrent write.

## Practical concurrency control: locking vs. optimistic approaches

- **Pessimistic locking** — a transaction explicitly locks a row before modifying it (`SELECT ... FOR UPDATE`), blocking other transactions from modifying (or, depending on lock type, even reading) it until the lock is released. Correct and simple to reason about, but reduces concurrency — other transactions wanting the same row have to wait.
- **Optimistic concurrency control** — instead of locking upfront, a transaction proceeds assuming no conflict will happen, then checks at commit time (often via a version number or timestamp column) whether the row changed since it was read; if so, the transaction is rejected and typically retried. Better concurrency for workloads where conflicts are actually rare, at the cost of needing explicit retry logic for the (hopefully uncommon) conflict case.

## A worked example

**Scenario:** an e-commerce checkout flow needs to decrement inventory count when an order is placed, avoiding overselling when many customers attempt to buy the last few units of a popular item simultaneously.

- **Naive Read Committed check-then-act** (check stock > 0, then decrement) has exactly the race condition described above — two concurrent checkouts can both see stock = 1, both proceed, and both decrement, resulting in -1 stock and an oversold item.
- **Fix with pessimistic locking**: `SELECT stock FROM products WHERE id = ? FOR UPDATE` locks the row for the duration of the transaction, so a second concurrent checkout attempting the same lock blocks until the first transaction commits or rolls back — guaranteeing the second checkout sees the updated (post-decrement) stock value, correctly failing if stock is now insufficient.
- **Alternative fix with an atomic conditional update**: `UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0`, checking the affected row count afterward — this avoids an explicit lock entirely by pushing the check-and-act into a single atomic database operation, often the simplest and highest-throughput fix for this specific pattern, since it doesn't hold a lock for the transaction's full duration.

## Common mistakes

- **Assuming the database's default isolation level prevents all race conditions.** As shown above, Read Committed (the common default) still permits check-then-act races — a correctness issue that only manifests under real concurrent load, making it easy to miss in single-user testing.
- **Reaching for Serializable isolation everywhere "to be safe," without measuring the throughput cost.** Serializable is correct but expensive under contention; most correctness problems attributed to weak isolation are actually fixable with a targeted lock or atomic update on the specific operation that needs it, without paying Serializable's cost application-wide.
- **Confusing ACID's "Consistency" with CAP's "Consistency."** They describe genuinely different properties (constraint satisfaction within a single node vs. agreement across distributed replicas) despite sharing a name — conflating them leads to real confusion when reasoning about a distributed database that needs both.
