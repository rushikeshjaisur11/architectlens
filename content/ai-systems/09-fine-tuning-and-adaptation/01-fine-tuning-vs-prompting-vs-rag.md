---
title: "Fine-Tuning vs. Prompting vs. RAG: Choosing How to Adapt a Model"
short_title: "Fine-Tuning vs Prompting vs RAG"
tags: ["fine-tuning", "adaptation", "llm", "rag"]
sources:
  - "OpenAI and Anthropic documentation on fine-tuning use cases and limitations"
  - "Hugging Face documentation on LoRA and parameter-efficient fine-tuning"
---

## Three different tools for three different problems

A common mistake is reaching for fine-tuning as the default answer to "the model doesn't do what I want," when the actual gap is often something prompting or retrieval solves more cheaply and more reliably. Each technique answers a genuinely different question:

- **Prompting** answers "how do I instruct the model for this specific request" — no training, changes take effect immediately, cheapest to iterate on.
- **RAG** (covered in this track's context-and-RAG lesson) answers "how does the model access knowledge it wasn't trained on" — solves a knowledge-access problem, not a behavior problem.
- **Fine-tuning** answers "how do I change the model's underlying behavior, style, or format compliance in a way that's consistent without needing to re-explain it every time" — solves a behavior-shaping problem, at real cost in data, compute, and iteration speed.

## When fine-tuning is actually the right tool

Fine-tuning earns its cost specifically when the need is persistent behavioral change that prompting can't reliably achieve, even with good examples in-context:

- **Consistent output format at scale**, where few-shot examples in every prompt work but add token cost and occasional inconsistency across thousands of calls — a fine-tuned model can internalize the format more reliably and cheaply per call.
- **Domain-specific style or terminology** that's hard to fully specify via instructions — e.g., matching a specific technical writing style consistently across long-form generation, where prompted instructions tend to drift over a long output.
- **Reducing latency and cost per call** by baking a capability (that previously required a long few-shot prompt) directly into the model weights, shrinking the prompt needed for equivalent behavior.
- **Teaching narrow, specialized tasks** the base model handles inconsistently — a specific classification taxonomy, a structured extraction format specific to your domain — where the task is narrow enough that a smaller fine-tuned model can match or exceed a larger general model's performance on that one task.

## What fine-tuning does not solve

Fine-tuning is a poor fit for teaching a model new *factual knowledge* that needs to stay current or needs to be traceable to a source — the model can absorb facts during fine-tuning, but it has no built-in mechanism to know when a fact it learned is stale, and fine-tuned facts can't be cited back to a source document the way retrieved RAG context can be. A support bot needing up-to-date product information is a RAG problem; a support bot that consistently gives poorly-formatted or off-brand responses despite correct information is more likely a fine-tuning (or better prompting) problem. Conflating these leads to a common anti-pattern: fine-tuning a model on a knowledge base that changes monthly, then having to re-fine-tune on every update — when RAG would have made the same information updatable by just re-indexing.

## Parameter-efficient fine-tuning: making fine-tuning practical

Full fine-tuning — updating every parameter in a model — requires enough compute and memory to hold gradients and optimizer state for the entire model, which is expensive and slow for large models. **LoRA** (Low-Rank Adaptation) and similar parameter-efficient methods instead freeze the original model weights and train a small number of additional parameters (low-rank matrices inserted into specific layers) that adapt the model's behavior. This captures most of the benefit of fine-tuning at a small fraction of the compute and memory cost, and — because the base model weights are untouched — makes it practical to maintain several different fine-tuned "adapters" for different tasks on top of one shared base model, swapping between them without needing multiple full copies of the model in memory.

## A worked example

**Scenario:** a company needs (1) a support bot answering questions from a frequently-updated internal knowledge base, and (2) a code-review assistant that should always output review comments in one specific structured format matching the company's existing tooling.

- **Support bot → RAG, not fine-tuning.** The knowledge base changes weekly; fine-tuning would mean either accepting stale answers between fine-tuning runs or re-fine-tuning constantly, which is slower and more expensive than simply re-indexing updated documents for retrieval — a textbook case for choosing RAG's update model over fine-tuning's.
- **Code-review assistant → fine-tuning (via LoRA), layered on top of good prompting first.** The team first tries a well-specified prompt with a few examples of the exact desired output format; if compliance is inconsistent across the volume of real reviews (say, format deviations on 15% of outputs even with good prompting), that consistency gap — not new knowledge — is exactly what fine-tuning is suited to close, since the underlying task (reviewing code, in a fixed format) doesn't change week to week the way the support knowledge base does.
- **Sequencing matters:** prompting is tried first in both cases because it's nearly free to iterate on; fine-tuning is reached for only once a real, measured gap remains that prompting and retrieval can't close — not as the first move.

## Common mistakes

- **Fine-tuning to inject knowledge that will need to change.** This creates an ongoing re-training burden that RAG's update-by-reindexing model avoids entirely, and it's one of the most common reasons a team's first fine-tuning project turns out to be the wrong tool in hindsight.
- **Skipping straight to fine-tuning without first trying to solve the problem with better prompting.** Many "the model doesn't follow our format" problems are actually solvable with clearer instructions and a couple of well-chosen examples — worth ruling out before paying fine-tuning's cost in data collection, training, and slower iteration cycles.
- **Underestimating the ongoing cost of maintaining a fine-tuned model** — evaluating it against drift as the base model provider deprecates versions, re-running fine-tuning when the underlying task requirements shift, and keeping training data curated — fine-tuning isn't a one-time cost, it's an ongoing commitment that needs to be weighed against the alternative's simplicity.
