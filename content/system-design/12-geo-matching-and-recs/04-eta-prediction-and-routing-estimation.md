---
title: "ETA Prediction and Routing Estimation"
short_title: "ETA Prediction and Routing"
tags: ["geo", "routing", "eta", "graphs", "machine-learning"]
sources:
  - "Dijkstra (1959) and A* search (Hart, Nilsson, Raphael, 1968), shortest-path foundations"
  - "Geisberger et al., 'Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks' (2008)"
  - "Public engineering posts from ride-hailing and mapping companies on ETA models as corrections over routing estimates"
banner:
  layout: line
  nodes:
    - [phone, "position"]
    - [db, "road graph"]
    - [model, "ETA model"]
    - [doc, "estimate"]
predict:
  question: "The router returns a 4-minute baseline, and live segment speeds show congestion that the learned model corrects by about 3 minutes. What does the app show?"
  options: ["7 minutes: the baseline plus the learned correction", "4 minutes: the router's baseline is authoritative", "3 minutes: only the model's residual is shown"]
  answer: 0
  why: "The model predicts a residual on top of the routing baseline, so the two add up."
check:
  - q: "Why do contraction hierarchies clash with live traffic?"
    options: ["Hierarchies are slower than plain Dijkstra on large road networks", "Preprocessing assumes fixed weights, so use customizable variants or a correction", "Live traffic only affects A* heuristics, not hierarchical routers"]
    answer: 1
    why: "Static shortcuts go stale when edge weights change, so systems re-weight cheaply or correct on top."
  - q: "Why not replace the router with an ETA model entirely?"
    options: ["The model is too slow to run, even compared with Dijkstra", "The router already includes live traffic, making a model redundant", "The router gives path structure the model can't learn cheaply; the model fixes the rest"]
    answer: 2
    why: "Each handles what the other cannot: structure versus unknown conditions."
  - q: "Why smooth the ETA as it is recomputed during a trip?"
    options: ["A display flickering from 4 to 9 minutes hurts trust more than a steady, slightly off one", "Smoothing makes each recomputed estimate more accurate on every ping", "Recomputation is expensive, so it is limited to once per trip"]
    answer: 0
    why: "Stability of the displayed number matters to users more than reacting to every ping."
---

## Two different questions

"How long will this trip take?" hides two questions that are solved separately:

1. **Routing** — which path should we take? This is a graph problem.
2. **ETA estimation** — given that path and current conditions, how long will it really take? This is a prediction problem.

Systems that treat them as one tend to be either slow or wrong. The common design is a fast routing engine that produces a path and a baseline time, plus a learned model that **corrects** that baseline using live and historical context.

## Routing on a road graph

Roads are modelled as a directed graph: intersections are nodes, road segments are edges, and each edge has a travel-time weight. The classic algorithm is **Dijkstra**, which finds shortest paths but explores in all directions. **A\*** adds a heuristic (straight-line distance divided by a maximum speed) so the search leans toward the destination.

Continental road networks have tens of millions of edges, and plain Dijkstra is far too slow for an interactive service. Production routers use **preprocessing**:

- **Contraction hierarchies** rank nodes by importance, add shortcut edges that skip unimportant ones, and answer queries by searching upward from both ends. Preprocessing is expensive, queries take milliseconds.
- **Partitioned graphs** split the map into regions with precomputed boundary distances.

The trade-off is that preprocessing assumes edge weights are fixed. Live traffic changes weights constantly, so systems either use **customizable** variants that re-weight cheaply, or keep static hierarchies and apply a traffic correction on top.

## Where the baseline goes wrong

A baseline time computed from speed limits is optimistic. Real trips are slowed by:

- **Time of day and day of week** — the same road is a different road at 8:30 on Monday.
- **Live traffic** — an accident, a closure, weather.
- **Turns and intersections** — a left turn across traffic costs far more than the distance suggests.
- **Trip-specific factors** — pickup waiting time, parking, the driver's behaviour.

## The learned correction

A common approach is to feed the model the routing baseline plus context features and ask it to predict the **residual** — how much longer or shorter the real trip will be. Typical features include:

- Baseline route time and distance, number of turns, road classes used.
- Hour of week, holiday flag, weather.
- Recent observed speeds on the route's segments, aggregated over the last few minutes from other vehicles' location pings.
- Historical travel time for similar trips at the same time.

Gradient-boosted trees are a common first choice because they are fast to serve and handle mixed features well. Deep models over road-segment sequences or graph structure can improve accuracy further at higher serving cost.

## Serving architecture

- **Live speed pipeline:** vehicle location pings stream into a message log, are map-matched to road segments, and aggregated into per-segment speed over short windows. The result is written to a low-latency store keyed by segment.
- **Routing service:** stateless, holds the graph in memory, returns a path and baseline.
- **ETA service:** looks up segment speeds and context, runs the model, returns the estimate and often a range.
- **Caching:** many requests repeat (the same pickup area, the same routes). Quantize origins and destinations to grid cells and cache baselines briefly.

## A worked example

**Scenario:** a ride-hailing app shows "arrives in 7 min" for a driver 2 km away, and must also rank 20 nearby drivers by ETA.

- For ranking, running a full route for each of 20 drivers is wasteful. The system first filters by straight-line distance, then computes routes for the closest few, or uses a **many-to-one** query that finds distances from all candidates to the rider in a single graph search.
- The baseline for the chosen driver is 4 min. Live segment speeds show congestion on the main road, so the model adds about 3 min. The app shows 7.
- Over the trip, the ETA is **recomputed periodically** and smoothed so the number does not jump wildly. A display that flickers between 4 and 9 minutes damages trust more than a slightly inaccurate steady one.

## Evaluating ETA quality

Average error hides what users feel. Track the **distribution** of error (percentiles), bias by time of day, and the rate of badly late trips. Underestimating is usually worse than overestimating, so some products deliberately bias slightly pessimistic or show a range.

## Common mistakes

- **Using one global speed per road class.** It ignores time and congestion and is wrong in exactly the situations that matter.
- **Rerunning full routing for every candidate.** Use cheap filters and many-to-one queries.
- **Treating the ETA model as a replacement for the router.** The router supplies structure the model cannot learn cheaply; the model fixes what the router cannot know.
- **Letting the displayed ETA jitter.** Smooth updates and avoid reacting to every ping.
- **Training and serving with different features.** If live speeds are computed one way offline and another online, accuracy silently drops.
