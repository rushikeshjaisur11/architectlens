---
title: "SLIs, SLOs and Error Budgets"
short_title: "SLIs, SLOs and Error Budgets"
tags: ["reliability", "sre", "slo", "operations", "availability"]
sources:
  - "Google SRE Book, chapter 'Service Level Objectives'"
  - "Google SRE Workbook, chapters on implementing SLOs and alerting on SLOs"
  - "Beyer et al., Site Reliability Engineering (O'Reilly, 2016)"
banner:
  layout: line
  nodes:
    - [server, "SLI"]
    - [shield, "SLO"]
    - [doc, "error budget"]
    - [user, "release gate"]
predict:
  question: "An API has a 99.9% SLO over 30 days and serves 10 million requests. About how many failed requests use up the whole error budget?"
  options: ["About 1,000 failed requests", "About 10,000 failed requests", "About 100,000 failed requests"]
  answer: 1
  why: "0.1% of 10 million requests is 10,000 allowed failures."
check:
  - q: "Why target something below 100% availability?"
    options: ["100% is unachievable and costly, and users cannot tell the gap", "Regulators forbid promising 100% availability in contracts", "Error budgets only work if the SLI is measured as an average"]
    answer: 0
    why: "Users cannot tell 99.99 from 100 once their own network is included, so the lowest satisfying target is cheapest."
  - q: "Why set the SLA looser than the internal SLO?"
    options: ["It lets the SLA use a longer window than the SLO does", "It leaves room to react before penalties or refunds are owed", "It removes the need to track an error budget internally"]
    answer: 1
    why: "An SLO equal to the SLA leaves no margin to fix problems before paying penalties."
  - q: "Why alert on burn rate instead of 'error rate above 0.1%'?"
    options: ["It pages less often because it ignores latency entirely", "It fires only after the budget is fully exhausted", "It compares consumption pace to the window, cutting noisy blip alerts"]
    answer: 2
    why: "Burn rate shows how fast the budget is being spent, so fast and slow burns can be separated."
---

## Three terms that are easy to confuse

- **SLI (service level indicator)** — a measurement of how the service is behaving, expressed as a ratio of good events to total events. Example: the fraction of requests that complete successfully in under 300 ms.
- **SLO (service level objective)** — a target for an SLI over a time window. Example: 99.9 percent of requests are good, measured over 30 days.
- **SLA (service level agreement)** — a contract with consequences, usually financial, if a threshold is missed. SLAs are normally looser than the internal SLO, so you have room to react before you owe anyone a refund.

An SLI is a number, an SLO is a goal for that number, and an SLA is a promise with a penalty.

## Choosing good SLIs

Measure what users experience, not what is easy to collect. CPU usage and memory are causes, not experiences. Good SLIs usually fall into a few categories:

- **Availability:** proportion of valid requests that succeeded.
- **Latency:** proportion of requests faster than a threshold (use thresholds and percentiles, not averages, which hide slow tails).
- **Quality / correctness:** proportion of responses that were complete and not degraded.
- **Freshness** (for data pipelines): proportion of data newer than a limit.

Measure as close to the user as practical, such as at the load balancer or in the client, so the SLI sees failures that internal metrics miss.

## Setting the target

100 percent is the wrong target. It is unachievable, enormously expensive, and users cannot tell the difference between 99.99 and 100 once their own network and device are included in the path. Pick the lowest target that keeps users happy.

Each extra nine cuts permitted downtime by ten times:

| SLO | Downtime allowed per 30 days |
|---|---|
| 99% | ~7.2 hours |
| 99.9% | ~43 minutes |
| 99.99% | ~4.3 minutes |
| 99.999% | ~26 seconds |

Your service cannot be more reliable than what it depends on. If a critical dependency offers 99.9 percent, promising 99.99 percent on top of it needs redundancy or fallbacks.

## The error budget

If the SLO is 99.9 percent, then **0.1 percent of events are allowed to fail**. That allowance is the error budget. Over 30 days with 10 million requests, the budget is 10,000 bad requests.

The budget turns reliability from a vague wish into something spendable:

- **Budget remaining:** the team can ship features, run experiments, take calculated risks.
- **Budget nearly exhausted:** slow down releases, prioritize reliability work, freeze risky changes.
- **Budget exhausted:** feature launches stop until reliability recovers.

This settles the standing argument between "ship faster" and "be safer" with data both sides agreed to in advance. It also makes zero outages a non-goal: an unspent budget means you were too cautious.

## Alerting on burn rate

Alerting on "error rate above 0.1 percent" is noisy. Instead alert on **burn rate**: how fast you are consuming the budget relative to the pace that would exactly use it up over the window. A burn rate of 1 means you will end the window with zero budget; 14.4 means a 30-day budget would be gone in about two days.

A common pattern pairs a **fast-burn** alert (high burn rate over a short window, such as 1 hour, pages a human immediately) with a **slow-burn** alert (modest burn rate over a longer window, such as 3 days, opens a ticket). Requiring both a long and short window to agree reduces false alarms and stale alerts.

## A worked example

**Scenario:** a checkout API with a 99.9 percent availability SLO over 30 days, serving about 3 million requests per day.

- Monthly volume is 90 million, so the budget is 90,000 failed requests.
- A bad deploy on day 6 returns errors on 40 percent of requests for 45 minutes. At roughly 2,100 requests per minute that is about 830 failures per minute, near 37,500 failures in total, which is over 40 percent of the month's budget gone in under an hour.
- The fast-burn alert fires within minutes, the team rolls back, and the budget policy triggers: no feature releases for the rest of the month except reliability fixes.
- The postmortem leads to canary deploys, so a similar regression would hit 1 percent of traffic first.

## Common mistakes

- **Choosing 100 percent or an arbitrary number of nines** without asking what users actually need.
- **Measuring averages**, which hide the slow tail that real users notice.
- **SLIs based on internals** rather than user-visible outcomes.
- **Alerting on every blip** instead of on budget burn.
- **No policy for what happens when the budget runs out.** Without consequences the SLO is decoration.
- **Setting SLO equal to SLA**, leaving no margin to fix problems before paying penalties.
