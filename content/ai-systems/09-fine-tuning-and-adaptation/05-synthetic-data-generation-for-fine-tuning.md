---
title: "Synthetic Data Generation for Fine-Tuning"
short_title: "Synthetic Data Generation"
tags: ["fine-tuning", "synthetic-data", "data-generation", "distillation"]
sources:
  - "Self-Instruct: Aligning Language Models with Self-Generated Instructions (Wang et al., 2022, arXiv:2212.10560)"
  - "Textbooks Are All You Need (Phi model technical report, Gunasekar et al., 2023, arXiv:2306.11644)"
  - "Orca: Progressive Learning from Complex Explanation Traces of GPT-4 (Mukherjee et al., 2023, arXiv:2306.02707)"
---

## Why synthetic data

High-quality labeled fine-tuning data is expensive and slow to collect at scale — human annotation for a few thousand instruction-response pairs with careful quality control can take weeks and real budget. **Synthetic data generation** uses a capable LLM to generate training examples (instructions, responses, or both) for fine-tuning a target model, trading annotation cost for compute cost and introducing a new set of risks around quality and diversity. This became mainstream after **Self-Instruct**, which showed a model could bootstrap its own instruction-tuning set from a small seed set (175 human-written tasks) by prompting itself to generate new instructions, then generate corresponding outputs, then filter for quality and diversity — producing 52K instructions competitive with human-curated sets at a fraction of the cost.

## Core techniques

- **Distillation from a stronger model**: prompt a frontier model (GPT-4-class) to generate responses — or, more effective, full reasoning traces — for a target model to imitate. **Orca** showed that training on step-by-step explanations extracted from a large teacher model, not just final answers, transfers reasoning capability far more effectively than imitating outputs alone; the target model learns *how* to arrive at an answer, not just what the answer looks like.
- **Self-Instruct / bootstrapping**: seed a small set of human-written examples, prompt a strong model to generate variations and entirely new instructions in the same style, then filter (via similarity thresholds against existing examples, or a classifier) to maintain diversity and avoid degenerate repetition.
- **Textbook-style curated synthesis**: the Phi model series showed that carefully generated, high-quality "textbook-like" synthetic data — explicitly designed for clarity, diversity of topic, and reasoning density rather than scraped-web-like noise — lets a small model (1-3B parameters) match much larger models on reasoning benchmarks. The insight is that data *quality and structure* substitute for raw data *volume*.
- **Back-translation / round-trip generation**: for tasks like instruction generation, take existing unlabeled outputs (e.g., code snippets, documents) and generate the instruction that would have produced them — useful when you have abundant "answers" but no paired "questions."
- **Rejection sampling / best-of-N filtering**: generate multiple candidate outputs per prompt from the teacher model, score them (with a reward model, a rubric, or the teacher itself), and keep only the highest-quality ones as training data — this is how many RLHF-adjacent SFT datasets are refined post-generation.

## Risks and quality control

Synthetic data inherits and can amplify the generating model's biases, factual errors, and stylistic tics — a model fine-tuned heavily on GPT-4-generated data tends to pick up GPT-4's characteristic phrasing and hedging patterns regardless of whether that's desirable for the target use case. **Model collapse** is the sharper long-term risk: training successive model generations on each other's outputs (rather than fresh human-generated data) progressively narrows the output distribution, losing tail behaviors and diversity over generations — documented empirically in recursive training studies. Mitigations that matter in practice:

- **Diversity filtering**: dedupe near-identical generations (embedding similarity or n-gram overlap) so the training set doesn't collapse toward a few dominant patterns the generator over-produces.
- **Always mixing in some real data**: pure-synthetic training sets are riskier than blends; keeping a portion of human-generated or human-verified examples anchors the distribution.
- **Automated + spot-check human verification**: use a separate model (or rubric-based LLM judge) to filter for correctness at scale, but spot-check a sample manually — automated filters share blind spots with the generator if it's the same model family.
- **License and terms-of-service awareness**: generating training data from a commercial API's outputs to train a competing or redistributed model is restricted under most major providers' terms of service — this is a real constraint on distillation pipelines, not just a legal footnote.

## Common mistakes

- **Generating outputs without generating (or filtering for) diverse instructions first.** If the seed instructions are narrow, no amount of output-generation sophistication fixes the resulting model's narrow behavior — diversity has to be engineered at the instruction level.
- **Skipping quality filtering because "the teacher model is good enough."** Even frontier models produce a meaningful error rate on niche or reasoning-heavy prompts; unfiltered synthetic data propagates those errors directly into the fine-tuned model.
- **Training purely on synthetic data across multiple generations without fresh human data.** This is the direct path to model collapse — each generation's errors and distributional narrowing compound.
- **Ignoring provider terms of service when distilling from a commercial model's API.** Treating "the model can generate it" as equivalent to "we're allowed to train on it" is a common and costly oversight in production pipelines.
