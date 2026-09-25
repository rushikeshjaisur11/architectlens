---
title: "LLM-as-Judge: Design, Calibration, and Bias Pitfalls"
short_title: "LLM-as-Judge"
tags: ["evaluation", "llm-as-judge", "observability"]
sources:
  - "Zheng et al., \"Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena\" (2023)"
  - "OpenAI Evals documentation (github.com/openai/evals)"
  - "Anthropic Prompt Engineering: evaluating outputs (docs.anthropic.com)"
---

## Why use a model as the judge

Human evaluation is accurate but slow and expensive; exact-match or BLEU-style metrics are fast but useless for open-ended generation, where two correct answers can share zero tokens. **LLM-as-judge** fills the gap: a strong model (often, but not always, a larger or different model than the one under test) scores or compares outputs against a rubric. Zheng et al. (2023) found GPT-4-as-judge agreed with human preference roughly 80-85% of the time on chat quality — comparable to inter-human agreement — which is why judge models became the default for scaling evaluation beyond hand-labeled sets.

## Pointwise vs. pairwise design

Two dominant patterns:

- **Pointwise scoring**: the judge rates a single output on a scale (1-5, or a rubric with sub-scores for correctness, tone, completeness). Cheap — one call per example — but absolute scales drift: a judge's "4" on Monday isn't guaranteed to mean the same thing as its "4" on Tuesday, especially across prompt revisions.
- **Pairwise comparison**: the judge is shown two outputs (A vs. B, or against a reference) and picks a winner, optionally with a tie option. Pairwise comparisons are markedly more reliable than absolute scores, because relative judgments are easier for LLMs (and humans) to make consistently — this is the basis of Chatbot Arena's Elo system. The cost is quadratic if you want a full ranking across many candidates, so in practice teams compare each new model/prompt against a fixed baseline rather than all-pairs.

## Calibration techniques

A judge prompt that isn't calibrated produces scores that don't track ground truth. Standard fixes:

- **Reference-guided grading**: give the judge a gold answer or key facts to check against, not just the model output in isolation. This converts an open-ended quality judgment into a bounded verification task, which judges do far more reliably.
- **Chain-of-thought before the verdict**: ask the judge to write out its reasoning (what's correct, what's missing) before emitting a score or label, then parse the final token. This mirrors why CoT helps the model under test — it gives the judge tokens to "compute" in before committing.
- **Held-out human-labeled set for validation**: before trusting a judge in a pipeline, run it against 100-200 examples with human labels and compute agreement (Cohen's kappa or simple accuracy against majority vote). If agreement is below ~0.7 kappa, the judge prompt needs rework, not the underlying model.
- **Score binning over fine-grained scales**: a 1-100 scale invites false precision; judges are far more consistent on 3-4 discrete bins ("fails," "partial," "good," "excellent") with concrete per-bin criteria written into the prompt.

## Known bias pitfalls

- **Position bias**: in pairwise comparisons, judges systematically favor whichever answer appears first (or, less often, second). Mitigate by running each comparison twice with order swapped and averaging, or discarding pairs where the verdict flips.
- **Length bias**: judges (and humans) tend to rate longer, more detailed answers higher even when the extra content is padding rather than substance. Explicitly instruct the judge to penalize unnecessary verbosity, or normalize by including length-matched examples in a few-shot prompt.
- **Self-preference bias**: a model judging outputs including its own family's generations rates them higher than outputs from other model families, even at equal quality — documented in the MT-Bench paper. Using a different model as judge than the one under test reduces this, though it doesn't eliminate style-similarity effects.
- **Sycophancy toward confident-sounding text**: judges tend to reward assertive phrasing over hedged, accurate phrasing, since fluency is easier to detect than factual correctness. This is why reference-guided grading matters more than the judge's raw capability.

## Common mistakes

- **Trusting a judge without a validation set.** An uncalibrated judge silently produces a metric that looks stable but tracks something other than actual quality — teams optimize against it and regress on real user satisfaction.
- **Using the same model as both generator and judge for architecture decisions** (e.g., picking a prompt variant) — self-preference bias inflates whichever variant sounds most like the judge's own style.
- **Single-pass pairwise without order swapping**, which bakes position bias directly into the reported win rate.
