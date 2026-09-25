---
title: "Human Feedback Loops and the Basics of RLHF"
short_title: "Human Feedback and RLHF Basics"
tags: ["evaluation", "rlhf", "human-feedback", "llm"]
sources:
  - "Ouyang et al., 'Training language models to follow instructions with human feedback' (2022, the InstructGPT/RLHF paper)"
  - "Rafailov et al., 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model' (2023, DPO paper)"
---

## Why human feedback is a distinct signal from the evaluation methods covered so far

This track's evaluation lesson covered unit evals, model-graded evals, and human evaluation as ways to *measure* quality. This lesson covers a related but distinct use of human judgment: using it not just to measure a model's output quality after the fact, but as a direct training signal to actually shape model behavior — the basis for RLHF (Reinforcement Learning from Human Feedback) and its more recent alternatives, and a common source of confusion when teams treat "we collect user feedback" and "we do RLHF" as the same thing, when they're related but meaningfully different activities.

## Why preference data, not absolute scores, is the typical signal

Rather than asking human raters to assign an absolute quality score to a single output (which tends to be inconsistent — different raters, or even the same rater at different times, often disagree on what a "7 out of 10" response actually looks like), RLHF-style approaches typically collect **preference data**: raters are shown two (or more) candidate responses to the same prompt and asked which is better, a relative judgment that tends to be more consistent and reliable across raters than absolute scoring — it's a comparison task people are simply better and more consistent at than calibrated absolute rating.

## The classical RLHF pipeline

1. **Supervised fine-tuning (SFT)** — the base model is first fine-tuned on human-written examples of desired behavior (directly connecting to this track's fine-tuning-data-preparation lesson), establishing a reasonable starting point before any preference-based refinement begins.
2. **Reward model training** — using the collected preference data (pairs of responses with a human-indicated preferred one), a separate model is trained to predict which of two responses a human would prefer — effectively learning to approximate human judgment as a scorable, differentiable function, rather than requiring a human rater in the loop for every subsequent training step.
3. **Reinforcement learning against the reward model** — the SFT model is further trained (typically via PPO, Proximal Policy Optimization) to generate outputs that the reward model scores highly, using the reward model's predictions as the training signal — this is the actual "reinforcement learning" step, and it's what shapes the model's behavior to align with the preferences the reward model learned to approximate.

This pipeline is genuinely complex — training a separate reward model, then running reinforcement learning against it, involves more moving parts and more potential failure points (a reward model that's learned a flawed or gameable proxy for actual human preference, for instance) than standard supervised fine-tuning.

## DPO: a simpler alternative achieving similar goals

**Direct Preference Optimization (DPO)** was developed specifically to simplify this pipeline: it shows that the same preference data can be used to directly fine-tune the model, without needing to train a separate reward model or run the more complex reinforcement learning loop — DPO reformulates the preference-learning objective so it can be optimized with a more standard supervised-learning-style training process directly on the preference pairs. This has made preference-based model tuning considerably more accessible and stable to run than the original multi-stage RLHF pipeline, and is why more recent open fine-tuning workflows often reach for DPO over full RLHF when preference-based tuning is the goal.

## Why this connects to, but is distinct from, ordinary user feedback signals

This track's evaluation lesson mentioned user feedback signals (thumbs up/down, regeneration requests) as part of production observability. That data *can* serve as raw material for preference-based training (a thumbs-down response paired with a subsequent regeneration the user preferred is a natural preference pair) — but collecting it isn't the same as running RLHF or DPO. Actually using it to shape model behavior requires the additional training pipeline described above (or a decision to use it purely as an evaluation/monitoring signal, per the earlier evaluation lesson, without feeding it into a training loop at all) — a team collecting thumbs-down data without a defined plan for how it flows into either evaluation or training is capturing a signal without a mechanism to act on it.

## A worked example

**Scenario:** a company wants to reduce a specific behavior pattern users have flagged as unhelpful (overly verbose, hedging responses) in their production assistant.

- **Data collection**: rather than relying solely on scattered thumbs-down feedback (which flags a problem exists but not specifically what a *better* response would have looked like), the team runs a targeted preference-collection exercise — generating pairs of responses to a sample of real prompts (one verbose/hedging, one direct) and having raters indicate which they prefer, producing clean, directly-comparable preference data specifically targeting the behavior they want to change.
- **DPO is chosen over full RLHF** for the actual training step, given the team's more limited ML infrastructure and desire for a simpler, more directly reproducible process — DPO's more standard supervised-training-style objective is more tractable for them to run and debug than a full reward-model-plus-PPO pipeline, while still directly using the collected preference data.
- **Evaluation after training**: the fine-tuned model is evaluated (per this track's evaluation lesson's methodology) against a held-out eval set specifically checking response length and hedging-language frequency, confirming the preference-tuning actually shifted the targeted behavior as intended, rather than assuming the training process worked correctly just because it completed without error.

## Common mistakes

- **Treating collected user feedback (thumbs up/down) as equivalent to having done RLHF or preference tuning**, when actually using that data to shape model behavior requires the additional training pipeline (reward model plus RL, or DPO) described above — raw feedback collection and model-behavior training are genuinely different activities that need to be connected deliberately.
- **Using absolute quality scores from raters instead of preference comparisons for training data**, missing the more reliable, more consistent signal that relative preference judgments tend to provide over absolute scoring, per the reasoning above.
- **Skipping post-training evaluation of whether the preference tuning actually achieved its targeted behavior change.** A training pipeline completing without technical errors doesn't guarantee it moved the specific behavior the team was trying to change — this needs to be verified against a targeted eval, not assumed from successful training completion alone.
