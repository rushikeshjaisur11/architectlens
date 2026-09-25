---
title: "Real-Time Analytics Pipelines: Lambda and Kappa Architectures"
short_title: "Real-Time Analytics Pipelines"
tags: ["analytics", "data-pipelines", "stream-processing"]
sources:
  - "Nathan Marz, 'Big Data' (2015), chapters introducing the Lambda Architecture"
  - "Jay Kreps, 'Questioning the Lambda Architecture' (2014, proposing the Kappa Architecture)"
---

## The problem: analytics needs both accuracy and speed, which pull in different directions

A dashboard showing "events in the last few seconds" needs the stream processing covered in this track's async-work lesson — low latency, computed incrementally as data arrives. But stream processing alone has a real limitation: it processes each event once, as it arrives, and if a bug in the processing logic is discovered later, or if events genuinely arrive extremely late (beyond what any reasonable watermark tolerance would wait for), there's no simple way to "fix" already-computed results without reprocessing history — something stream processing systems aren't naturally built to do cheaply. Batch processing, by contrast, recomputes over a complete, correct dataset each run, so it's easy to rerun with corrected logic, but at the cost of update latency measured in the batch job's schedule (hours), not real time.

## Lambda architecture: running both, side by side

The **Lambda architecture** runs both a batch layer and a speed (streaming) layer in parallel over the same incoming data:

- **Batch layer** — periodically reprocesses the complete historical dataset from scratch, producing accurate, complete results, at high latency (typically hours).
- **Speed layer** — processes new data incrementally in near real time, producing approximate, low-latency results that fill the gap until the next batch run catches up.
- **Serving layer** — merges results from both layers for queries, typically preferring the batch layer's data once it's caught up to a given point in time, and falling back to the speed layer's more approximate, faster results for anything more recent than the batch layer has processed yet.

This gives both properties — a dashboard shows near-real-time numbers via the speed layer, which get quietly superseded by the more accurate batch layer's numbers once the next batch run completes. The cost is real: essentially the same processing logic needs to be implemented and maintained twice, once for the batch layer and once for the speed layer, using different technology (a batch framework and a stream-processing framework), and keeping the two implementations' logic consistent with each other over time is a genuine ongoing maintenance burden — a change to the business logic needs to be correctly replicated in both places, or the two layers' results silently diverge.

## Kappa architecture: simplifying to a single stream-based path

The **Kappa architecture**, proposed partly as a direct response to Lambda's dual-implementation burden, uses only a stream-processing layer — no separate batch layer. The insight: a well-designed stream processing system with a durable, replayable log (like Kafka, retaining events for a configurable duration) can handle "reprocess historical data with corrected logic" the same way a batch layer would — by replaying the stored event log through the (now-corrected) stream processing logic from the beginning, rather than maintaining an entirely separate batch codepath for this purpose.

This eliminates the dual-implementation problem — one codebase, one set of processing logic — at the cost of requiring the stream processing system and its event log retention to be robust enough to handle full historical reprocessing when needed, which places real demands on the underlying infrastructure (event retention duration, replay throughput) that a pure real-time-only streaming setup might not have been built to handle.

## Choosing between them

- **Lambda** remains a reasonable choice when the batch and speed layers genuinely need different technology for good reasons (e.g., the batch layer benefits from a mature, well-understood batch framework with strong tooling that the streaming ecosystem doesn't yet match for a specific complex computation), and the team is willing to accept the dual-implementation maintenance cost for the resulting flexibility.
- **Kappa** is generally preferred when feasible, specifically because it removes the consistency-maintenance burden between two parallel implementations — most modern real-time analytics systems lean Kappa-style where the underlying streaming infrastructure (typically Kafka-based) can support the replay requirements, reserving a Lambda-style split only for cases with a specific, justified reason for a genuinely separate batch codepath.

## A worked example

**Scenario:** a company's real-time revenue dashboard needs both a fast-updating "revenue in the last hour" figure and periodically-reconciled, fully accurate daily revenue totals used for financial reporting.

- **Kappa-style approach**: all revenue events flow through a single stream-processing pipeline (built on Kafka with sufficient retention to support full reprocessing), computing both the fast-updating hourly aggregate and the daily total from the same logic — when a bug is found in the revenue-calculation logic, the fix is deployed once, and historical data is reprocessed by replaying the retained event log through the corrected logic, rather than needing the fix applied separately to a batch job and a stream job that might otherwise drift out of sync with each other.
- **Why this specifically avoided Lambda's dual-implementation cost**: revenue calculation logic (currency conversion rules, refund handling, discount application) changes periodically as the business evolves, and having exactly one implementation of that logic — rather than two that need to be kept manually consistent — was judged worth more than any specific advantage a separate batch framework might have offered for this particular computation.

## Common mistakes

- **Defaulting to a Lambda architecture without a specific reason the batch and speed layers need genuinely different implementations.** The dual-maintenance cost is real and ongoing — Kappa's single-pipeline simplicity is generally the better starting point unless there's a concrete reason (a specific batch-only capability genuinely needed) to accept Lambda's added complexity.
- **Choosing Kappa without verifying the underlying streaming infrastructure can actually support full historical reprocessing** — a streaming system configured with short event retention, sized only for near-real-time use, may not be able to replay far enough back when a genuine full reprocess is needed, undermining Kappa's core simplifying assumption.
- **Letting batch and speed layer logic silently drift apart in a Lambda setup.** Without deliberate process to keep the two implementations consistent (shared code where possible, coordinated review of changes to either), the two layers' results can quietly diverge over time, undermining user trust once the discrepancy is eventually noticed.
