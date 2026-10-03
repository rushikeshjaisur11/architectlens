---
title: "Continual Learning and Catastrophic Forgetting"
short_title: "Continual Learning"
tags: ["fine-tuning", "continual-learning", "catastrophic-forgetting"]
sources:
  - "Catastrophic Interference in Connectionist Networks (McCloskey & Cohen, 1989)"
  - "Overcoming catastrophic forgetting in neural networks (Kirkpatrick et al., 2017, EWC paper, arXiv:1612.00796)"
  - "An Empirical Study of Catastrophic Forgetting in Large Language Models During Continual Fine-tuning (Luo et al., 2023, arXiv:2308.08747)"
---

## The problem

**Catastrophic forgetting** is what happens when a neural network trained sequentially on task B loses performance on task A it previously learned — not gradually, but sharply, because gradient descent has no built-in mechanism to preserve old knowledge while minimizing loss on new data. The weight updates that make the model good at task B actively overwrite the parameter configurations that made it good at task A, because both tasks share the same weight space and gradients only look at the current batch's loss.

This is a first-order concern in LLM fine-tuning: a model instruction-tuned on a narrow domain (say, legal contract summarization) can measurably regress on general capabilities — reasoning, broad-domain QA, even basic instruction-following — that weren't represented in the fine-tuning set. Empirical studies on LLaMA and other open models show forgetting scales with model size in a counterintuitive way for some domains (larger models sometimes forget less on general knowledge but more on specific held-out skills) and scales predictably with how many fine-tuning steps and how narrow the data distribution is.

## Why LLMs are somewhat resistant, and where they aren't

LLM pretraining exposes a model to an enormous, diverse token distribution, and full fine-tuning on a small task-specific set moves weights only a limited distance from that pretrained optimum, especially with few epochs and a low learning rate — this is why light instruction-tuning generally leaves general capabilities largely intact. The risk rises with three factors: more fine-tuning epochs, higher learning rates, and narrower/more repetitive data. A model fine-tuned for many epochs on a small, homogeneous dataset (e.g., a few thousand examples of one JSON output format) can overfit hard enough that outputs collapse toward that format even on unrelated prompts — a visible symptom of forgetting.

**PEFT methods like LoRA mitigate this structurally**: because the base weights are frozen and only a small low-rank update is learned, the original weight configuration is always recoverable (or the adapter can simply be removed/disabled), and empirical work shows LoRA fine-tuning forgets less than full fine-tuning for the same task performance gain — the update is confined to a lower-dimensional subspace that's less likely to disturb unrelated capabilities.

## Mitigation strategies

- **Rehearsal / replay**: mix a sample of the original pretraining or instruction-tuning distribution back into the fine-tuning batches, so gradient updates are pulled toward preserving old behavior alongside learning new behavior. Even a small percentage (5-10%) of general-purpose data mixed into a narrow fine-tuning run measurably reduces regression.
- **Elastic Weight Consolidation (EWC)**: estimates which parameters were most important for prior tasks (via the Fisher information matrix) and adds a regularization penalty that discourages large changes to those specific parameters during new training — effectively making important old weights "sticky."
- **Low learning rates and fewer epochs**: the simplest lever. Aggressive multi-epoch fine-tuning on small datasets is the most common cause of visible forgetting in practice; 1-3 epochs at a conservative learning rate is standard guidance for instruction fine-tuning.
- **Modular/adapter approaches**: instead of overwriting shared weights at all, train separate LoRA adapters per task/domain and swap them at inference time — this sidesteps forgetting entirely since the base model is never modified, at the cost of needing to route requests to the right adapter.

## Common mistakes

- **Evaluating only on the fine-tuning task's held-out set.** A model can show perfect improvement on the target task while silently regressing on general capabilities that were never re-measured — always keep a general-capability eval (e.g., MMLU subset, or a small internal regression suite) running alongside task-specific evals.
- **Over-training on small, narrow datasets.** Running 10+ epochs on a few hundred examples because "more training should help" is the single most common cause of catastrophic forgetting in practice.
- **Assuming PEFT eliminates forgetting entirely.** LoRA reduces it substantially but doesn't guarantee zero regression, especially at higher ranks or when adapters are merged into the base model and reused as a new starting point for further fine-tuning.
- **Treating forgetting as a training-time-only problem.** It also matters for continual/lifelong deployment scenarios — a model periodically updated with fresh data needs the same rehearsal/regularization discipline on every update cycle, not just the first one.
