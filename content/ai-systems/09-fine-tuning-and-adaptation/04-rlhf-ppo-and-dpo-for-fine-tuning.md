---
title: "Applying RLHF, PPO, and DPO in a Fine-Tuning Workflow"
short_title: "RLHF, PPO, and DPO in Practice"
tags: ["fine-tuning", "rlhf", "dpo", "llm"]
sources:
  - "Rafailov et al., 'Direct Preference Optimization' (2023)"
  - "Hugging Face TRL (Transformer Reinforcement Learning) library documentation"
---

## Connecting preference-based training to the fine-tuning decision process

This track's fine-tuning-vs-prompting-vs-RAG lesson established when fine-tuning is the right tool, and the fine-tuning-data-preparation lesson covered building supervised fine-tuning (SFT) data. This track's evaluation lesson's counterpart on human feedback introduced RLHF and DPO conceptually. This lesson connects those pieces into an actual practical workflow decision: once you've decided fine-tuning is warranted and prepared quality SFT data, when does it make sense to go further with preference-based tuning (RLHF or DPO), and which of the two should you actually reach for.

## Why SFT alone often isn't sufficient for behavior that's hard to specify by example

Supervised fine-tuning teaches a model to imitate specific example outputs — effective when the desired behavior can be fully captured by demonstrating enough good examples. Some behaviors are harder to fully specify this way: "be helpful but not sycophantic," "give a thorough but not excessively verbose answer," or "decline appropriately without being preachy about it" are behaviors where showing isolated correct examples doesn't as effectively teach the model to navigate the *tradeoff* the behavior actually requires — preference data (this response is better than that one, and here's roughly why, implicitly, through the comparison) captures relative judgment about tradeoffs in a way that absolute example-based SFT data structurally can't as directly.

## Why PPO-based RLHF is rarely the first choice today

The original RLHF pipeline (SFT, then a separately-trained reward model, then PPO-based reinforcement learning against that reward model, all covered in this track's human-feedback lesson) is genuinely difficult to get right in practice: PPO training is notoriously sensitive to hyperparameters, prone to instability (the model can degrade or "collapse" into degenerate behavior if training isn't carefully managed), and requires meaningfully more infrastructure (running and coordinating multiple models — the policy model being trained, the reward model, often a reference model to prevent the policy from drifting too far from its starting point) than standard supervised training. This complexity is real enough that, for most teams without dedicated RL infrastructure and expertise, it's a genuinely harder path than the practical alternative below — worth knowing the classical pipeline exists and how it works, but rarely the pragmatic first choice for a team's first preference-tuning project.

## Why DPO has become the practical default for most preference-tuning workflows

DPO (introduced in this track's human-feedback lesson) reformulates the same underlying preference-learning objective into something trainable with standard supervised-learning-style optimization, directly on the collected preference pairs, without needing a separately-trained reward model or the RL training loop's instability. For a team that has SFT infrastructure already in place (most fine-tuning workflows do, following this track's fine-tuning-data-preparation lesson) and has collected preference data, DPO is typically a comparatively small, well-understood extension of that same pipeline, whereas full RLHF requires substantially new infrastructure and expertise — this is the concrete, practical reason DPO has become the more common default entry point for preference-based tuning, even though PPO-based RLHF remains the approach used for some of the largest, most heavily-resourced model providers' flagship safety and alignment training.

## Collecting preference data specifically for a fine-tuning project

Building on this track's fine-tuning-data-preparation lesson's general quality principles (consistency, correctness, representativeness), preference data collection has its own specific considerations: the two (or more) candidate responses being compared should differ meaningfully enough that a rater can form a genuine, confident preference (near-identical candidates produce low-information, effectively noisy preference judgments), and the pool of prompts used to generate comparison pairs should be representative of the actual target use case's real query distribution — reusing the same "build the eval set from real usage" principle from this track's evaluation lesson, applied here to preference-data prompt selection rather than evaluation-set construction.

## A worked example

**Scenario:** a team has already completed SFT on their assistant (following the fine-tuning-data-preparation lesson's process) but finds the model still occasionally produces responses that are technically correct but oddly verbose or slightly off in tone — a behavior that's proven hard to fully close with additional SFT examples alone.

- **Preference data collection**: for a sample of representative real prompts, the SFT model generates two candidate responses (varying temperature or minor prompt variation to get genuinely different candidates), and human raters indicate which they prefer, specifically targeting the verbosity/tone issue by including instructions to raters about what dimension to judge on — producing focused preference data rather than open-ended general quality judgments that might not specifically capture the targeted issue.
- **DPO is chosen over full RLHF**, consistent with the practical-default reasoning above — the team already has SFT training infrastructure, and DPO extends it without requiring a new reward-model-training and PPO pipeline, keeping the project tractable for their team's existing tooling and expertise.
- **Evaluation after DPO training**: following this track's evaluation lesson's methodology, the team runs the DPO-tuned model against a held-out eval set specifically scoring for the targeted verbosity/tone dimension (not just general quality), confirming the preference tuning actually moved that specific metric — the same targeted-evaluation discipline emphasized in this track's human-feedback lesson's worked example, applied again here.

## Common mistakes

- **Reaching for full PPO-based RLHF as a first attempt at preference tuning**, without a specific reason (dedicated RL infrastructure and expertise already available, or a need this track's flagship-provider-scale approach specifically addresses) to justify its added complexity and instability risk over DPO's more tractable, standard-training-style path.
- **Collecting preference data from near-identical candidate response pairs**, producing low-information comparisons that don't give the training process a clear, meaningful signal about what actually distinguishes a better response.
- **Skipping SFT and attempting preference-based tuning directly on a base model.** Preference tuning refines behavior relative to a reasonable starting point — attempting it without first establishing that baseline via SFT (per the classical pipeline's ordering) tends to produce a less stable, less effective result than following the established SFT-then-preference-tuning sequence.
