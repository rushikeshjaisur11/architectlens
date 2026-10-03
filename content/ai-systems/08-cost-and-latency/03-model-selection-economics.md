---
title: "Model Selection Economics: Cost-Per-Quality Tradeoffs Across Tiers"
short_title: "Model Selection Economics"
tags: ["cost", "model-selection", "llm", "economics"]
sources:
  - "Anthropic model pricing and comparison docs (docs.anthropic.com)"
  - "OpenAI model pricing page (openai.com/api/pricing)"
  - "Artificial Analysis LLM benchmark and cost leaderboard (artificialanalysis.ai)"
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

## Common mistakes

- **Picking the flagship model once and never revisiting.** Provider pricing and tier capabilities shift every few months; a routing decision made a year ago is often stale.
- **Benchmarking on public leaderboards instead of your own eval set.** A model that wins on general reasoning benchmarks can underperform a cheaper model on your specific structured-extraction task.
- **Optimizing cost per token instead of cost per successful outcome.** Ignoring retry rates and downstream failure costs makes the "cheap" model look artificially attractive.
- **Static routing with no fallback.** A router that sends a request to a small model with no escalation path when confidence is low will silently ship worse answers instead of paying for the upgrade only when needed.
