---
title: "Preparing Training Data for Fine-Tuning"
short_title: "Preparing Fine-Tuning Data"
tags: ["fine-tuning", "training-data", "llm"]
sources:
  - "OpenAI documentation on fine-tuning dataset preparation"
  - "Hugging Face documentation on dataset curation for supervised fine-tuning"
---

## Why data quality dominates fine-tuning outcomes more than most other choices

Once the decision to fine-tune is made (per this track's fine-tuning-vs-prompting-vs-RAG lesson), the single factor most likely to determine whether the result is actually good is the training data's quality — more so than most hyperparameter choices, and more so than which specific base model is chosen as the starting point. A model fine-tuned on inconsistent, low-quality, or poorly-representative examples will reliably learn those inconsistencies and gaps, regardless of how well-tuned the training process itself is — the model is, in a real sense, learning to imitate whatever pattern actually exists in the training examples, including unintended ones.

## What "high quality" means concretely for fine-tuning data

- **Consistency** — examples demonstrating the target behavior need to actually be consistent with each other in format, tone, and approach. A dataset where half the examples follow one convention and half follow a subtly different one teaches the model an inconsistent, blended behavior rather than either convention cleanly — the model can't distinguish "this is the correct approach" from "this is noise" without a clear, consistent signal.
- **Correctness** — every example needs to actually be correct and representative of the desired behavior; a small number of genuinely wrong examples can measurably degrade fine-tuning quality, since the model has no way to distinguish a mislabeled example from a correct one worth learning from — unlike a human learner who might reasonably discount an outlier, a fine-tuning process has no such judgment.
- **Representativeness** — the training set needs to cover the actual range of inputs the model will see in production, including realistic edge cases, not just the easy, typical cases. A dataset skewed toward simple examples produces a model that handles simple cases well and edge cases poorly, since it was never shown examples demonstrating correct behavior on them.
- **Sufficient volume, but not indiscriminately** — fine-tuning generally needs enough examples to establish a consistent pattern (the specific number varies by task complexity and base model, but is often in the range of hundreds to low thousands of well-curated examples for many tasks, rather than requiring the scale of examples pretraining uses), and a smaller set of carefully curated, correct, consistent examples typically outperforms a much larger set of noisy, inconsistent ones.

## Where fine-tuning data actually comes from

- **Curated by domain experts** — the highest-quality source for many tasks, since experts can produce genuinely correct, well-reasoned examples reflecting the target behavior, at the cost of being the most expensive and slowest to produce at scale.
- **Filtered from real production logs** — using genuine past interactions (with a human review/correction step to fix any mistakes present in the raw logs) has the advantage of naturally reflecting the real distribution of inputs the model will actually face in production, connecting directly to this track's evaluation lesson's point about building eval sets from real usage rather than hypothetical examples — the same principle applies to fine-tuning data.
- **Synthetically generated, with careful validation** — using a stronger model to generate candidate training examples, which are then reviewed and filtered by humans (or a validated automated check) before inclusion. This can scale data production faster than pure human curation, but carries a real risk: synthetic data can inherit and amplify the generating model's own errors or stylistic quirks if not carefully validated, so treating synthetic generation as a first-draft source requiring genuine review — not a fully automated pipeline with no human check — matters for quality.

## Train/validation split and detecting overfitting

As with any supervised training process, fine-tuning data needs to be split into a training set (what the model actually learns from) and a held-out validation set (used to check whether the model is generalizing the target behavior or simply memorizing the specific training examples). A model that performs excellently on training examples but poorly on validation examples covering the same task is overfitting — a sign the training set was too small, too narrow, or that training ran for too many passes over the same limited data. This validation step is what actually catches a fine-tuning run that looks successful by superficial inspection but has actually just memorized specifics rather than learning the generalizable pattern the task requires.

## A worked example

**Scenario:** a team is fine-tuning a model to generate structured code-review comments in a specific format matching their internal tooling, having already confirmed via prompting alone that format compliance was inconsistent enough to justify fine-tuning (per the fine-tuning-vs-prompting lesson's sequencing point).

- **Data source**: real code review comments from the team's own review history are used as a starting point, since they naturally reflect the actual range of code patterns and review scenarios the model will face — but every candidate example is reviewed by a senior engineer to confirm it's both correct (good review judgment) and correctly formatted (matching the target structure), rather than assuming historical data is automatically clean.
- **Consistency check**: examples are audited specifically for format consistency before inclusion — historical review comments, having been written by many different engineers over time with varying personal conventions, initially show real format inconsistency that would otherwise directly undermine the fine-tuning goal (consistent format compliance) if left uncorrected in the training set.
- **Representativeness check**: the curated set is checked to ensure it covers a real range of review scenarios (bug flagging, style suggestions, security concerns, praise for good patterns) rather than being dominated by only the most common, simplest review type — an imbalanced set would teach the model to handle the common case well and underperform on rarer but still important review categories.
- **Validation split**: a held-out set of reviews (not used in training) is used to check that the fine-tuned model's format compliance and review quality generalizes to genuinely new code, not just examples resembling ones memorized from training.

## Common mistakes

- **Using raw production data without a human review/correction pass**, assuming historical data is automatically high-quality training material — real production data typically contains real mistakes, inconsistencies, and edge cases that need explicit curation before being trusted as a training signal.
- **Prioritizing dataset volume over quality**, assuming more examples is straightforwardly better — a large, noisy, inconsistent dataset typically produces worse fine-tuning results than a smaller, carefully curated one, since the model has no mechanism to distinguish signal from noise in its training data.
- **Skipping the train/validation split and judging fine-tuning success only by how well the model performs on training examples.** This can't detect overfitting — a model that has simply memorized training examples rather than learned a generalizable pattern will look successful on this narrow check while performing poorly on genuinely new inputs in production.
