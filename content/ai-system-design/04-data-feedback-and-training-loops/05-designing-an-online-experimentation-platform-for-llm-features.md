---
title: "Designing an Online Experimentation Platform for LLM Features"
short_title: "Online Experimentation Platform"
tags: ["experimentation", "ab-testing", "statistics", "llm-features", "metrics", "design"]
sources:
  - "Kohavi, Tang and Xu, Trustworthy Online Controlled Experiments (Cambridge University Press, 2020)"
  - "Johari et al., 'Peeking at A/B Tests: Why it matters, and what to do about it' (KDD 2017)"
  - "Public documentation of experimentation and feature-flag platforms"
---

## The problem

Offline evaluation tells you a new prompt or model is probably better; only real users show whether it actually improves the product. An **experimentation platform** randomly assigns users to variants, measures outcomes and tells teams, with honest statistics, whether to ship. LLM features add complications: outputs are non-deterministic, quality is subjective, costs and latency vary per variant, and the best metrics (was the answer helpful?) are hard to measure.

## Step 1: Requirements

- **Assignment:** consistent, random, unbiased allocation of users or sessions to variants, with traffic ramps and exclusions.
- **Variants:** prompt versions, models, retrieval settings, parameters, whole pipelines.
- **Metrics:** product outcomes (task success, retention), quality signals (feedback, judge scores), and guardrails (latency, cost, safety).
- **Analysis:** valid statistics, confidence intervals, segment breakdowns, and protection against common errors.
- **Safety:** quick kill switch and automatic stop on guardrail breaches.
- **Scale (example):** 200 concurrent experiments, 50 million users.

## Step 2: Assignment and exposure

Hash a stable unit id (user, account or session) with the experiment id to assign a variant deterministically, so a user always sees the same variant and no assignment lookup is needed. Choose the **unit of randomisation** carefully: use the user if experiences persist across sessions; use the account for B2B so teammates see the same behaviour; use the conversation only when sessions are independent. Log an **exposure event** when a user actually encounters the variant, since analysing assigned-but-never-exposed users dilutes the effect. Support **layers** so independent experiments on different components can overlap without interfering, and mutually exclusive groups for conflicting ones.

## Step 3: Choosing metrics for LLM features

- **Primary metric:** one decision metric tied to value (task completion, resolution without escalation, accepted suggestion rate), chosen before the test.
- **Quality proxies:** thumbs rates, edit distance on accepted outputs, reformulation rate, and **online judge scores** on a sample. Validate each proxy against human judgement.
- **Guardrail metrics:** latency, time to first token, cost per request, refusal and error rate, safety flags. A variant that wins on quality but doubles cost or latency may not ship.
- **Long-term metrics:** retention and repeat usage, which can reverse short-term wins (a flattering style may raise thumbs-up today and hurt trust later).

Beware feedback metrics biased toward people who bother to click; weight with unbiased signals.

## Step 4: Statistics done right

- **Power analysis before launch:** estimate the sample size needed to detect the minimum effect you care about; LLM metrics are often noisy, requiring more traffic than expected.
- **Fixed horizon or sequential testing:** peeking at results daily and stopping when p dips below 0.05 inflates false positives. Use pre-set durations, or **sequential methods** designed for continuous monitoring.
- **Multiple comparisons:** testing many metrics and segments produces spurious wins; designate one primary metric and correct for the rest.
- **Variance reduction:** use pre-experiment covariates (CUPED-style adjustment) to detect smaller effects with less traffic.
- **Check the setup:** a **sample ratio mismatch** (variant sizes differing from the planned split) signals an assignment or logging bug and invalidates results.
- **Heterogeneous effects:** report segments (new versus returning, language, plan) as hypotheses, not conclusions.

## Step 5: LLM-specific pitfalls

- **Non-determinism** adds noise; do not treat a single sample per user as exact. Large samples average it out.
- **Interaction effects:** conversational context means a user's later behaviour depends on earlier replies; unit choice and analysis windows must account for it.
- **Cost and latency** differ per variant, and load itself changes under experiment; track them continuously.
- **Novelty effects:** users react to something new, then settle; run long enough to see the steady state.
- **Spillover:** shared caches, shared knowledge bases or social features can leak the treatment to control users.
- **Offline-online gaps:** a variant that wins offline often loses online; use offline evaluation to screen, online to decide.

## Step 6: Operational safety

Ramp gradually (1, 5, 25, 50 percent) with automated checks at each stage. Define **guardrail thresholds** that automatically pause or roll back an experiment (error rate, latency, refusal rate, cost, safety incidents). Provide a kill switch and require experiment review for sensitive changes. Record the full configuration (prompt versions, model, parameters) of each variant so results are reproducible.

## Step 7: Platform pieces

A configuration service delivers experiment definitions to applications with local caching; an SDK performs assignment and exposure logging; a streaming pipeline joins exposures with outcome events; a metrics engine computes per-variant results with confidence intervals; a UI shows results, guardrails and diagnostics; and a registry stores experiment history, decisions and learnings so teams do not repeat tests.

## A worked example

**Scenario:** a team tests a shorter, more direct system prompt for a support assistant.

1. The pre-registered primary metric is "resolved without human handoff" with a guardrail on cost and a safety flag rate. A power analysis requires about 40,000 conversations per arm for a 1 point lift.
2. Assignment is by user id; exposure is logged when the assistant answers. A ramp goes 5 percent to 50 percent over four days with checks at each step.
3. After the planned two weeks, the variant shows +1.4 points on resolution (confidence interval 0.6 to 2.2), cost 9 percent lower thanks to shorter outputs, and no change in safety flags.
4. Sample ratio is 50.1/49.9, healthy. A segment view shows no gain for Spanish-speaking users, flagged as a hypothesis for a follow-up.
5. The team ships to everyone, keeps a 5 percent holdback for a month to confirm long-term effects, and records the result and the Spanish follow-up in the experiment registry.

## Common mistakes

- **Peeking and stopping at the first significant result.**
- **Many metrics and segments** with no correction or primary metric.
- **No guardrails on cost, latency and safety.**
- **Assigning by request** when behaviour persists across a user's sessions.
- **Trusting offline wins** without an online test.
