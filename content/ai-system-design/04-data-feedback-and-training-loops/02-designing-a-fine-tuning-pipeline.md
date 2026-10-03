---
title: "Designing a Fine-Tuning Pipeline"
short_title: "Fine-Tuning Pipeline"
tags: ["fine-tuning", "training", "mlops", "lora", "evaluation", "design"]
sources:
  - "Hu et al., 'LoRA: Low-Rank Adaptation of Large Language Models' (2021)"
  - "Dettmers et al., 'QLoRA: Efficient Finetuning of Quantized LLMs' (2023)"
  - "Public documentation on experiment tracking, model registries and training infrastructure"
---

## The problem

A team has shown that prompting and retrieval alone cannot reach the required quality, cost or latency for a task, so they decide to fine-tune a model. A one-off notebook run is easy. A **repeatable pipeline** that turns fresh data into a better, validated, deployable model, again and again, without regressions, is the real engineering task.

## Step 1: Requirements

- **Repeatable:** same inputs give the same model; every run is traceable to a dataset version, code version and hyperparameters.
- **Safe:** no training on data without rights or containing personal data; no leakage of evaluation data into training.
- **Gated:** a model is promoted only if it beats the baseline on held-out evaluations, including safety and regression checks.
- **Efficient:** use parameter-efficient methods where they suffice; control GPU cost.
- **Deployable:** easy rollout, rollback and side-by-side serving with the base model.

## Step 2: Pipeline stages

1. **Data preparation:** collect, clean, deduplicate, redact, format into the training schema (for chat models, message lists), and split.
2. **Training:** run the fine-tune on a GPU cluster with experiment tracking.
3. **Evaluation:** run held-out, safety and regression suites; compare with the baseline.
4. **Registration:** store the model artifact and metadata in a registry.
5. **Deployment:** canary rollout behind the gateway, with monitoring.
6. **Feedback:** production data returns to stage 1 through the feedback flywheel.

Orchestrate with a workflow engine so each stage is a retryable, logged step with explicit inputs and outputs.

## Step 3: Data is most of the work

- **Quality over quantity:** a few thousand clean, consistent examples often beat tens of thousands of noisy ones. Remove contradictions, wrong answers, and duplicates.
- **Format fidelity:** training prompts must match what the model will see in production (system prompt, structure, tool schemas).
- **Splits:** hold out evaluation data **before** any processing; deduplicate across splits so near-copies of test items are not in training.
- **Provenance and rights:** record the source of every example; exclude data with unclear rights or unredacted personal information.
- **Balance:** make sure rare but important cases are represented, and that the style you want dominates.

## Step 4: Training choices

- **Full fine-tuning** updates all weights: highest capacity, highest cost and forgetting risk.
- **LoRA / QLoRA** train small adapter matrices on a frozen base (QLoRA also quantizes the base to 4-bit), cutting memory dramatically and producing small artifacts that can be swapped per task.
- **Preference tuning (DPO)** after supervised tuning when behaviour is easier to rank than to demonstrate.

Track hyperparameters and seeds, checkpoint regularly, and monitor training and validation loss; a validation curve that turns upward signals overfitting. Run a small **pilot** first to catch data and formatting bugs cheaply.

## Step 5: Evaluation gates

A trained model must pass:

- **Task metrics** on the held-out set, compared with the baseline using paired statistics.
- **Regression suite:** previously fixed failures stay fixed.
- **General capability checks:** the model has not become worse at things it used to do (catastrophic forgetting).
- **Safety and policy tests:** refusals and harmful-content behaviour not degraded.
- **Cost and latency:** meets serving requirements.

Gates are explicit thresholds in code; a model that fails does not reach the registry's "production" stage.

## Step 6: Serving and rollout

Adapters can be loaded on top of a shared base model, so many fine-tunes share GPUs. Roll out through the gateway: shadow first (compare outputs without affecting users), then a small canary share with monitoring of quality, refusals and latency, then full rollout. Keep the previous version loaded for instant rollback.

## Step 7: Lifecycle and governance

Models age as the product and world change. Schedule re-evaluation, retrain when quality drifts or enough new labelled data accumulates, and retire old versions. Keep a model card with data sources, intended use, evaluation results and known limitations.

## A worked example

**Scenario:** a team fine-tunes a small model to produce structured insurance claim summaries.

1. Data prep gathers 6,000 reviewed examples, redacts personal data, removes 300 near-duplicates, and holds out 600 as a never-trained-on test set.
2. A pilot on 500 examples reveals a formatting mismatch between training and production prompts; it is fixed before the full run.
3. A QLoRA run on a single GPU takes three hours; the registry stores adapter weights with dataset and code hashes.
4. Evaluation: field accuracy rises from 81 to 94 percent; general capability and safety suites are unchanged; latency drops 40 percent versus the large prompted model.
5. Shadow comparison on live traffic confirms results; a 10 percent canary runs for three days, then full rollout, with the old adapter retained for rollback.

## Common mistakes

- **Training before building the evaluation set**, so improvement cannot be proven.
- **Test data leaking into training** through near-duplicates.
- **Training prompts that differ from production prompts.**
- **No regression or safety gates**, promoting a model that is better on one task and worse elsewhere.
- **Fine-tuning for knowledge** that retrieval would supply fresher and cheaper.
