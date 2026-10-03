---
title: "Case Study: Netflix Chaos Engineering and Microservices Resilience"
short_title: "Netflix Chaos Engineering"
tags: ["case-study", "chaos-engineering", "resilience", "microservices", "netflix"]
sources:
  - "Netflix Technology Blog, posts on Chaos Monkey, the Simian Army and Chaos Kong"
  - "Basiri et al., 'Chaos Engineering', IEEE Software (2016)"
  - "Principles of Chaos Engineering (principlesofchaos.org)"
  - "Netflix Hystrix project documentation (circuit breaker and bulkhead patterns)"
  - "InfoQ, 'Enhancing Reliability Using Service-Level Prioritized Load Shedding: Netflix at QCon SF 2025' (November 2025), infoq.com/news/2025/11/netflix-prioritized-loadshedding (fetched October 2026)"
  - "Basiri et al., 'Automating Chaos Experiments in Production' (ICSE-SEIP 2019), arXiv 1905.04648"
banner:
  layout: line
  nodes:
    - [doc, "hypothesis"]
    - [server, "control"]
    - [server, "experiment"]
    - [shield, "compare"]
predict:
  question: "An experiment adds 2 seconds of latency to recommendation calls for 1 percent of users; callers time out at 500 ms and use a cached list. What is observed?"
  options: ["Stream starts drop for affected users until recommendations recover", "Stream starts are unchanged, but the home page loads about 400 ms slower", "The home page loads about 2 seconds slower for affected users"]
  answer: 1
  why: "The fallback protects playback, but the timeout still waits its full duration, so the team lowers it and adds a cache."
check:
  - q: "Why does Chaos Monkey run during business hours?"
    options: ["Traffic is lowest then, so any failure costs the least", "Auto-remediation tooling only operates during working hours", "Engineers are present to respond, instead of facing a 3 a.m. surprise"]
    answer: 2
    why: "Failures found when engineers are awake and at work get fixed in the design immediately."
  - q: "Why define steady state with a customer-facing metric such as streams started per second?"
    options: ["Internal health can look fine while customers still suffer an impact", "Internal metrics are too costly to collect in production", "Customer metrics let an experiment skip the control group"]
    answer: 0
    why: "Steady state is measured as what customers experience, so the experiment shows whether users were truly affected."
  - q: "Why start with small experiments instead of a region failure first?"
    options: ["Region failures cannot be simulated in a production system", "A small blast radius can be stopped fast with few users affected", "Small experiments do not need a steady-state metric"]
    answer: 1
    why: "Starting small on a fraction of traffic with a stop button limits damage if the hypothesis is wrong."
---

*Provenance note (October 2026): the experiment steps and principles were checked against principlesofchaos.org, and the current-practice section against a report of Netflix's QCon SF 2025 talk. The 2008 corruption incident, Chaos Monkey details and the Simian Army tool list come from the author's recall of Netflix blog posts and were not re-fetched; check those before quoting.*

## The context

Around 2008 Netflix suffered a major database corruption that halted DVD shipments for days. That experience, followed by its move from its own data centers to AWS and from a monolith to many microservices, led to a conviction: **in a large distributed system, failure is normal, not exceptional**. Instances disappear, networks degrade and dependencies slow down. The question is not whether things will fail but whether the system is built to keep serving customers when they do.

The distinctive step was not just designing for failure but **deliberately causing failure in production to prove the design works**.

## Chaos Monkey

Chaos Monkey randomly terminates virtual machine instances in production during business hours. The premise: if killing any single instance can cause an outage, engineers will find out immediately and fix the design, instead of discovering it at 3 a.m. when an instance dies naturally.

Running it **during working hours** is deliberate: engineers are present, awake and able to respond. The practical effect is cultural. Every service has to be built stateless or replicated, with no single instance that matters, because the monkey will eventually find it.

## Widening the experiments

The idea grew into a family of tools, informally called the Simian Army, each injecting a different failure:

- **Latency injection** — adds artificial delay to calls between services, testing whether callers time out, degrade gracefully or cascade.
- **Failure injection at the request level** (later tooling such as FIT) — fails specific requests for specific users or devices, so the blast radius is limited and the experiment is controlled.
- **Chaos Gorilla / Chaos Kong** — simulate the loss of an entire availability zone or even a whole AWS region, to verify the ability to **evacuate traffic** to another region. Regional failover drills became routine rather than emergency heroics.

## Principles of chaos engineering

The practice was later codified as a discipline, with a recognizable experiment shape:

1. **Define steady state** as a measurable output of the system, such as streams started per second, rather than internal metrics. The metric is what customers experience.
2. **Hypothesize** that steady state will continue in both the control group and the experimental group.
3. **Introduce real-world variables**: server crashes, network partitions, increased latency, dependency failures.
4. **Try to disprove the hypothesis** by looking for a difference between control and experiment.
5. **Minimize blast radius.** Start small, on a fraction of traffic, with the ability to stop instantly.

Running experiments in production matters because test environments rarely reproduce real traffic, data and dependency behavior. It is done responsibly with safeguards, not recklessly.

## The resilience patterns that chaos validates

Chaos engineering tests resilience patterns, and Netflix popularized several:

- **Timeouts everywhere.** No call waits forever.
- **Circuit breakers.** After repeated failures, stop calling a failing dependency for a while and fail fast, giving it time to recover. Netflix's Hystrix library implemented this (it has since been placed in maintenance mode in favor of newer tools, but the pattern endures).
- **Bulkheads.** Isolate resource pools per dependency, so a slow service can exhaust only its own threads, not everything.
- **Fallbacks and graceful degradation.** If the personalized recommendations service fails, show a generic popular list instead of an error. The core product, playing video, keeps working.
- **Retries with backoff and budgets**, to avoid retry storms.
- **Redundancy across zones and regions**, with data replicated so traffic can shift.

## A worked example

**Scenario:** an experiment tests what happens when the "recommendations" service becomes slow.

- **Steady state:** the stream-start rate per second, with a typical daily curve.
- **Hypothesis:** adding 2 seconds of latency to recommendation calls for 1 percent of users will not change stream starts, because callers time out at 500 ms and fall back to a cached popular list.
- **Experiment:** inject the latency for that 1 percent of traffic and compare against the control group.
- **Result:** stream starts are unchanged, but the home page for affected users loads 400 ms slower because the timeout is waiting its full duration. The team lowers the timeout and adds a cache, then repeats. If stream starts had dropped, the experiment would have been stopped immediately, with only a tiny group affected.

## Lessons to take away

- **Treat resilience as something you test, not something you assume.** Untested failover is a hope.
- **Make failure frequent and small** so it is routine, rather than rare and catastrophic.
- **Measure customer-facing outcomes**, not internal health.
- **Limit blast radius** and keep a stop button.
- **Culture matters as much as tooling.** The monkey works because teams are expected to build for it.
- **Begin modestly.** You do not need Netflix's scale to run a game day that kills one instance in staging, then one in production.

## Current practice (verified October 2026)

The Simian Army era gave way to targeted platforms: **ChAP** (Chaos Automation Platform) diverts a small slice of production traffic into an experiment cluster and a matching control cluster, injects failure into the experiment, and compares the two. At QCon SF in November 2025 Netflix described **service-level prioritized load shedding**: decisions moved from central API gateways into each service, request priority is set early and propagated by header (user-initiated playback high; prefetch and background work low; data writes ahead of reads), per-cluster shedding functions are generated from CPU, latency and concurrency metrics, and chaos experiments validate every configuration. The model keeps a **success buffer** (capacity for normal traffic) and a **failure buffer** (capacity reserved to reject excess traffic cleanly), which matters for content launches where traffic outruns autoscaling. This lesson's Hystrix material is historical: Hystrix is in maintenance mode, so use a current resilience library or the mesh. Source for the 2025 talk is a secondary news report of the presentation.

## Common mistakes when adopting the approach

- **Injecting failure with no steady-state metric**, so you cannot tell what changed.
- **Starting with the largest experiment** such as a region failure, before smaller ones pass.
- **No kill switch** or no automatic abort on bad metrics.
- **Experimenting in production when basic redundancy does not yet exist**, which just causes outages.
- **Treating chaos tooling as a replacement for good design**, rather than verification of it.
