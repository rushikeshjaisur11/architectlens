---
title: "Model Selection Economics: Cost-Per-Quality Tradeoffs Across Tiers"
short_title: "Model Selection Economics"
tags: ["cost", "model-selection", "llm", "economics"]
sources:
  - "Anthropic model pricing and comparison docs (docs.anthropic.com)"
  - "OpenAI model pricing page (openai.com/api/pricing)"
  - "Artificial Analysis LLM benchmark and cost leaderboard (artificialanalysis.ai)"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched October 2026)"
  - "Google Gemini API pricing, ai.google.dev/gemini-api/docs/pricing (fetched October 2026)"
banner:
  layout: line
  nodes:
    - [doc, "task"]
    - [model, "small"]
    - [model, "large"]
    - [db, "cost per task"]
predict:
  question: "Model A costs $5 per million output tokens and averages 300 output tokens per response. Model B costs $10 per million and averages 100. Which is cheaper per response on output cost?"
  options: ["Model A, because its per-token rate is half of Model B's", "They cost the same, since output volume and rate offset exactly", "Model B, because its terser output costs less in total"]
  answer: 2
  why: "A is 300 x $5 = 1,500 units versus B at 100 x $10 = 1,000, so verbosity can outweigh a cheaper rate."
check:
  - q: "Why measure cost per successful output instead of cost per token?"
    options: ["A cheaper model that needs retries or fails downstream can cost more per correct answer", "Token pricing changes too often to compare, whereas per-answer costs stay fixed over time", "Cost per token ignores input tokens, which are the larger share of most bills"]
    answer: 0
    why: "Retry loops and downstream failures make a cheap-per-token model look artificially attractive."
  - q: "Why build your own eval set instead of picking a model from public leaderboards?"
    options: ["Leaderboards only list flagship models, so mid-tier options can't be compared there", "General capability rankings don't transfer cleanly to narrow tasks like structured extraction", "Leaderboards are updated too slowly to reflect any change in provider pricing or tiers"]
    answer: 1
    why: "A model that wins general benchmarks can underperform a cheaper one on your specific task."
  - q: "A router sends easy requests to a small model but has no escalation path on low confidence. What is the risk?"
    options: ["Costs rise, since low-confidence requests are retried on the small model repeatedly", "The router itself becomes expensive, because it must score every request twice", "Worse answers ship silently, instead of paying for the upgrade only when needed"]
    answer: 2
    why: "Static routing without fallback trades quality for savings invisibly."
---

## The core mental model

Every model family ships in tiers — Anthropic's Haiku/Sonnet/Opus, OpenAI's mini/standard/flagship (e.g., GPT-5-mini vs. GPT-5), Google's Flash/Pro — and the tiers aren't just "faster/slower." They trace a **cost-per-quality curve**: each step up roughly multiplies price per token (often 3-10x) for an incremental quality gain that is frequently much smaller than the price jump, especially on tasks that don't require frontier reasoning. Picking a model isn't picking "the best one" — it's finding where your task sits on that curve and choosing the cheapest tier that clears your quality bar.

The mistake most teams make is defaulting to the flagship model for every call in a system, then optimizing later. The right default is the opposite: assume the cheapest tier works, prove otherwise with evals, and escalate only the calls that need it.

## Task-tiering, not model-tiering

Production systems rarely use one model. A well-architected pipeline routes by task difficulty:

- **Classification, extraction, routing, simple rewrites** → smallest/cheapest tier (Haiku, GPT-5-mini, Gemini Flash). These tasks have narrow output spaces and don't benefit from extra reasoning depth; a frontier model spending more compute here is pure waste.
- **Multi-step reasoning, code generation, ambiguous instructions** → mid tier (Sonnet, GPT-5).
- **Final synthesis, high-stakes judgment calls, hard reasoning chains** → top tier (Opus, GPT-5 with extended thinking) — used sparingly, often just once per pipeline run.

This is the same principle as cascading/routing architectures: cheap models handle the volume, expensive models handle the tail. A common implementation is a **router model** (itself cheap) that classifies incoming requests and dispatches to the appropriate tier — the router's own cost is negligible compared to what it saves by avoiding flagship calls for easy requests.

## Measuring the curve, not guessing it

"This model is smarter" is not a number you can budget against. Building the actual cost-per-quality curve for your task requires:

- **A held-out eval set** representative of production traffic (not cherry-picked hard examples) scored on your actual success metric — not a generic benchmark like MMLU, which rarely predicts your task's accuracy.
- **Cost per successful output**, not cost per token or cost per call. A cheaper model that needs a retry loop or produces more failures downstream can cost more per correct answer than a pricier model that's right the first time.
- **Marginal quality per dollar**, plotted tier over tier. Frequently the jump from smallest to mid tier buys a large accuracy gain, while mid to flagship buys a small one — meaning the flagship tier is justified only for the subset of traffic that actually needs it.

Public leaderboards (Artificial Analysis, LMSYS/Chatbot Arena) are useful for a first cut across providers but should never substitute for your own eval — general capability rankings don't transfer cleanly to narrow production tasks like structured extraction or domain-specific classification.

## Output tokens dominate the bill

Pricing is asymmetric: output tokens typically cost 3-5x input tokens across providers. A model tier decision interacts directly with **output verbosity** — a chattier model at a cheaper per-token rate can still cost more than a terser model at a higher rate if it burns 3x the output tokens per response. Prompting for concise, structured output (see prompting fundamentals) is part of the model-selection decision, not a separate optimization.

## Current practice (verified October 2026)

List-price anchors (October 2026): Claude Haiku 4.5 $1/$5 per million tokens, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, top tier $10/$50; Gemini 3.8 Flash $0.75/$3.75 (introductory through 31 December 2026) and 3.5 Flash-Lite $0.30/$2.50. Effective cost depends on cache hit rate, batch eligibility, output length and retries, so compare **cost per successful task** on your evaluation set, not list price. Mid-tier models repriced downward in 2026 (Sonnet 5 at $2/$10 versus $3/$15 for Sonnet 4.6), so last year's routing rules may be wrong.

## Common mistakes

- **Picking the flagship model once and never revisiting.** Provider pricing and tier capabilities shift every few months; a routing decision made a year ago is often stale.
- **Benchmarking on public leaderboards instead of your own eval set.** A model that wins on general reasoning benchmarks can underperform a cheaper model on your specific structured-extraction task.
- **Optimizing cost per token instead of cost per successful outcome.** Ignoring retry rates and downstream failure costs makes the "cheap" model look artificially attractive.
- **Static routing with no fallback.** A router that sends a request to a small model with no escalation path when confidence is low will silently ship worse answers instead of paying for the upgrade only when needed.
