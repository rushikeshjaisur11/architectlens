---
title: "Speculative Decoding and Model Distillation"
short_title: "Speculative Decoding and Distillation"
tags: ["inference", "serving", "distillation", "optimization"]
sources:
  - "Leviathan et al., 'Fast Inference from Transformers via Speculative Decoding' (2023)"
  - "Hinton, Vinyals & Dean, 'Distilling the Knowledge in a Neural Network' (2015)"
---

## Two different problems, two different techniques

This lesson covers two further inference-optimization techniques beyond continuous batching and KV caching (covered in this track's inference serving fundamentals lesson): **speculative decoding**, which speeds up a single large model's generation, and **distillation**, which creates a smaller model that approximates a larger one's behavior. They solve different problems — one is a serving-time trick applied to an existing model, the other is a separate training process that produces a new, smaller model — but both exist for the same underlying reason: the sequential, token-by-token nature of autoregressive generation (also covered in the inference fundamentals lesson) is the fundamental bottleneck, and both techniques are ways of working around it from different angles.

## Speculative decoding: guessing ahead, verifying in bulk

Autoregressive generation is slow specifically because each token depends on the previous ones being generated first — you can't compute token 10 before token 9 exists. **Speculative decoding** exploits an asymmetry: verifying that a proposed sequence of tokens is what the large model *would have* generated is much cheaper than generating that sequence token by token in the first place, because verification can process multiple tokens in a single forward pass, while generation is strictly sequential.

The mechanism: a small, fast "draft" model generates a short sequence of candidate tokens (say, 4-5 tokens) far faster than the large target model could. The large model then verifies this candidate sequence in a single forward pass — checking, for each position, whether the large model would have assigned high enough probability to the draft model's guessed token. Wherever the draft model's guesses match what the large model would have chosen, those tokens are accepted for free, without the large model ever having to generate them sequentially itself; wherever they diverge, the large model's own (correct) token is used instead, and drafting resumes from that point. On draft sequences with a good match rate, this can meaningfully speed up generation — several tokens accepted per large-model forward pass instead of one, without changing the actual output distribution (the technique is designed to produce results statistically identical to standard decoding, not merely "close enough").

The catch: this only helps if the draft model's guesses are frequently correct — for genuinely unpredictable, high-entropy text (novel, creative continuations), the draft model's guesses diverge from the target model more often, reducing the speedup; for more predictable text (structured output, common phrasing, code following familiar patterns), the technique's benefit is larger, since the draft model has a real chance at correctly guessing several tokens ahead.

## Distillation: training a smaller model to imitate a larger one

Where speculative decoding speeds up serving a large model as-is, **distillation** is a training-time technique that produces an entirely separate, smaller model intended to approximate the larger "teacher" model's behavior on the tasks that matter for a given application. The smaller "student" model is trained not just on the original labeled data (if any), but on the teacher model's own output distributions — the student learns to mimic the richer signal of the teacher's full probability distribution over possible outputs, not just a single correct answer, which tends to transfer more of the teacher's learned behavior than training on hard labels alone would.

A well-executed distillation can produce a student model that's dramatically cheaper and faster to serve (fewer parameters, less compute per token) while retaining most of the teacher's quality *on the specific tasks the distillation targeted* — the student isn't generally as capable as the teacher across every possible task, but for a narrower, well-defined application, a distilled model can be a genuinely strong cost/latency tradeoff, connecting directly to this track's cost-and-latency lesson's point about routing tasks to the smallest model that meets the quality bar.

## Why these are complementary, not competing, techniques

Speculative decoding speeds up a given model's generation without changing which model is deployed. Distillation changes which model is deployed to begin with. A production system can use both: distill a smaller, task-specific model where the quality bar allows it (reducing cost and latency at the model-selection level), and apply speculative decoding on top of whichever model remains in production (further reducing latency at the serving level) — the two optimizations stack rather than substitute for each other.

## A worked example

**Scenario:** a code-completion product needs very low latency (completions need to feel instant while a developer types) at high request volume.

- **Distillation** is used to train a smaller, code-specialized student model from a larger general-purpose teacher, using the teacher's outputs on a large corpus of realistic coding scenarios — since code completion is a narrower, well-defined task, a distilled student can retain most of the teacher's relevant quality on this task specifically, at a fraction of the serving cost, even though the same student would underperform the teacher on a broader range of general tasks it wasn't distilled for.
- **Speculative decoding** is then applied on top of serving the distilled model, using an even smaller draft model — code completions are often highly predictable (common syntax patterns, standard library calls, boilerplate), which is exactly the high-match-rate scenario where speculative decoding's benefit is largest, compounding the latency reduction already gained from distillation.
- **Net effect**: the combination targets both the "which model" cost lever and the "how fast can this specific model generate" latency lever simultaneously, rather than relying on just one optimization to carry the full latency requirement.

## Common mistakes

- **Expecting speculative decoding to provide a large speedup on highly unpredictable generation tasks** (open-ended creative writing, for instance) where the draft model's guesses frequently diverge from the target model — the technique's benefit is workload-dependent, not a universal fixed multiplier.
- **Distilling a student model without a clear, narrow target task in mind**, then being surprised when it underperforms the teacher broadly — distillation trades general capability for efficiency on a specific target distribution of tasks, and works best when that target is well-defined and the training data reflects it.
- **Treating these as alternatives to choose between rather than complementary techniques.** As shown in the worked example, distillation (model-level) and speculative decoding (serving-level) address the cost/latency problem from different angles and can be combined for compounding benefit, not just one or the other.
