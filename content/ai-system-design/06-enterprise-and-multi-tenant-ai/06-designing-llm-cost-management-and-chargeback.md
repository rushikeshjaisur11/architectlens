---
title: "Designing LLM Cost Management and Chargeback"
short_title: "Cost Management and Chargeback"
tags: ["cost", "finops", "chargeback", "budgets", "attribution", "design"]
sources:
  - "FinOps Foundation framework and capabilities documentation"
  - "Provider pricing documentation for input, output and cached tokens"
  - "Public cloud cost allocation and tagging guidance"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched Oct 2026)"
  - "Google Gemini API pricing, ai.google.dev/gemini-api/docs/pricing (fetched Oct 2026)"
  - "Third-party OpenAI price trackers (OpenAI's pricing page returned 403; figures unverified at source)"
banner:
  layout: line
  nodes:
    - [client, "teams"]
    - [server, "metering"]
    - [db, "ledger"]
    - [doc, "chargeback"]
predict:
  question: "A route's tokens tripled after a prompt change. The team trims the history to the last five messages and caches the shared instructions. What happens to evaluation quality scores?"
  options: ["They drop by roughly 70 percent along with cost", "They show no change while cost per call falls by 70 percent", "They improve because shorter prompts always help"]
  answer: 1
  why: "The route's cost per call fell 70 percent with no change in quality scores in the evaluation platform."
check:
  - q: "Why reject untagged gateway calls or put them in a reported 'unattributed' bucket?"
    options: ["Untagged calls cannot be priced because the price catalogue needs a tag", "Spend with no team or feature cannot be charged back or explained", "Providers refuse requests that lack a cost-centre header"]
    answer: 1
    why: "Attribution by team and feature is the point of metering, so unattributed spend is treated as a problem to report."
  - q: "Why show idle GPU capacity separately instead of spreading it across team costs?"
    options: ["Hidden idle cost makes teams' own usage look more expensive than it is", "Idle capacity is free once the node is purchased", "Spreading it would double count tokens already metered"]
    answer: 0
    why: "Unused capacity is shown separately so it is not hidden inside team costs."
  - q: "Why add budget alerts and circuit breakers instead of only reviewing spend monthly?"
    options: ["Alerts replace the need to meter tokens at the gateway", "Circuit breakers are cheaper than computing monthly invoices", "Monthly review finds a runaway only after the money is gone"]
    answer: 2
    why: "Hourly anomaly detection and breakers catch loops within hours, while a monthly review is too late."
---

## The problem

LLM spend grows quickly and unpredictably: a loop, a long context or a new feature can multiply the bill in a day. Finance asks who spent what; teams want to know what their features cost; leadership wants forecasts. **Cost management** attributes every token to a team and feature, enforces budgets, and gives engineers the visibility to make economical choices, while **chargeback** or **showback** turns that data into accountability.

## Step 1: Requirements

- **Attribution:** cost per team, product, feature, environment and, where useful, per customer.
- **Accuracy:** tokens priced correctly, including cached, input and output rates and provider-specific rules.
- **Control:** budgets and quotas with alerts and automatic limits.
- **Visibility:** dashboards, anomaly detection, forecasts, unit economics.
- **Fairness:** shared platform costs allocated understandably.
- **Scale (example):** 80 teams, 3 providers plus self-hosted models, $2M a month.

## Step 2: Capturing usage

Route all model calls through the **LLM gateway** so every call is metered at one point. Each request records: caller identity (service, team, project), feature or route tag, model and provider, input, output and cached token counts, latency, status, request id and timestamp. Require tags at the gateway: a call without a team and feature tag is rejected or assigned to a "unattributed" bucket that is itself reported as a problem. For self-hosted models record GPU-seconds or tokens per replica.

## Step 3: Pricing the tokens

Maintain a **price catalogue**: per model and provider, with effective dates for changes, rates for input, output, cached input and batch discounts, and committed-use discounts. Compute cost per request from tokens times the effective price at that time. Reconcile daily against the provider's invoices and usage exports; large differences reveal missing instrumentation or price errors. For self-hosted models, allocate GPU cost by usage: the node's hourly cost divided across tenants by their share of tokens or GPU-seconds, with unused capacity shown separately so it is not hidden inside team costs.

## Step 4: Allocation models

- **Showback:** teams see their costs but are not billed; creates awareness with no internal billing machinery.
- **Chargeback:** costs are transferred to team budgets; creates stronger incentives but needs trusted data and a process for disputes.
- **Shared costs** (platform, evaluation, gateway) are allocated by usage proportion, by headcount, or held centrally; document the rule so it is predictable.
- **Customer-level attribution:** for products sold to customers, tag requests with the customer id (hashed if sensitive) to compute margin per customer and spot unprofitable accounts.

## Step 5: Budgets and enforcement

Soft limits warn; hard limits stop. A layered approach:

- **Alerts** at 50, 80 and 100 percent of the monthly budget, with the top cost drivers.
- **Per-key and per-team quotas** enforced in the gateway (tokens per minute, per day, per month).
- **Circuit breakers** for runaway spend: if hourly spend exceeds a multiple of the baseline, throttle or pause the offender and page the owner.
- **Graceful degradation** when a limit is reached: switch to a cheaper model, shorten outputs, serve cached answers, or queue batch work, before rejecting outright.
- **Approval for exceptions:** teams can request temporary increases with an owner's sign-off.

## Step 6: Making cost visible and actionable

Dashboards by team, feature and model; cost per request and per user action (unit economics); top prompts by tokens; cache hit rates and their savings; share of spend on frontier versus smaller models; trend and forecast against budget. **Anomaly detection** on hourly spend per team catches loops and misconfigurations within hours. Attach cost to traces so engineers can see which step of a chain dominates. Suggest optimisations automatically: long system prompts, uncached repeated prefixes, over-qualified models for simple routes.

## Step 7: Governance and culture

Review model choices with cost and quality evidence, set targets for cost per resolved task rather than raw spend (a larger bill may be justified by value), and include cost in the definition of done for new AI features. Forecast with usage drivers (users, requests per user, tokens per request) and scenario analysis for price changes and new launches.

## A worked example

**Scenario:** the monthly report shows spend up 60 percent, mostly in the "support-assistant" project.

1. The gateway data breaks the increase down by route: the "summarise ticket" route's tokens tripled after a prompt change that added the entire ticket history.
2. The price catalogue calculation shows the change cost $41,000 extra for the month, versus an expected $4,000.
3. An anomaly alert had fired two days after the deploy, but the team's budget alert threshold was set too high to page anyone; the platform lowers default thresholds and requires an owner contact.
4. The team trims the history to the last five messages and caches the shared instructions; the route's cost per call falls by 70 percent with no change in quality scores in the evaluation platform.
5. Chargeback for the month reflects actual use; the saved amount is reported in the savings dashboard as evidence for the optimisation.

## Enterprise practice (verified October 2026)

**Basics.** Meter tokens per request, attribute them to team, product and feature, and enforce budgets at the gateway (steps above).

**Live price levers (October 2026; prices change, so store them as data).**

- **Prompt caching.** Anthropic: cache write 1.25x (5 minute) or 2x (1 hour) base input; cache read **0.1x** (0.05x on Opus 5.5, 0.025x on Fable 5.1). A 5-minute cache pays off after one read, a 1-hour cache after two. Gemini: implicit caching on by default, cached input around 90% cheaper, explicit caching adds a storage charge.
- **Batch.** 50% off input and output on Anthropic and Gemini; OpenAI Batch and Flex are also reported at 50% off. Batch discounts stack with caching, but **fast mode and the Managed Agents product are excluded**.
- **Premium tiers.** OpenAI Priority is reported at roughly 2x standard; Anthropic fast mode for Opus is roughly 2x. Use them for latency-critical paths only.
- **Data residency.** Anthropic `inference_geo: "us"` is **1.1x**; Bedrock and Vertex regional endpoints carry about a **10% premium** over global. Residency is a cost line, not a free switch.
- **Tokenizer drift.** Anthropic notes Claude 4.7 and later models produce about **30% more tokens** for the same text, so a model swap changes cost even at equal list price.
- **Per-call extras.** Web search is $10 per 1,000 searches on Claude and $14 per 1,000 after 5,000 free on Gemini; tool definitions and computer-use toolsets add thousands of input tokens per request; Managed Agents bill $0.08 per session-hour on top of tokens.
- **Example anchors.** Claude Sonnet 5.5 $2 in / $10 out per million tokens; Haiku 4.5 $1 / $5; Opus 5.5 $4 / $20. Gemini 3.8 Flash $0.75 / $3.75 (introductory through 31 December 2026, then double); 3.5 Flash-Lite $0.30 / $2.50.

**Enterprise pattern.** Chargeback needs the *effective* rate: record input, cached, output and tool tokens separately, multiply by the rate card version in force at that time, and show cache hit rate per team. Provisioned throughput (for example Vertex GSUs on 1-week to 1-year commitments) trades flexibility for lower unit cost; model it against your utilisation curve before committing.

## Common mistakes

- **Calls bypassing the gateway**, leaving spend unattributed.
- **Ignoring cached and output token pricing**, misstating cost.
- **Only monthly review**, finding the runaway after the money is gone.
- **Hiding idle GPU cost** inside team numbers.
- **Optimising spend without quality evidence**, trading savings for regressions.
