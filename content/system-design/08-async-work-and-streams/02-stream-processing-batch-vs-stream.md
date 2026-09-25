---
title: "Stream Processing: Batch vs. Stream, and Windowing"
short_title: "Batch vs Stream Processing"
tags: ["stream-processing", "async", "data-pipelines"]
sources:
  - "Apache Flink and Kafka Streams documentation on windowing and event time"
  - "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017), chapter on stream processing"
---

## Batch and stream processing solve the same problem on different timescales

Both batch and stream processing take raw data and produce derived, aggregated, or transformed results — the difference is when. **Batch processing** runs periodically over a complete, bounded dataset (yesterday's logs, last month's transactions), producing results with latency measured in minutes to hours. **Stream processing** processes data continuously as it arrives, producing results with latency measured in milliseconds to seconds. The right choice depends entirely on how fresh the result actually needs to be for its purpose — not on which approach is inherently "better," since batch processing remains simpler to reason about and cheaper to run for anything that doesn't genuinely need low latency.

## Why stream processing is harder than batch, structurally

Batch processing operates over a complete, known dataset — "sum all transactions in this file" has an unambiguous, single correct answer, computed once. Stream processing operates over data that never "completes" — there's always more coming — which raises questions batch processing doesn't have to answer: when is it safe to say "we've seen all the events for this time window" and emit a result, given that events can arrive late, out of order, or be delayed by network issues upstream? This is the core added complexity of stream processing, and it's why stream processing systems need explicit answers to questions batch systems get for free by virtue of operating on a fixed, complete dataset.

## Event time vs. processing time

- **Processing time** — when an event is actually processed by the stream system, i.e., the stream processor's own local clock at the moment it handles the event.
- **Event time** — when the event actually occurred in the real world (e.g., when a user actually clicked a button), which is typically embedded as a timestamp in the event data itself.

These can diverge significantly — a mobile app might buffer events locally and send them once connectivity is restored, so an event with an event-time timestamp from an hour ago might have a processing-time arrival right now. Aggregations based on processing time ("all events processed in the last minute") are simpler to compute but can produce misleading results if network delays are uneven (an unlucky burst of delayed events all arriving at once, misattributed to "right now" activity rather than reflecting when it actually happened). Aggregations based on event time are more accurate to what actually happened in the real world, but require explicitly deciding how long to wait for late-arriving events before finalizing a result — the core tradeoff windowing has to address.

## Windowing: bounding an inherently unbounded stream

Since a stream never completes, computing an aggregate ("average value over the last 5 minutes") requires defining a **window** — a bounded slice of the otherwise-infinite stream to aggregate over:

- **Tumbling windows** — fixed-size, non-overlapping windows (every 5 minutes, a new window starts, and the previous one closes). Simple, and each event belongs to exactly one window.
- **Sliding windows** — fixed-size windows that overlap and advance continuously (e.g., "the last 5 minutes," recomputed every 30 seconds) rather than jumping in fixed non-overlapping blocks — useful for smoother, continuously-updating metrics, at the cost of more computation since each event may contribute to multiple overlapping windows.
- **Session windows** — variable-length windows grouped by periods of actual activity, closing after a gap of inactivity (e.g., group a user's clicks into a "session" that closes after 30 minutes of no activity). Useful when the natural grouping in the data is activity-driven rather than clock-driven.

## Watermarks: deciding when a window is "done enough"

Given that events can arrive late (event time lagging processing time), a stream processor needs a policy for how long to wait before finalizing a window's result — waiting forever isn't an option, since a window that never closes never produces a result. A **watermark** is an explicit, tunable heuristic: "we assume all events with event time before T have now arrived" — once the watermark passes a window's end time, the window closes and emits its result, accepting that a small number of events arriving even later (beyond the watermark's tolerance) will either be dropped or handled as a separate late-arrival correction, depending on the system's configuration. Setting the watermark tolerance too tight risks dropping genuinely late-but-valid data; setting it too loose delays every window's result unnecessarily, even when the vast majority of data for that window has already arrived on time.

## A worked example

**Scenario:** a ride-hailing app needs a real-time dashboard showing average ride wait times over the last 5 minutes, where mobile clients occasionally buffer and delay-send events due to spotty connectivity.

- **Event time is used, not processing time**, since a burst of delayed events from a connectivity gap shouldn't be misattributed to a spike in *current* wait times — the dashboard needs to reflect when rides actually happened, not when the system happened to receive the data about them.
- **A sliding window** (last 5 minutes, updated every 15 seconds) is chosen over a tumbling window, since the dashboard needs a smoothly, continuously updating figure rather than a metric that jumps only once every 5 minutes.
- **A watermark with a 2-minute tolerance** is configured, based on measuring the actual observed delay distribution of client-buffered events in production — a value chosen from real data, not guessed, balancing "most windows close and report promptly" against "most late-but-valid events are still included before their window finalizes."

## Common mistakes

- **Choosing stream processing for a use case that doesn't actually need low latency**, taking on the added complexity of windowing, watermarks, and event-time handling for a report that would have been simpler and cheaper to produce with a scheduled batch job.
- **Using processing time when event time is what the use case actually needs**, producing metrics that look accurate but are systematically distorted by any unevenness in data arrival delay — a subtle bug that often isn't caught until delayed data produces a visibly wrong spike or dip.
- **Setting a watermark tolerance without measuring the actual late-arrival distribution of real data.** A tolerance set by guess rather than by observed delay patterns either drops too much genuinely valid late data or delays results far more than the data actually requires.
