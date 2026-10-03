---
title: "Designing a Distributed Cron and Job Scheduler"
short_title: "Distributed Cron Scheduler"
tags: ["cron", "scheduling", "leader-election", "reliability", "operations"]
sources:
  - "Google SRE Book, chapter 'Distributed Periodic Scheduling with Cron'"
  - "Kubernetes documentation on CronJobs (concurrencyPolicy, startingDeadlineSeconds)"
  - "Apache ZooKeeper and etcd documentation on leader election"
predict:
  question: "The old leader stalls at 02:00:05, and a new leader at 02:00:20 tries inserting run IDs like job@02:00Z that already exist. What happens?"
  options: ["Those inserts fail harmlessly on the uniqueness constraint, so nothing double-fires", "Each such job runs twice, since the new leader cannot know what the old one fired", "All jobs due at 02:00 are skipped until the next scheduled tick"]
  answer: 0
  why: "Run IDs derived from job and scheduled time act as fencing, so duplicate inserts are rejected while missed jobs still fire."
check:
  - q: "Why make missed-run behavior a per-job policy?"
    options: ["Always catching up is correct, since skipping a run silently loses data", "A late report may be worthless and skippable, but a billing job must be caught up", "Always skipping is correct, since late runs risk overlapping the next tick"]
    answer: 1
    why: "The right answer depends on whether the job's output is still useful when late."
  - q: "Why alert on a job failing to run at all, not only on failures?"
    options: ["Failure alerts already fire on missed runs, so absence alerts add only duplicate noise", "Absence alerts replace retries, since a missing run is cheaper to detect than fix", "A job that silently never runs produces no error, so only an absence alert catches it"]
    answer: 2
    why: "Absence alerts such as 'no success in 26 hours' catch silent failures."
  - q: "Why add jitter to jobs scheduled at midnight?"
    options: ["Thousands of jobs firing together would hit executors and downstream systems at once, so jitter spreads launches", "Jitter ensures each job runs exactly once per tick by randomizing run identifiers", "Wall-clock times differ across machines, so jitter hides clock skew between replicas"]
    answer: 0
    why: "Jitter and rate-limited launches avoid a thundering herd at round times."
---

## What cron does, and why one machine is not enough

Classic cron runs commands at specified times on one machine. It is simple and breaks in predictable ways: if that machine is down at the scheduled time, the job silently does not run; if the machine is replaced, schedules are lost; and nothing coordinates a job that should run once across a fleet.

A **distributed cron service** provides schedules as a managed, reliable service: users register a job (what to run, which schedule, which constraints), and the service guarantees it runs at the right time despite machine failures, without running twice when it should run once.

This is related to, but distinct from, the general task scheduler lesson. That design handles arbitrary tasks and delays on demand. Cron's special feature is **recurring, time-triggered schedules that must fire on time and exactly once per tick**.

## Core components

- **Schedule store.** Durable, replicated storage of job definitions: cron expression, timezone, command or task reference, concurrency policy, retry policy, owner.
- **Trigger engine.** Computes the next fire time for each job and, when it arrives, creates a **run** record and hands it to execution.
- **Executor / launcher.** Starts the run on workers or hands it to a task queue. It reports status back.
- **Run history.** A record of each run (scheduled time, start, end, result) for visibility and for recovering after failures.

## Making the trigger reliable: leader election

If several scheduler replicas all fire the same job, it runs several times. If none fires, it does not run. The standard solution is to elect **one active leader** at a time. A consensus-backed lock service (etcd, ZooKeeper) grants leadership as a lease; the leader fires jobs while standbys wait. If the leader dies or loses its lease, a standby takes over within seconds.

Failover creates a hazard: the old leader might still be running, briefly, after a pause. Protect against double firing by making each trigger **idempotent at creation time**: derive a run identifier from the job and the scheduled time (for example `job-42@2026-10-03T02:00:00Z`) and insert it with a uniqueness constraint. Whichever scheduler inserts first wins, and the duplicate insert fails harmlessly. This fencing makes "who is leader" less critical for correctness.

Alternatively, partition jobs across schedulers by hash so each owns a subset, which scales better than a single leader and limits blast radius.

## The hard cases

- **Missed runs.** If the scheduler was down at 02:00 and recovers at 02:07, should it run the job now? Offer a policy per job: *run late* within a **deadline window** (Kubernetes' `startingDeadlineSeconds` is this idea), or *skip* if too stale. A report that is meaningless after 02:30 should be skipped; a billing job should be caught up.
- **Overlapping runs.** If a job scheduled every minute takes 90 seconds, runs overlap. Policies: **allow** overlap, **forbid** (skip the new run while the previous is active), or **replace** (cancel the old one). Choose per job.
- **Thundering herd at round times.** Thousands of jobs set for `0 0 * * *` all fire at midnight. Add **jitter** or let jobs request a spread window, and rate-limit launches, so the executors and downstream systems are not hit simultaneously.
- **Time zones and daylight saving.** A job at 02:30 local time does not exist on the spring-forward day and happens twice on the fall-back day. Define the behavior explicitly (run once, at the next valid time). Prefer UTC for system jobs.
- **Clock skew.** Time decisions should come from the leader's single clock rather than multiple machines comparing wall clocks.

## Execution semantics

Cron triggering is **at-least-once** in the presence of failures, so jobs should be idempotent, or use their run ID as an idempotency key for side effects. The executor should apply timeouts, capture logs and exit status, retry with backoff for transient failures, and emit metrics and alerts when a job fails, **or when a job fails to run at all**. Alerting on absence ("this nightly job has not succeeded in 26 hours") is as important as alerting on errors, and is the usual way silent failures are caught.

## Scaling

A fleet might hold hundreds of thousands of schedules. Keep a **time-ordered index of the next fire time** so the trigger engine only touches jobs due now (a priority queue or database index on next-fire-time), instead of evaluating every cron expression every second. After firing, compute and store the next fire time.

## A worked example

**Scenario:** 200,000 jobs, with 30,000 scheduled at the top of an hour.

- Schedules live in a replicated store. Three scheduler replicas contend for leadership through etcd; one holds the lease.
- At 02:00:00 the leader selects jobs due, inserts run records with IDs like `job@2026-10-03T02:00Z` (unique), and enqueues them to the task queue at a controlled rate with up to 30 seconds of random jitter for jobs that opted in.
- The leader's VM stalls at 02:00:05. The lease expires and a new leader starts at 02:00:20. It scans for due jobs, tries to insert the same run IDs, and fails on those already created, so nothing double-fires, while still firing any that the old leader missed.
- A job configured with "forbid overlap" finds its previous run still active and records a skipped run, raising a warning metric.

## Common mistakes

- **Running cron on a single host** with no failover.
- **All replicas triggering** with no election or unique run IDs.
- **Not defining missed-run behavior**, so recoveries either flood or silently skip.
- **Ignoring overlap**, letting runs pile up.
- **Everyone scheduling at midnight**, without jitter.
- **Alerting only on failure**, never on absence.
- **Local time with DST** for critical jobs.
