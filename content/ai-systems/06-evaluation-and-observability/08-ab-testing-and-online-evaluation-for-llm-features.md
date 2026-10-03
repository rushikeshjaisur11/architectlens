---
title: "A/B Testing and Online Evaluation for LLM Features"
short_title: "A/B Testing for LLM Features"
tags: ["evaluation", "ab-testing", "observability", "experimentation"]
sources:
  - "Kohavi, Tang, Xu, \"Trustworthy Online Controlled Experiments\" (2020)"
  - "Netflix Tech Blog on experimentation platforms"
  - "OpenAI/Anthropic API usage and evaluation documentation"
---

## Why online testing is still necessary

Offline evals (golden sets, LLM-as-judge) answer "is this output good by our rubric?" They can't answer "does this actually make users more successful, more satisfied, or more likely to convert?" — because real usage patterns, tolerance for latency, and perceived quality only show up when real users interact with the system. **Online evaluation**, usually via A/B testing, is how LLM changes get validated against real behavioral outcomes rather than proxy metrics.

## Standard A/B mechanics, applied to LLM features

The core machinery is unchanged from classic controlled experiments (Kohavi et al.): randomly assign users or sessions to control (existing prompt/model) and treatment (new prompt/model), hold everything else constant, and compare a pre-registered primary metric with a significance test. What's different for LLM features:

- **Unit of randomization matters more.** Randomizing per-request instead of per-user causes a single user to see inconsistent behavior across a session (different prompt styles turn to turn), which confounds both the user's experience and the metric. Randomize at the user or session level unless testing something request-scoped like retrieval ranking.
- **Metrics need an LLM-aware layer.** Beyond standard product metrics (conversion, retention, session length), LLM features need engagement metrics specific to generation quality: regeneration rate, edit distance between generated and user-edited output (for copilot-style features), thumbs-up/down rate, and task completion rate for agentic flows.
- **Guardrail metrics catch silent failure.** Latency, cost per request, and refusal/error rate should be tracked as guardrails even when they're not the primary metric — a new prompt that improves the primary metric by increasing verbosity can quietly double token cost and latency.

## Statistical considerations specific to LLM outputs

- **High variance from stochastic generation** means LLM output-quality metrics often need larger sample sizes than typical UI experiments to reach significance — nonzero temperature adds noise on top of natural user variance. Consider lowering temperature for the experiment itself if determinism doesn't hurt the feature, to tighten variance.
- **Novelty effects are pronounced.** Users interacting with a new AI feature for the first time behave differently than they will after the novelty wears off; run experiments long enough (typically 2+ weeks) to see post-novelty behavior, not just launch-week enthusiasm.
- **Sequential testing pitfalls apply.** Peeking at results early and stopping as soon as significance is hit inflates false-positive rate — use a pre-registered sample size or a proper sequential testing method (e.g., always-valid p-values), not ad hoc peeking.

## Combining online and offline evaluation

Offline evals and A/B tests aren't substitutes — they're sequential gates:

1. **Offline eval (golden set + LLM-as-judge)** filters out clearly broken candidates cheaply, before any user sees them.
2. **Shadow mode / silent A/B** runs the new variant against live traffic without showing it to users, comparing its outputs to production for divergence, catching failures offline evals missed without any user exposure.
3. **Small-percentage online A/B** (1-5% of traffic) validates real behavioral impact with bounded blast radius.
4. **Staged rollout** ramps the winning variant to 100% while continuing to watch guardrail metrics, since production monitoring (drift, hallucination rate) is what catches degradation the initial experiment window didn't run long enough to see.

## Common mistakes

- **Skipping straight to A/B without offline filtering first**, which wastes real user exposure on variants that a cheap golden-set run would have already disqualified.
- **Picking a primary metric that's a proxy for a proxy** — optimizing thumbs-up rate when the real goal is task success can reward answers that sound satisfying rather than answers that are correct.
- **Under-powering the experiment** by not accounting for LLM output variance, leading to "no significant difference" conclusions that are really just insufficient sample size.
