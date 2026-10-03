---
title: "Designing a Ride-Sharing System"
short_title: "Ride-Sharing System"
tags: ["ride-sharing", "geo", "matching", "real-time", "system-design"]
sources:
  - "Public engineering blogs from ride-hailing companies on dispatch, geospatial indexing and supply positioning"
  - "Google S2 geometry library and Uber H3 hexagonal grid documentation"
  - "Kleppmann, Designing Data-Intensive Applications (2017), chapters on stream processing"
banner:
  layout: line
  nodes:
    - [phone, "rider"]
    - [server, "dispatch"]
    - [db, "geo index"]
    - [phone, "driver"]
predict:
  question: "5 million drivers send a location update every 4 seconds, while ride requests peak in the tens of thousands per second. Which load dominates?"
  options: ["Ride requests, since each triggers matching, pricing and payment", "Location ingestion, at about 1.25 million writes per second", "Both are roughly equal, so the design should split capacity evenly"]
  answer: 1
  why: "5M drivers / 4 seconds gives about 1.25 million writes per second, far above ride requests."
check:
  - q: "Why can the driver location index live in memory without durable per-update storage?"
    options: ["Each update overwrites the last, and a failed shard recovers when drivers re-send positions", "The trip service replays full location history to rebuild the index after a failure", "Location accuracy is irrelevant to matching, so losing it is harmless"]
    answer: 0
    why: "The data is ephemeral and self-healing within seconds, so heavy durability would be pointless write load."
  - q: "Why claim a driver with an atomic conditional update during matching?"
    options: ["It guarantees the nearest driver is always the one chosen", "Without it, two concurrent matches could both pick one driver, double-booking them", "It prevents drivers from declining offers once they are sent"]
    answer: 1
    why: "Reserving only if currently available means one match succeeds and the other picks another driver."
  - q: "Why store trip state in a replicated database while locations are ephemeral?"
    options: ["Trip updates are more frequent than location updates, so they need bigger storage", "Trip state transitions need ordering that in-memory stores cannot provide", "The trip record drives billing and disputes, so it must not be lost"]
    answer: 2
    why: "Money depends on trip state, whereas location is simply overwritten by the next update."
---

## Requirements

**Functional:** riders request a trip from a pickup to a destination; the system finds a nearby available driver; both see live location; the trip is tracked; the fare is computed; payment happens at the end.

**Non-functional:** matching within a few seconds, location updates handled at high volume, high availability, and **consistency where it matters** — a driver must never be assigned two simultaneous trips.

## Estimating scale

Suppose 5 million active drivers sending a location update every 4 seconds. That is about **1.25 million writes per second**, far more than the ride requests themselves (maybe tens of thousands per second at peak). Location ingestion, not the ride request, is the dominant load, and it shapes the architecture: this data is **ephemeral** and does not need durable per-update storage.

## Core services

- **Location service** — ingests driver positions and maintains the current location of each.
- **Matching / dispatch service** — chooses a driver for a ride request.
- **Trip service** — owns the trip's lifecycle and state machine.
- **Pricing service** — estimates and computes fares, including demand-based multipliers.
- **ETA service** — estimates pickup and trip times.
- **Payments and notifications** — charge, receipt, push notifications.

## Indexing driver locations

Finding "available drivers within 2 km" must be fast. Scanning all drivers is impossible. Divide the map into **cells** using a geospatial scheme such as geohash, S2, or H3 hexagons. Each driver belongs to one cell; the index maps cell to the set of drivers currently inside.

To find candidates, look up the rider's cell plus its neighbors, then filter by actual distance and availability. The index is kept in memory (for instance a sharded in-memory store), partitioned **by geographic cell** so nearby drivers live together and a query touches few shards. Each driver's latest position simply overwrites the previous one.

Cell size is a trade-off: small cells give precise results but need more neighbor lookups; large cells hold too many drivers per query. Dense cities may use finer cells than rural areas.

## Matching

A basic strategy is nearest available driver by ETA. Better systems consider more:

- **Batching.** Instead of matching each request instantly and greedily, collect requests for a couple of seconds and solve an assignment problem across several riders and drivers, which can lower total waiting time. This is the marketplace view described in the two-sided matching lesson.
- **Offering rather than assigning.** The system sends an offer to the chosen driver, who may decline or time out. The request then moves to the next candidate.
- **Fairness and supply positioning.** Avoid starving some drivers, and nudge drivers toward high-demand areas.

To prevent double assignment, claiming a driver is an **atomic operation**: a conditional update that marks the driver as reserved only if currently available. If it fails, pick another driver. Reserved offers carry a short expiry so an unresponsive driver is released automatically.

## Trip state machine

A trip moves through states: requested, driver assigned, driver arriving, in progress, completed, or cancelled. Each transition is validated and persisted durably, because this record drives billing and disputes. Unlike location updates, trip state **must not be lost**, so it lives in a replicated database, partitioned by trip or city.

## Real-time updates

Riders and drivers need to see each other move. Use persistent connections (WebSockets or a push channel) so the server can push positions. The location service publishes updates to a message stream, and a fan-out service forwards the relevant ones to the connected counterpart. Update frequency can be throttled on the rider's side, since smooth animation needs fewer updates than the driver app produces.

## Handling failure

- **A location service shard fails:** drivers re-register their position on the next update, so the index recovers within seconds. This is why ephemeral state needs no heavy durability.
- **The dispatch service crashes mid-match:** the trip service holds the truth, so pending requests are recovered from its state.
- **Network drops during a trip:** the driver app buffers location points and uploads on reconnect, so the fare uses the real route.

## A worked example

**Scenario:** a rider requests a trip at a busy intersection.

1. The request creates a trip in `requested` state and the matching service reads the rider's cell and neighbors from the location index, getting 40 candidate drivers.
2. It filters to 12 who are available and heading suitably, ranks them by ETA from the ETA service, and sends an offer to the best driver.
3. The driver accepts within 10 seconds. The service performs the atomic reserve; it succeeds, the trip moves to `driver_assigned`, and both parties get pushes.
4. If the driver had declined, the service would move to the second candidate, with a cap on how many attempts it makes before expanding the search radius.

## Common mistakes

- **Writing every location ping to a durable database**, creating an enormous and pointless write load.
- **Searching all drivers** instead of using a spatial index.
- **Assigning without an atomic claim**, allowing double-booked drivers.
- **Treating trip state as ephemeral.** Money depends on it.
- **Ignoring dense-area hotspots**, where a single cell can overload one shard.
