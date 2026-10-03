---
title: "Distributed Locks: Coordinating Exclusive Access Across Machines"
short_title: "Distributed Locks"
tags: ["distributed-systems", "locks", "coordination"]
sources:
  - "Martin Kleppmann, 'How to do distributed locking' (2016 blog post, critiquing the Redlock algorithm)"
  - "ZooKeeper documentation on distributed locks and leader election recipes"
  - "Amazon Web Services, 'Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region' (October 2025), aws.amazon.com/message/101925 (fetched October 2026)"
predict:
  question: "A job's lock TTL is 10 minutes but the job runs 12. A second instance acquired the lock at minute 10 and already wrote its result. The storage layer checks fencing tokens. What happens to the first instance's write?"
  options:
    - "Storage rejects it because its token is lower"
    - "Both writes succeed and the later one silently overwrites"
    - "The lock service cancels it once the TTL lapses"
  answer: 0
  why: "The resource rejects any operation with a token lower than the highest it has seen, so the stale holder cannot corrupt the result."
check:
  - q: "What is the trade-off in setting a longer lock TTL?"
    options:
      - "A longer TTL cuts duplicate-work risk but a crashed holder then blocks others longer before release"
      - "A longer TTL is strictly safer, because crashed holders release immediately regardless"
      - "A shorter TTL is strictly safer, since the holder can always renew it in time"
    answer: 0
    why: "Too short risks the lock expiring mid-work, too long delays recovery after a crash."
  - q: "Why add fencing tokens rather than trying to build a better lock?"
    options:
      - "A well-built lock can be made unbreakable, but tokens are cheaper to implement"
      - "Tokens stop the holder from pausing, which is the real cause of double-holding"
      - "A long pause can outlast any TTL, so the resource itself must reject stale holders"
    answer: 2
    why: "Pauses are external to the lock code, so correctness has to be checked where the effect happens."
  - q: "Why store a unique value in the lock key and check it on release?"
    options:
      - "It extends the TTL each time the holder checks it, keeping the lock alive during long work"
      - "It lets the holder delete only its own lock, not one a new holder acquired after expiry"
      - "It guarantees a fencing order, so the resource can reject stale writes without extra work"
    answer: 1
    why: "Otherwise a late holder could release the new holder's lock after its own had expired."
---

## Why a single-machine lock doesn't translate to distributed systems

A mutex on a single machine works because the operating system guarantees mutual exclusion within one process's memory space, with no ambiguity about whether a lock is held. A **distributed lock** tries to provide the same guarantee — only one of several nodes across a network can hold the lock at a time — but network partitions, clock drift, and process pauses (garbage collection, for instance) mean the guarantees are fundamentally weaker and harder to reason about than a local mutex, and treating a distributed lock as equivalent to a local one is a common source of subtle production bugs.

## The classic use case: preventing duplicate work

A common reason to reach for a distributed lock: multiple instances of a service (for redundancy) need to ensure only one of them performs a specific periodic task at a time — a scheduled job, a batch process, a cleanup task — to avoid duplicate or conflicting work if several instances happen to trigger it simultaneously. The lock ensures only the instance that acquires it proceeds; others skip or wait.

## Implementing a basic distributed lock with a single Redis node

A simple approach: `SET lock_key unique_value NX PX 30000` — set a key only if it doesn't already exist (`NX`), with an automatic expiration (`PX`, in milliseconds) so the lock releases itself even if the holder crashes without explicitly releasing it. The `unique_value` (often a UUID generated per lock attempt) matters for safe release: when releasing, the holder checks that the stored value still matches its own unique value before deleting the key, preventing a scenario where the lock expired, a different process acquired it, and the original (now-late) holder accidentally releases the *new* holder's lock instead of its own already-expired one.

## Why this simple approach has real failure modes

- **The expiration/work-duration mismatch.** If the lock's TTL is shorter than how long the actual protected work takes, the lock can expire while the original holder is still working, letting a second process acquire the same lock and start duplicate work concurrently — exactly the scenario the lock was meant to prevent. Setting a longer TTL "to be safe" trades this risk for a different one: a crashed holder now blocks everyone else for longer before the lock self-releases.
- **Process pauses.** A holder that acquires the lock, then experiences a long pause (a garbage collection stall, an OS-level scheduling delay) longer than the lock's TTL, may resume execution believing it still holds the lock — while another process has already acquired it after the TTL expired. Both processes now believe they hold the lock simultaneously, which is exactly the failure the lock exists to prevent, and this can happen even with completely correct implementation of the acquire/release logic, since the pause is external to the lock code itself.
- **Single point of failure.** A lock backed by a single Redis instance is only as available as that instance — if it goes down, no new locks can be acquired (or, depending on failover configuration, a failover to a replica that hadn't yet received the latest lock state could briefly allow two processes to both believe they hold the same lock).

## Fencing tokens: the more robust fix

Because the pause-based failure mode above can't be fully prevented by lock design alone (a suffiently long pause can happen at any TTL setting), the more robust pattern doesn't try to make the lock itself unbreakable — instead, it makes the *protected resource* reject stale lock holders. A **fencing token** is a monotonically increasing number issued alongside each lock acquisition; the protected resource (a database write, for instance) is required to include its fencing token with every operation, and the resource rejects any operation whose token is lower than the highest token it has already seen. This means even if a paused process wakes up believing it still holds the lock and attempts an operation, its now-stale (lower) fencing token gets rejected by the resource itself — the correctness guarantee moves from "trust the lock" to "verify at the point of actual effect," which is strictly more robust against the pause scenario above.

## A worked example

**Scenario:** a fleet of worker instances runs a scheduled nightly report-generation job, and only one instance should actually run it even though all instances have the scheduler configured (for redundancy, in case any single instance is down when the schedule fires).

- **Basic lock acquisition**: each instance attempts to acquire a Redis-based lock (`SET report_job_lock <instance_uuid> NX PX 600000`, a 10-minute TTL estimated to comfortably exceed the job's expected duration) when the scheduled time arrives; only the instance that successfully acquires it proceeds to generate the report, while others skip.
- **Fencing token added for the actual report write**: the lock acquisition also returns an incrementing token; when the report-generating instance writes the final report to storage, it includes this token, and the storage layer rejects a write carrying a lower token than one it's already accepted — protecting against the case where the job actually took longer than the 10-minute TTL (say, due to an unexpected data volume spike), the lock expired, a second instance acquired it and also started generating the report, and both processes attempt to write a result — only the higher-token (later-acquired) write succeeds, avoiding a corrupted double-write even though the lock-level protection alone didn't fully prevent the double-acquisition.

## Current practice (verified October 2026)

The October 2025 AWS DynamoDB DNS outage is a clean example of check-then-act on stale data: a slow worker validated "my plan is newer" at the start, a faster worker finished and cleaned up old plans, and the slow worker then applied its stale plan over the newer one, after which cleanup deleted it and left an empty record. The defences are the ones in this lesson: re-validate at the moment of action with a compare-and-swap or **fencing token**, and never let cleanup delete the currently applied generation.

## Common mistakes

- **Treating a distributed lock as an unconditional guarantee equivalent to a local mutex**, without accounting for the process-pause and TTL-mismatch failure modes that have no equivalent in single-machine locking.
- **Setting a lock TTL based on a guess rather than the actual measured duration of the protected work**, with either too-short a TTL (risking duplicate concurrent work) or too-long a TTL (risking prolonged blocking on a crashed holder) as a result.
- **Relying on lock acquisition alone for correctness-critical operations, without a fencing mechanism at the point where the protected resource is actually modified.** As shown above, this leaves a real, if narrow, window where two processes can both believe they hold the lock — a window fencing tokens close by checking correctness at the resource itself, not just at lock acquisition time.
