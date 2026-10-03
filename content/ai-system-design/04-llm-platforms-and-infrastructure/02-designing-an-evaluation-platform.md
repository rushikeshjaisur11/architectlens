---
title: "Designing an Evaluation Platform"
short_title: "Evaluation Platform"
tags: ["evaluation", "platform", "datasets", "llm-judge", "regression", "design"]
sources:
  - "Zheng et al., 'Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena' (2023)"
  - "Public documentation of open-source LLM evaluation frameworks and experiment trackers"
  - "Kohavi, Tang and Xu, Trustworthy Online Controlled Experiments (2020)"
  - "Secondary 2026 guides on LLM-as-judge calibration and bias (futureagi.com, dataaspirant.com) and arXiv studies on judge reliability (2026)"
banner:
  layout: line
  nodes:
    - [doc, "datasets"]
    - [model, "run"]
    - [shield, "judge"]
    - [server, "dashboard"]
predict:
  question: "A team's cheaper summarizer scores within noise overall and costs 62 percent less, but 31 cases regress on the numeric tables slice. What do they do?"
  options: ["Route table-heavy documents to the expensive model and the rest to the cheaper one", "Reject the cheaper model completely since any regression blocks a change", "Ship the cheaper model everywhere because the overall average is within noise"]
  answer: 0
  why: "Slice-level comparison exposed the table regression, so the team splits traffic by document type and adds the 31 cases as a permanent CI slice."
check:
  - q: "Why must published dataset versions be immutable?"
    options: ["Immutable data is cheaper to store and faster to load per run", "If cases change under a run, comparisons between runs become meaningless", "Judges cannot score cases edited after they were first published"]
    answer: 1
    why: "Runs are only comparable when they used the same cases; mutable datasets make results incomparable."
  - q: "Why cache target outputs keyed by input and target config?"
    options: ["Re-scoring with a new judge then does not need to re-run the model", "It guarantees stochastic targets produce identical outputs on every run", "It lets the platform skip scoring for cases that passed before"]
    answer: 0
    why: "Caching model outputs separates generation from scoring, so a new judge can re-score cheaply without paying for the model again."
  - q: "Why calibrate an LLM judge against human labels even when its scores are highly self-consistent?"
    options: ["Humans label faster than judges once a calibration set exists", "Self-consistent judges are always biased toward longer, verbose outputs", "Self-consistency does not prove the judge measures the right thing"]
    answer: 2
    why: "The lesson cites work arguing high self-consistency does not prove validity, so judges need agreement checks against human labels."
---

## The problem

Teams change prompts, models and retrieval settings constantly, and each change can quietly make things worse. Without shared evaluation infrastructure, every team builds a fragile notebook, results are not comparable, and regressions reach users. An **evaluation platform** gives every AI feature a repeatable way to answer "is this change better, and at what cost?" before and after release.

## Step 1: Requirements

- **Datasets:** versioned collections of test cases with inputs, expected outputs or reference facts, and tags (slice, difficulty, source).
- **Runs:** execute a candidate (prompt, model, pipeline) over a dataset, collect outputs, scores, latency and cost.
- **Scorers:** deterministic checks, model-graded judges and human review, combinable per task.
- **Comparison:** side-by-side results between two runs with statistics and drill-down to individual cases.
- **Integration:** run in CI as a gate, on a schedule against production traffic samples, and on demand from a notebook or UI.
- **Scale (example):** 200 teams, thousands of runs per day, datasets from 50 to 50,000 cases.

## Step 2: Core data model

- **Dataset** (versioned, immutable once published) containing **cases**.
- **Target:** a reference to the thing under test, defined as a callable or a service endpoint plus its config (prompt version, model, parameters).
- **Run:** target plus dataset version plus scorer set, with status and metadata (git commit, author).
- **Result:** per case: output, trace id, latency, tokens, and one score per scorer with rationale.
- **Experiment:** a named comparison of runs.

Immutable dataset versions are essential: if the data changes under a run, comparisons are meaningless.

## Step 3: Execution engine

A run fans out into case-level jobs processed by a worker pool.

- **Concurrency control** respects provider rate limits and budgets; use the LLM gateway's quotas.
- **Retries and timeouts** per case; one failure should not sink the run, and failures are recorded as results, not hidden.
- **Caching** of target outputs keyed by input and target config, so re-scoring with a new judge does not re-run the model.
- **Determinism aids:** fixed seeds and temperature where possible, and multiple samples per case for stochastic targets to measure variance.
- **Cost control:** estimate cost before launching, cap spend per run.

## Step 4: Scorers

- **Deterministic:** exact match, regex, JSON schema validity, code execution against tests, retrieval hit rate. Cheap, reliable, run on everything.
- **LLM judges:** rubric-based grading of qualities like helpfulness or faithfulness. Use pairwise comparisons with swapped order, clear rubrics, and structured output. **Calibrate** judges against human labels and track agreement; version judge prompts like any other code.
- **Human review:** a queue with an annotation UI, guidelines, and inter-annotator agreement tracking, applied to samples and disagreements.

Store the **rationale** with each score so reviewers can audit it.

## Step 5: Comparison and statistics

Averages hide regressions. Show:

- Aggregate scores with **confidence intervals**, and a paired comparison between runs on the same cases.
- **Slices** (by topic, language, difficulty), because a gain on easy cases can mask a loss on hard ones.
- **Regressions and wins** as lists of specific cases that flipped.
- Latency and cost beside quality, so trade-offs are explicit.

Small datasets give noisy differences; the platform should flag when a result is within noise.

## Step 6: CI gating and production loops

- **CI gate:** a change must not drop key scores beyond a threshold versus the baseline, with a documented override process.
- **Online sampling:** a fraction of production traces is scored automatically for drift and added to a review queue.
- **Failure harvesting:** bad production cases found by users or monitors are promoted into the dataset, so each incident becomes a permanent regression test.

## Step 7: Operations and trust

Track evaluator reliability: judge-human agreement, score drift over time, and rerun variance. Protect sensitive data in datasets with access control and redaction. Keep run metadata and artifacts for audit and reproducibility.

## A worked example

**Scenario:** a team wants to switch their summarizer to a cheaper model.

1. They create a run for the candidate on dataset v7 (1,200 cases) with deterministic checks (length, no markdown), a faithfulness judge and a 5 percent human sample.
2. Outputs are produced with gateway quotas; cached outputs from the baseline run are reused.
3. The comparison shows quality within noise overall, cost down 62 percent, but a drop on the "numeric tables" slice.
4. Drill-down lists 31 regressed cases; reviewers confirm the cheaper model misreads tables.
5. The team keeps the expensive model for table-heavy documents and routes the rest to the cheaper one, then adds the 31 cases as a permanent "tables" slice in CI.

## Enterprise practice (verified October 2026)

**Basics.** Datasets, runs, scorers and a comparison view; code-based checks plus model judges plus human review (steps above).

**What the 2026 evaluation literature and practitioner guides converge on.**

- **Calibrate every judge against humans.** Label a calibration set, measure agreement (Cohen's kappa; guidance commonly cites **above 0.6 as workable and above 0.8 as strong**), and recalibrate on a schedule because judges drift. A large 2026 study titled "Reliability without Validity" argues high self-consistency does not prove a judge measures the right thing.
- **Control known biases:** position (run pairwise comparisons in both orders), verbosity, self-preference (a model family favouring its own outputs; use a cross-family judge), format and anchoring (showing prior scores changes verdicts).
- **Use rubrics and ensembles for open-ended work**, and deterministic checks (schema, citations resolve, SQL executes, tests pass) wherever possible; they are cheaper and unbiased.
- **Report uncertainty.** Publish confidence intervals, not single scores, and a minimum sample size per slice.

**Enterprise pattern.** Gate releases on a versioned golden set with slice metrics (language, tenant, difficulty), run a smaller smoke set on every prompt change and the full set nightly, keep a held-out set that never enters prompts, mine production failures into new cases weekly, and store judge prompt, judge model and rubric version with every score so results are reproducible and auditable.

## Common mistakes

- **Mutable datasets**, making runs incomparable.
- **Reporting a single average**, hiding slice regressions.
- **Uncalibrated judges**, treating their scores as ground truth.
- **No cost or latency next to quality**, so trade-offs go unseen.
- **Never feeding production failures back** into the dataset.
