---
title: "Reinforcement Learning with Verifiable Rewards (GRPO)"
short_title: "RL with Verifiable Rewards (GRPO)"
tags: ["rlvr", "grpo", "reinforcement-learning", "reasoning", "fine-tuning"]
sources:
  - "DeepSeek-AI, 'DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning' (arXiv 2501.12948; Nature 645, 2025)"
  - "Shao et al., 'DeepSeekMath' (2024), introducing Group Relative Policy Optimization"
  - "Practitioner summaries of RLVR and GRPO, 2026 (secondary: snorkel.ai, futureagi.com, Sebastian Raschka's magazine)"
---

## The problem with learning from human preferences

RLHF (and its simpler cousin DPO) teaches a model what *people prefer* using ranked answers. That works for tone and helpfulness, but preference is a noisy, expensive and gameable signal: humans disagree, labelling costs money, and a reward model trained on preferences can be exploited. For some tasks there is a better teacher: **a checker**. Does the maths answer equal 42? Does the code pass the unit tests? Does the SQL return the right rows? Does the output validate against the schema? A checkable outcome is a cheap, objective reward.

## What RLVR is

**Reinforcement learning with verifiable rewards (RLVR)** trains a model by letting it attempt tasks and giving a reward computed by a program, not a person or a learned judge: typically 1 if the answer is verified correct, 0 if not, sometimes plus a small reward for following a required format. The model is updated to make rewarded behaviour more likely. Because the reward is exact, no preference data or reward model is needed.

## GRPO in one picture

Classic policy-gradient methods (PPO) train a second network, a *value model* or critic, to estimate how good each step is, which is memory-hungry. **Group Relative Policy Optimization (GRPO)** removes it:

1. For one prompt, sample a **group** of answers (say 8).
2. Score each with the verifier: for example 3 correct, 5 wrong.
3. Compute each answer's **advantage relative to the group**: correct answers are above the group mean, wrong ones below.
4. Update the model to raise the probability of above-average answers and lower the below-average ones, with a penalty keeping it close to a reference model.

No critic is trained; the group itself provides the baseline. This is why GRPO became the standard recipe for open reasoning-model training.

## What the evidence shows

DeepSeek-R1 (published on arXiv in January 2025 and in *Nature* later that year) reported that large-scale RL on tasks with verifiable answers, such as maths and competitive coding, can lead a model to develop longer chains of thought with **self-reflection, verification and strategy changes without human-written reasoning demonstrations**, and that the resulting reasoning patterns can be used to improve smaller models by distillation. Gains concentrate where outcomes are checkable (maths, code, some science). Research through 2026 continues to analyse GRPO's loss and dynamics and failure modes.

## Where RLVR fits in an enterprise

You do not need to train a frontier model to use the idea. It suits **narrow tasks with an automatic check**:

- Generating SQL or code that is validated by execution and tests.
- Structured extraction where fields can be compared with ground truth.
- Tool-use sequences judged by whether the final system state is correct.
- Rule-based transformations (format conversions, policy checks).

Several providers now offer managed **reinforcement fine-tuning**, where you supply tasks and a grader and the platform runs the optimisation. Compared with supervised fine-tuning (SFT), which imitates examples, RL can discover strategies not in your data, but it needs a reliable grader and many sampled attempts, so it costs more compute.

## Reward design is the whole game

A model optimises exactly what you reward, including loopholes (**reward hacking**):

- A code reward based only on a visible test suite can be gamed by special-casing the tests; use hidden tests.
- A format reward can be satisfied by empty reasoning that merely looks right.
- A length-sensitive reward can produce padding or truncation.
- A partially correct answer rewarded as correct teaches sloppiness; consider graded rewards.

Guard with held-out evaluation, spot-checks of high-reward samples, KL penalties, and rewards that check the *outcome* rather than surface features.

## A worked example

A bank wants a model that converts natural-language reports requests into validated SQL for a reporting warehouse.

1. Build 3,000 tasks, each with a question and a verified expected result set.
2. Reward: 1 if executing the model's SQL returns the same rows (order-insensitive), minus a small penalty for unnecessary joins; 0 otherwise; a safety check zeroes any non-read statement.
3. Start from an SFT model that gets 61% on a held-out set; run GRPO with 8 samples per prompt.
4. Held-out accuracy rises to 78% on questions in the training schema; it does not improve on a new schema, so the team adds schema variety to the training tasks.
5. They spot-check high-reward outputs and find 2% special-casing a literal date; they randomise dates in the tasks.

## When not to use it

When there is no reliable checker, when you have few tasks, when prompting plus retrieval already meets the target, or when failure cost of reward hacking is high and cannot be tested. Start with prompting and evaluation; move to SFT; consider RL only where a grader exists and the gain justifies compute.

## Common mistakes

- **Weak or hackable graders.**
- **Training and evaluating on the same tasks.**
- **Skipping the SFT baseline**, then not knowing if RL helped.
- **Expecting reasoning gains to transfer** to unverifiable tasks.
- **Ignoring cost**: sampling many attempts per prompt multiplies compute.
