---
title: "Production Monitoring: Drift Detection and Hallucination Rate Tracking"
short_title: "Production Monitoring"
tags: ["observability", "monitoring", "drift-detection", "hallucination"]
sources:
  - "Evidently AI documentation on data and model drift"
  - "Galileo / Arize AI blog on LLM hallucination detection in production"
  - "Anthropic and OpenAI usage/monitoring API documentation"
banner:
  layout: line
  nodes:
    - [server, "traffic"]
    - [shield, "detectors"]
    - [db, "metrics"]
    - [client, "alerts"]
predict:
  question: "A team runs a judge model on 100% of production traffic to track hallucinations. According to the lesson, what is the likely result?"
  options: ["Much better signal, since more scored samples always beat fewer", "Roughly doubled inference cost for marginal benefit over a 1-5% stratified sample", "Lower cost, since judges are cheaper than the main model", "Fewer false alarms, since every response is scored equally"]
  answer: 1
  why: "A stratified 1-5% sample, oversampling flagged responses, gives a usable signal at a fraction of the cost."
check:
  - q: "Why compare drift metrics to a fixed reference window instead of a trailing average?"
    options: ["A trailing average is too slow to compute on live traffic", "A moving average drifts alongside the problem, so the change is never seen", "Fixed windows remove the need for any alerting rules", "A fixed window guarantees ground-truth labels exist for each query"]
    answer: 1
    why: "Drift needs a stable baseline; a constantly moving trailing average shifts with the problem and hides it."
  - q: "Why is concept drift harder to detect automatically than input or output drift?"
    options: ["The correct answer changed while model behavior did not, so it needs user feedback", "Concept drift only affects models that were never fine-tuned", "Input drift and concept drift are the same measurement under two names", "Embedding distance can detect it directly when queries look similar"]
    answer: 0
    why: "A policy or price change makes a previously correct response wrong without any visible change in model behavior or inputs."
  - q: "Why should a RAG hallucination check score against retrieved context rather than only the model's output?"
    options: ["Context checks are cheaper because they skip the judge model", "The model's output has no claims that could be checked", "Many apparent hallucinations are retrieval failures, which a groundedness check against context surfaces", "Retrieved context is guaranteed to be correct, so it serves as ground truth"]
    answer: 2
    why: "A large share of hallucinations are wrong or stale retrieved documents, which a model-only check cannot reveal."
---

## Why offline evals aren't enough

A golden dataset catches regressions before deploy, but it's a snapshot — real user traffic drifts in ways a fixed test set can't predict: new topics, new phrasing, seasonal shifts, adversarial users, upstream data source changes. **Production monitoring** is the continuous, always-on counterpart to offline evaluation: sampling live traffic, scoring it, and alerting when quality metrics move.

## What "drift" means for LLM systems

Drift shows up in a few distinct forms:

- **Input drift**: the distribution of user queries shifts — new intents appear, or an existing feature starts receiving a type of question it wasn't designed for. Detected by embedding incoming queries and tracking distributional distance (e.g., population stability index or embedding-space cluster shifts) against a reference window.
- **Output drift**: the model's response distribution changes even for similar inputs — often caused by a silent provider-side model update behind a stable API endpoint, or a RAG index that's been re-populated with different content. Tracking response length, refusal rate, and sentiment over time surfaces this even without labeled ground truth.
- **Concept drift**: the *correct* answer itself has changed — a policy update, a pricing change, a new product feature — so a previously correct cached or fine-tuned response becomes wrong even though the model's behavior hasn't changed. This is the hardest to detect automatically and usually needs a feedback loop from user corrections or support escalations.

## Hallucination rate tracking

Hallucination — confident output not grounded in source material — needs a proxy metric since ground truth isn't available for every live query. Common approaches:

- **Groundedness scoring via LLM-as-judge**: for RAG systems, sample a percentage of live responses and have a judge model check each claim against the retrieved context, flagging unsupported statements. This is the same reference-guided grading pattern used in offline eval, just running continuously on live traffic.
- **Self-consistency sampling**: generate the same query multiple times (at nonzero temperature) and measure agreement between generations; high variance on factual claims correlates with higher hallucination risk, without needing a reference answer.
- **Citation/attribution coverage**: for systems that cite sources, track what fraction of factual sentences carry a citation and what fraction of citations actually support the claim they're attached to — a cheap, deterministic proxy that doesn't require a judge call on every request.
- **User-signal proxies**: thumbs-down rate, regeneration rate, and explicit correction messages ("that's wrong") are noisy but free signals that correlate with hallucination spikes and are worth tracking as a leading indicator even before a judge-based audit confirms the cause.

## Building the monitoring pipeline

- **Sample, don't score everything.** Running a judge model on 100% of production traffic doubles inference cost for marginal benefit; a stratified 1-5% sample (oversampling low-confidence or flagged responses) gives a statistically usable signal at a fraction of the cost.
- **Alert on rate-of-change, not absolute thresholds alone.** A hallucination rate of 3% might be acceptable baseline noise for one product and a five-alarm fire for another — what matters more is a sudden jump from a stable baseline, which a rolling z-score or CUSUM-style control chart catches faster than a fixed threshold.
- **Correlate with upstream changes.** Tag every monitored request with the prompt version, model version, and retrieval index version active at the time, so a metric spike can be traced to a specific deploy rather than investigated blind.

## Common mistakes

- **No reference window.** Drift metrics are meaningless without a stable baseline period to compare against — pick one deliberately (e.g., first two weeks post-launch) rather than comparing against a constantly-moving trailing average that drifts alongside the problem.
- **Treating user thumbs-down as ground truth.** It's a signal, not a label — users downvote for tone, latency, and disagreement with correct-but-unwelcome answers, not only for actual hallucinations.
- **Monitoring the model but not the retrieval/context layer** in RAG systems — a large share of "hallucinations" are actually retrieval failures (wrong or stale documents returned), which a groundedness check against retrieved context will surface but a check against the model alone won't.
