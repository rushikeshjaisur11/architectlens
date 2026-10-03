---
title: "Shadow Deployments and Canary Releases for LLM Features"
short_title: "Shadow Deployments and Canary Releases"
tags: ["reliability", "deployment", "production", "llm"]
sources:
  - "Google SRE Book, chapter on canary releases and progressive rollout"
  - "Anthropic and OpenAI documentation on prompt/model version management"
---

## Why deploying an LLM change is riskier than it looks

A code deployment for a traditional feature can usually be validated with deterministic tests before shipping — given the same input, the same output is expected every time, so a passing test suite is a fairly strong signal. An LLM-powered feature doesn't have this property: model outputs vary, a prompt change can have effects that only show up on specific input distributions not well-represented in a test set, and even a seemingly minor change (rewording an instruction, adjusting a few-shot example) can shift behavior in ways that are hard to predict from reading the change alone. This is why LLM feature changes — a new prompt, a different model version, an updated RAG configuration — warrant a more cautious rollout process than a typical deterministic code change, even when the change looks small.

## Shadow deployment: testing in production without affecting users

A **shadow deployment** runs a new version of an LLM pipeline (new prompt, new model, new retrieval configuration) alongside the existing production version, on real production traffic, but without showing its output to users — the new version's output is logged and compared against the existing version's output, purely for evaluation purposes. This gets the benefit of testing against genuine, unfiltered real-world input distribution (which no offline eval set, however carefully built, fully replicates) without any risk of a user-facing regression, since the shadow version's output never actually reaches a user.

The cost: running two versions of the pipeline in parallel roughly doubles the compute cost for the shadowed traffic during the evaluation period, and shadow deployment works best for changes where comparing two outputs for the same input is meaningful (which is most cases) — it's less useful for changes that are stateful across a conversation in ways that are hard to shadow cleanly (an agent's tool-call side effects, for instance, generally shouldn't be duplicated by a shadow version, which limits shadow testing's applicability for fully agentic changes with real side effects).

## Canary releases: gradual, monitored rollout to real users

Where shadow deployment tests a change without exposing any users to it, a **canary release** exposes the new version to a small, controlled fraction of real users (say, 1-5%), monitoring quality metrics (from this track's evaluation lesson: validation failure rate, user feedback signals, latency, cost) closely during this limited exposure before deciding whether to expand the rollout further. If the canary's metrics look healthy relative to the existing version, the rollout expands gradually (5% → 25% → 100%); if metrics degrade, the rollout is halted and rolled back, with only a small fraction of users having been affected by the issue, rather than the entire user base.

This connects directly to this track's production-reliability lesson's broader point about failure handling — a canary release is itself a failure-containment mechanism, limiting the blast radius of a problematic change to a small, bounded fraction of traffic rather than discovering a regression only after it's already affecting every user.

## Why LLM-specific rollouts need LLM-specific metrics, not just standard ones

A canary rollout for a typical software change monitors error rates and latency — necessary but insufficient for an LLM feature change, since the more common and harder-to-detect failure mode is a *quality* regression that doesn't manifest as an error at all (the soft-failure category from this track's production-reliability lesson). A canary rollout for an LLM change needs its evaluation metrics (from the evaluation lesson: validation failure rate, model-graded quality scores against a held-out eval set, user feedback signals like regeneration rate) monitored alongside the standard operational metrics — a canary that only checks "is the error rate elevated" can miss a real quality regression that produces technically successful, but subtly worse, responses.

## A worked example

**Scenario:** a team wants to switch a production RAG-based support assistant from one embedding model to another (per this track's embedding-model evaluation lesson), a change with real potential to affect retrieval quality in ways not fully captured by offline evals alone.

- **Shadow deployment first**: the new embedding model's retrieval is run in shadow against a meaningful slice of real production queries for a period, with retrieved chunks and (where feasible) generated responses logged and compared against the existing model's output — surfacing any systematic differences in what gets retrieved before any real user is exposed to the change.
- **Offline eval comparison** (per the embedding-model lesson's methodology) runs alongside the shadow deployment, not instead of it — the shadow deployment's real-traffic data complements, rather than replaces, the more controlled offline eval set, since real traffic can surface distributional edge cases the offline eval set didn't anticipate.
- **Canary rollout follows**, starting at a small percentage of real users, with retrieval quality proxies (validation failure rate, a sampled model-graded relevance check, user feedback signals like explicit thumbs-down or regeneration requests) monitored specifically, not just error rate and latency — since the actual risk here is a subtle retrieval-quality regression, not an outright failure, and only quality-specific metrics would reliably catch it.
- **Gradual expansion**: the rollout percentage increases only after each stage's monitoring window shows no quality regression, with an explicit, pre-defined rollback trigger (a specific threshold on the quality metrics) rather than a vague "keep an eye on it" plan.

## Common mistakes

- **Rolling out an LLM change to 100% of traffic immediately after passing offline evals**, treating offline eval performance as sufficient validation on its own — offline eval sets, however well-built, don't perfectly replicate the full distribution and volume of real production traffic, which is exactly what shadow deployment and canary rollout exist to validate against.
- **Monitoring only standard operational metrics (error rate, latency) during a canary rollout for an LLM change**, missing the quality-regression failure mode that's specific to and more common in LLM feature changes than in typical deterministic code changes.
- **No predefined rollback trigger or threshold**, leaving the decision to halt a problematic rollout as a judgment call made under pressure once something already looks wrong, rather than a clear, pre-agreed threshold that triggers rollback automatically or with minimal deliberation.
