---
title: "Designing for Cost at Scale for LLM Products"
short_title: "Cost at Scale for LLM Products"
tags: ["cost", "unit-economics", "optimization", "routing", "caching", "design"]
sources:
  - "Chen, Zaharia and Zou, 'FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance' (2023)"
  - "Provider documentation on prompt caching, batch APIs and token pricing"
  - "FinOps Foundation guidance on unit economics"
  - "Anthropic pricing documentation (fetched Oct 2026)"
  - "Google Gemini API pricing (fetched Oct 2026)"
banner:
  layout: line
  nodes:
    - [user, "traffic"]
    - [server, "router"]
    - [model, "small model"]
    - [gpu, "large model"]
---

## The problem

A feature that costs 4 cents per use is a rounding error at 1,000 users and a threat to the business at 10 million. LLM products have a **variable cost per interaction** that scales with usage, unlike most software with near-zero marginal cost. Designing for cost means understanding unit economics early and building a system whose cost per outcome falls as it scales, without wrecking quality.

## Step 1: Start with unit economics

Define the unit that matters, such as **cost per resolved support ticket**, per document processed, per active user per month, and compare it with the value or price. Break the cost into drivers:

- Input tokens (prompt, context, retrieved documents), output tokens (usually priced higher), cached input tokens (cheaper).
- Number of model calls per user action (agents and multi-step chains multiply it).
- Retrieval, embedding, reranking and tool costs.
- Hosting costs for self-hosted models, vector stores, queues and observability.
- Failure overhead: retries, regenerations and abandoned requests.

A simple model: cost per action equals calls times (input tokens times input price plus output tokens times output price). Find which factor dominates before optimising anything.

## Step 2: The lever hierarchy

Order optimisations by impact and risk, applying the safest first:

1. **Remove waste:** trim system prompts, drop irrelevant context, avoid resending full history, cap output length, set sensible max tokens, stop retry storms.
2. **Cache:** provider **prompt caching** for stable prefixes, exact-match response caching, and carefully scoped semantic caching for repeated questions.
3. **Right-size the model:** route each request to the cheapest model that meets the quality bar, using tiers and cascades.
4. **Change the architecture:** fewer sequential calls, parallelise, replace an LLM step with code or a small classifier, summarise once and reuse.
5. **Batch and defer:** move non-urgent work to batch APIs with discounts and off-peak capacity.
6. **Own the inference:** self-host open models for high, steady volume when GPU utilisation can stay high.
7. **Distil or fine-tune:** train a small model on a larger one's outputs for a narrow task with huge volume.

## Step 3: Routing and cascades

Most traffic is easy. A **router** (rules, a classifier, or a small model) sends simple requests to a small, cheap model and hard ones to a strong model. A **cascade** tries the cheap model first and escalates when its confidence or a verifier says the answer is poor. Measure with the evaluation platform: the routed system's quality versus all-strong, and its cost. Watch the escalation rate: if too many requests escalate, the cascade costs more than just calling the strong model.

## Step 4: Context and token discipline

Context is usually the biggest cost. Retrieve fewer, better chunks (rerank and cut), compress or summarise long histories, keep stable instructions first so they are cached, and use structured outputs to avoid verbose prose. Set **token budgets per feature** and monitor average and tail usage; long-tail requests (huge attachments) get separate limits or handling.

## Step 5: Self-hosting versus APIs

APIs have no idle cost and give access to frontier models; self-hosting gives lower marginal cost at high **sustained utilisation** and control over data. The break-even depends on volume, model size, batching efficiency and engineering cost. Compute it: GPU cost per hour divided by sustained tokens per hour, versus API price, including the people and tooling needed to run it. Mixed strategies are common: self-host the high-volume small-model path and call APIs for the hard tail.

## Step 6: Controlling spend dynamically

- **Budgets and quotas** per feature and customer, with graceful degradation to cheaper models.
- **Rate limits** on expensive operations, abuse protection for free tiers.
- **Pricing and packaging:** align plans with cost drivers (usage caps, credits, tiered models).
- **Anomaly detection** and spend circuit breakers to stop runaway loops.
- **Feature flags** to switch off or downgrade costly features during incidents or price spikes.

## Step 7: Preserve quality while saving

Every saving has a quality risk, so tie each change to evidence: run the evaluation set, compare against baseline, canary in production, and track user-facing metrics (resolution, satisfaction) alongside cost. Automate **cost-quality dashboards** that show each model route's price and score, so the frontier is visible. Revisit regularly because prices fall and new models change the best trade-off.

## A worked example

**Scenario:** a document Q&A feature costs 6 cents per question and a growth plan would make it unaffordable.

1. Breakdown: 70 percent of spend is input tokens: each question sends 12 retrieved chunks and the full 8-turn history.
2. Waste removal: reranking cuts chunks from 12 to 5, history is summarised after four turns, and the stable instructions are moved to the front to use provider prompt caching. Cost drops to 3.1 cents with unchanged evaluation scores.
3. Routing: a small classifier detects simple factual lookups (62 percent of traffic); a small model answers them with a verifier. The cascade escalates 9 percent to the strong model. Average cost falls to 1.4 cents; quality on the golden set is within noise.
4. Batch: nightly document pre-summarisation moves to a batch API at half price.
5. Dashboards now show cost per resolved question at 1.1 cents, and a budget alert guards against regression; a monthly review picks up a new cheaper model, which passes evaluation and lowers the small-model tier further.

## Enterprise practice (verified October 2026)

**Basics.** Route by difficulty, cache, shorten prompts, batch what can wait (steps above).

**Numbers to design with (live-checked, October 2026).** Caching reads cost 10% of input on most Claude models, so a prompt that is 90% stable prefix cuts input cost by roughly 80% (0.1 x 90% + 10% = 19% of original). Batch is 50% off. Together, a nightly summarisation job on Haiku 4.5 drops input from $1.00 to $0.05 per million tokens. Context windows of **1M tokens are priced at the standard rate** on Claude 4.6 and later (no long-context surcharge), which changes the "chunk or stuff" decision: stuffing is now a cost and latency choice, not a price-tier one. **Small models are not free of caveats**: output tokens cost 5x input on Claude and 5x on Gemini Flash, so verbose answers dominate the bill; cap output length and ask for structured, short results.

**Enterprise pattern.** Maintain a cost model per feature (requests x tokens x rate x (1 - cache hit rate)) and review it against actuals monthly. Revisit routing every time providers reprice: in 2026 list prices moved down for mid-tier models (Sonnet 5 at $2/$10) while top-tier models (Fable 5.1 at $10/$50) stayed expensive, so last year's "always use the small model" rule may be wrong.

## Common mistakes

- **Optimising before measuring** which cost driver dominates.
- **Sending every request to the largest model.**
- **Cascades that escalate too often**, costing more than they save.
- **Savings with no quality check**, discovered by users instead of evaluations.
- **Ignoring pricing and packaging**, leaving heavy users unpriced.
