---
title: "Reasoning Models and Test-Time Compute: Paying for Thinking"
short_title: "Reasoning Models and Test-Time Compute"
tags: ["reasoning", "test-time-compute", "thinking", "cost", "latency"]
sources:
  - "Anthropic documentation, 'Extended thinking' and adaptive thinking migration guide, platform.claude.com/docs (fetched October 2026)"
  - "Snell et al., 'Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters' (2024)"
  - "DeepSeek-AI, 'DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning' (arXiv 2501.12948; Nature, 2025)"
predict:
  question: "A plain answer uses 300 output tokens; a reasoning answer uses 6,000 thinking plus 300 answer tokens at $10 per million. What is the cost ratio?"
  options: ["About 21x, since thinking tokens are billed as output tokens", "About 2x, since thinking tokens are billed at a discounted rate", "About 1x, since only the 300-token final answer is billed"]
  answer: 0
  why: "$0.003 versus $0.063 is 21x, because thinking tokens count as output tokens."
check:
  - q: "In the routing example, why not run all support requests at high effort?"
    options: ["High effort lowers accuracy on policy-heavy refund decisions", "Most volume is simple intent classification where thinking adds cost without gain", "High effort is only available asynchronously on the largest model"]
    answer: 1
    why: "80% of traffic is intent classification where no thinking suffices, so blanket high effort inflates cost for no measured gain."
  - q: "Why hold one thinking configuration for the life of a cached conversation?"
    options: ["Switching thinking modes is rejected with an HTTP 400 error", "Thinking settings are billed per change, which raises the cost", "Changing the configuration invalidates prompt-cache breakpoints"]
    answer: 2
    why: "The lesson documents that changing the thinking configuration between requests invalidates cache breakpoints."
  - q: "Why avoid building a feature that parses the model's thinking output?"
    options: ["It may be a summary or encrypted, and its format changes by version", "It is always empty unless the effort level is set to high", "It is billed separately and is too expensive to read in code"]
    answer: 0
    why: "Thinking output may be a summary and can be encrypted, with format and availability changing between versions."
---

## Two ways to buy accuracy

For years the main lever for a better answer was a bigger model: more parameters, more training. **Test-time compute** is the second lever: let the *same* model spend more computation while answering. A reasoning model does this by producing a long hidden or summarised chain of thought (planning, trying an approach, checking it, backtracking) before the final answer. More thinking tokens usually mean higher accuracy on hard problems, at the price of more latency and more output tokens.

The trade is easy to quantify. Suppose a plain answer takes 300 output tokens and a reasoning answer takes 6,000 thinking tokens plus 300 answer tokens. At $10 per million output tokens that is $0.003 versus $0.063: twenty-one times the cost for one request, and at roughly 80 tokens a second about 4 seconds versus 79 seconds of generation. Reasoning is worth it only when the accuracy gain is worth that multiple.

## Where reasoning helps, and where it does not

Reasoning pays off on tasks with **verifiable multi-step structure**: maths, code, planning, constraint satisfaction, multi-hop analysis, careful policy interpretation. It helps little, and can hurt, on tasks that need recall, style or speed: classification, extraction from a clear passage, short rewriting, chat. Some studies even find accuracy falling when models over-think simple problems ("inverse scaling in test-time compute"), and models are poor at deciding how much to think per question.

A useful rule: if a competent person would answer instantly, do not buy thinking; if they would reach for scratch paper, consider it.

## How the control knobs work now

Providers expose thinking in two broad styles.

- **Fixed budget.** You set a cap on thinking tokens. Anthropic's earlier "extended thinking" used `budget_tokens` (minimum 1,024, must be less than `max_tokens`, treated as a target not a hard cap). OpenAI-style APIs expose a `reasoning_effort` level (low, medium, high).
- **Adaptive thinking with an effort level.** Anthropic's documentation now says the fixed-budget mode is deprecated on its 4.6 models and **rejected (HTTP 400) on 4.7 and later**; you set thinking to adaptive and choose an effort level, and the model decides per request whether and how much to think, possibly skipping thinking on easy inputs. The documentation advises migrating: remove `budget_tokens`, set adaptive thinking, control depth with `effort`.

Operational details that bite in production:

- **Thinking tokens are billed as output tokens**, and the response reports them separately (a `thinking_tokens` breakdown), so track them per feature.
- **Changing the thinking configuration between requests invalidates prompt-cache breakpoints** (documented for budget changes and for switching modes), so pick a setting and hold it for the life of a cached conversation.
- **Very long thinking runs** (budgets above about 32,000 tokens on Anthropic's guidance) risk timeouts; use batch processing for those.
- **Interleaved thinking** lets the model reason between tool calls inside an agent turn, which matters for agents; check the model's support.
- Thinking output may be a **summary**, not the raw reasoning, and can be encrypted for round-tripping; do not build features that depend on parsing it.

## How these models are trained (briefly)

DeepSeek-R1 showed that reinforcement learning on tasks with checkable answers (maths with known solutions, code that passes tests) can make a model develop longer, self-checking reasoning without human-written reasoning examples, with self-reflection and verification emerging during training. The practical consequence is that reasoning ability is strongest on verifiable domains and may transfer unevenly elsewhere (see the lesson on reinforcement learning with verifiable rewards).

## A worked routing example

A support platform sees three request types:

1. **Intent classification** (80% of volume): a small model, no thinking, 200 ms.
2. **Policy-heavy refund decisions** (15%): a mid-tier model with medium effort; accuracy rises from 86% to 94% on a labelled set, cost per request from $0.004 to $0.02.
3. **Complex multi-account disputes** (5%): high effort on the strongest model, asynchronous, results in under 2 minutes.

Blended cost is far lower than running everything at high effort, and the accuracy gain lands where errors are expensive.

## Practical rules

- Default to no or low thinking; raise effort per route, measured on a labelled set.
- Cap output tokens and set timeouts: a runaway thinking run is a cost incident.
- Re-test when you upgrade models, since effort levels do not map one-to-one across versions.
- For agents, prefer reasoning at planning and verification steps, not on every tool call.

## Common mistakes

- **Turning on maximum thinking everywhere** and tripling the bill for no measured gain.
- **Relying on a deprecated fixed-budget parameter** that newer models reject.
- **Showing raw reasoning to users** or logging it without a retention policy.
- **Ignoring that thinking tokens count against `max_tokens`**, truncating the final answer.
- **Judging by anecdotes** instead of an evaluation set per route.
