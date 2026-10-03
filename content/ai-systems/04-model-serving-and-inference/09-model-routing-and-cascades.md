---
title: "Model Routing and Cascades: Small-to-Large Fallback and MoE Routing"
short_title: "Model Routing and Cascades"
tags: ["routing", "cascades", "moe", "inference", "cost-optimization"]
sources:
  - "FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance (Chen et al., 2023)"
  - "Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity (Fedus et al., 2021)"
  - "Mixtral of Experts (Jiang et al., 2024)"
  - "RouteLLM: Learning to Route LLMs with Preference Data (Ong et al., 2024)"
---

## Two different problems called "routing"

"Routing" in LLM serving refers to two unrelated mechanisms that get conflated because they share vocabulary: **request-level routing** (deciding which whole model handles a given query) and **token-level routing** (deciding which sub-network inside a single model processes a given token, as in Mixture-of-Experts). Both exist to avoid paying full-model cost for every unit of work, but they operate at completely different granularities and are implemented in different layers of the stack.

## Request-level cascades: small model first, escalate on demand

A **cascade** tries a cheap, fast model first and only invokes a larger, more expensive model when the cheap one's answer looks unreliable. The classic example: run a query through a small model (or a quantized/distilled variant), score the output's confidence — using log-probabilities, a learned scorer, or a cheap verifier model — and re-route to a stronger model only when that score falls below a threshold. FrugalGPT formalized this pattern with a cascade of increasingly expensive LLM APIs, showing cost reductions of up to 98% while matching or exceeding the best single model's accuracy on some tasks, because most queries in real traffic are easy and don't need the expensive model at all.

The engineering complexity is in **the router itself**, which comes in three flavors of increasing sophistication:

- **Rule-based routing**: hand-written heuristics (query length, presence of code, detected task type) send traffic to a matching model tier. Cheap to build, brittle to maintain.
- **Confidence-based cascades**: use the small model's own output signal (perplexity, self-consistency across samples, an explicit "I'm not sure" detector) to decide whether to escalate.
- **Learned routers** (e.g., RouteLLM): train a classifier on human preference data to predict, before generation, which model tier will produce an acceptably good response for a given prompt — avoiding the latency cost of running the cheap model at all when it's predictably going to fail.

The core tradeoff is **false negatives**: a cascade that under-escalates ships bad answers cheaply, which is often worse than the cost it saved. Production cascades need an evaluation harness that specifically measures escalation miss rate, not just aggregate cost and quality.

## MoE routing: token-level sparsity inside one model

Mixture-of-Experts architectures (Switch Transformer, Mixtral) replace a dense feed-forward layer with several parallel "expert" feed-forward networks and a small **gating network** that, per token, selects the top-k experts (often k=1 or k=2) to actually run. The model has a large total parameter count — Mixtral 8x7B has ~47B total parameters — but only activates a fraction of it per token (Mixtral uses 2 of 8 experts, ~13B active parameters), so inference cost tracks the *active* parameter count, not the total.

This is a **training-time and architecture-level** decision, not something a serving team can bolt on — the gating network is trained jointly with the experts. What serving teams do inherit is the operational consequence: MoE models need enough GPU memory to hold *all* experts (since routing is data-dependent and any expert might be needed), even though only a couple run per token. This creates a distinctive serving profile — high memory footprint, comparatively low compute per token — that pairs well with tensor or expert parallelism across GPUs, and load-balancing across experts (avoiding "hot" experts that get routed to disproportionately) matters for GPU utilization at scale.

## When to use which

Cascades are a **product/cost engineering** decision — apply them when a large fraction of real traffic is genuinely easy and a cheaper model can handle it, and you're willing to own a router's failure modes. MoE routing is a **model architecture** decision made upstream; a serving team's job is choosing infrastructure (memory, parallelism strategy) that matches an MoE model's activation pattern, not building the routing logic itself.

## Common mistakes

- **Routing on cost alone, ignoring escalation latency.** A cascade that calls a small model, waits, then calls a large model sequentially can be slower end-to-end than just calling the large model directly — parallel speculative calls or aggressive escalation thresholds are often necessary to keep p99 latency acceptable.
- **Treating MoE as "sparse" for memory purposes.** All experts must be resident in GPU memory even though few run per token; teams sometimes assume MoE reduces memory needs and get surprised by VRAM requirements at deploy time.
- **No feedback loop on router quality.** A learned or heuristic router trained once and never re-evaluated drifts as the underlying models and traffic distribution change; router accuracy needs the same monitoring as model accuracy.
