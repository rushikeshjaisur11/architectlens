---
title: "Defining SLOs for Quality, Latency and Cost"
short_title: "SLOs for Quality, Latency and Cost"
tags: ["slo", "quality", "latency", "cost", "reliability", "metrics", "design"]
sources:
  - "Google SRE Book and Workbook, chapters on service level objectives and alerting on SLOs"
  - "Ragas and similar open-source evaluation documentation for retrieval and generation metrics"
  - "Public provider documentation on time-to-first-token and throughput metrics"
  - "NVIDIA NeMo Guardrails latency figures via secondary summaries (October 2026)"
  - "llm-d project blog, TTFT results (fetched Oct 2026)"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched Oct 2026)"
  - "LLM-as-judge calibration guidance, 2026 (secondary: futureagi.com)"
---

## The problem

Classic SLOs cover availability and latency. An AI feature can be fast, available and **wrong**, or right and ruinously expensive. To run AI in production you need objectives for **quality, latency, cost and safety together**, with error budgets that let teams trade between them deliberately instead of by accident.

## The four families of objectives

- **Availability and reliability:** the share of requests that get a valid response, including graceful fallbacks counted correctly.
- **Latency:** time to first token (TTFT) for streaming, total latency for non-streaming, and for agents, time to task completion.
- **Quality:** task success, groundedness, accuracy, completeness, tone, as measured by evaluators and users.
- **Cost:** cost per interaction or per resolved task, within a ceiling.
- **Safety (a guardrail objective):** rate of policy violations, leaked personal data, and unsafe actions, usually with a target near zero.

## Making quality measurable

Quality is the hard one. Define it per feature in terms users and the business care about:

- **For RAG:** retrieval hit rate (was the needed source retrieved), faithfulness (are claims supported by sources), answer relevance.
- **For extraction and classification:** field accuracy, precision and recall on a labelled set.
- **For assistants:** task success rate, escalation rate, thumbs up rate, edit distance of accepted drafts.
- **For agents:** task completion rate, steps per task, wrong-action rate.

Measure with a combination of **offline evaluation** on a golden set, **automated online scoring** of sampled production traffic by calibrated judges, and **user feedback**. Calibrate automatic scorers against human judgement and track their agreement.

## Writing the SLO

An SLO has an indicator, a target and a window. Examples:

- "99.5 percent of requests return a valid answer within 8 seconds over 30 days."
- "TTFT p95 under 1.2 seconds."
- "Faithfulness score at least 0.9 on 98 percent of sampled responses over 7 days."
- "Average cost per resolved ticket under $0.15."
- "Zero confirmed leaks of personal data; any occurrence is a sev-1."

Pick **few, meaningful** objectives. Too many dilute attention; none for quality means silent decay.

## Error budgets that span dimensions

An error budget turns a target into an allowance: if the quality SLO is 95 percent good answers, 5 percent can be bad before action is required. Use budgets to decide: while budget remains, ship experiments and cheaper models; when it is exhausted, freeze risky changes and invest in reliability and quality. Because dimensions trade off (a bigger model raises quality and cost), review them together: a change that improves quality 2 points while doubling cost must be justified against both budgets.

## Segmenting objectives

Averages hide pain. Define objectives per **tier and segment**: premium versus free users, languages, query types, regions. A multilingual assistant with great English and poor Hindi performance meets an aggregate SLO while failing a market. Track the distribution (percentiles) rather than just means.

## Alerting and response

Alert on **burn rate** of the error budget, not on single bad requests. Link alerts to runbooks: a quality drop after a deploy leads to rollback of the prompt version; a latency spike leads to checking provider status and switching to a fallback; a cost spike leads to the anomaly workflow. For quality, alerts depend on sampled evaluators, so define the sampling rate, the detection delay and the confidence you need.

## Leading indicators

Quality changes before users complain. Watch: retrieval score distributions, empty-retrieval rate, refusal rate, output length shifts, evaluator score trends, guardrail trigger rates, tool error rates and the share of requests hitting fallbacks. Treat these as early warnings feeding the budget burn.

## Governance of objectives

Set SLOs with product, engineering, risk and finance together; they encode what the business is willing to trade. Review them quarterly as models, volume and expectations change. Publish dashboards per feature, and include SLO status in release readiness checks.

## A worked example

**Scenario:** a support assistant with 200,000 conversations a month.

1. Objectives agreed: valid response within 10 seconds for 99.5 percent of requests; TTFT p95 under 1.5 seconds; resolution without human handoff at least 55 percent; faithfulness at least 0.9 on 97 percent of sampled answers; cost under 12 cents per resolved conversation; zero personal-data leaks.
2. A sampling job scores 2 percent of conversations with calibrated judges (agreement with humans checked monthly at 0.86).
3. After a prompt change, faithfulness compliance drops to 94 percent within 36 hours; the burn-rate alert fires and links to the prompt version; a rollback restores 97 percent.
4. In the same month the team proposes a cheaper model: evaluation shows quality within noise and cost down 40 percent, using the remaining quality budget deliberately; the canary confirms.
5. Monthly review notes that Spanish conversations run at 91 percent compliance, below target; a language-specific objective and improvement work are added.

## Enterprise practice (verified October 2026)

**Basics.** Pick a few indicators per dimension, set targets, measure them, and alert on error-budget burn (steps above).

**Reference points to calibrate targets (secondary and project benchmarks, October 2026).**

- **Latency SLIs:** time-to-first-token and inter-token latency for streaming, end-to-end p95 for non-streaming. Inference routing matters: llm-d's published benchmark saw p90 time-to-first-token of about 0.54 s with prefix-aware routing versus 31 to 95 s with weaker routing on the same hardware, so latency SLOs depend on scheduling, not just model size. Guardrails add roughly tens of milliseconds per classifier rail, more if chained; budget for them.
- **Quality SLIs** need a measurement method: LLM-judge scores should be calibrated against human labels (guidance commonly cites Cohen's kappa above 0.6 as workable) and re-calibrated on a schedule because judges drift. Pair automatic scores with sampled human review and deterministic checks (citations resolve, schema valid, SQL executes).
- **Cost SLIs:** cost per successful task and cache hit rate, with a budget burn alert; remember output tokens cost about 5x input on current rate cards and a model change can shift token counts (about 30% more tokens on newer Claude tokenizers).
- **Safety SLIs:** guardrail miss rate on an attack suite and unsafe-output rate in production samples.

**Enterprise pattern.** Define SLOs per feature tier (customer-facing versus internal), set error budgets, let a budget breach pause releases or trigger degradation, and report quality, latency and cost together so no dimension is optimised at the expense of another.

## Common mistakes

- **Only availability and latency SLOs**, leaving quality unmeasured.
- **Quality measured by one uncalibrated judge.**
- **Aggregate numbers only**, hiding failing segments.
- **No cost objective**, so improvements quietly double the bill.
- **Alerting on single events** instead of budget burn.
