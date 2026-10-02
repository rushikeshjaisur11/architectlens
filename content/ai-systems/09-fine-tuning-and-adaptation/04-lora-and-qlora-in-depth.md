---
title: "LoRA and QLoRA in Depth: Fine-Tuning Without Touching the Base Weights"
short_title: "LoRA and QLoRA in Depth"
tags: ["fine-tuning", "lora", "qlora", "peft"]
sources:
  - "Hu et al., 'LoRA: Low-Rank Adaptation of Large Language Models' (2021)"
  - "Dettmers et al., 'QLoRA: Efficient Finetuning of Quantized LLMs' (2023)"
---

## The idea: learn a small correction instead of rewriting the model

This track's fine-tuning lesson introduced LoRA as a parameter-efficient method. Here is the mechanism. A weight matrix `W` in a transformer layer has, say, `d × k` entries — millions of numbers. Full fine-tuning updates all of them. LoRA's observation is that the *change* needed to adapt a model to a task tends to be low-rank: it can be well approximated by the product of two thin matrices.

So LoRA freezes `W` and learns `ΔW = B·A`, where `A` is `r × k` and `B` is `d × r`, and the rank `r` is small (commonly 4 to 64). The layer computes `W·x + (α/r)·B·A·x`: the original output plus a learned low-rank correction, scaled by a constant `α/r`.

## Why the numbers work out

Take a `4096 × 4096` weight matrix: about 16.8 million parameters. With rank `r = 8`, the adapter is `A` (8 × 4096) plus `B` (4096 × 8), about 65 thousand parameters — roughly 0.4% of the original. Apply that across the attention projections (the usual target) and the trainable fraction typically lands well under 1% of the model.

That buys three practical things:

- **Less memory for training.** Gradients and optimizer state exist only for the adapter, not the whole model.
- **Small artifacts.** An adapter is megabytes, not gigabytes, so you can store one per task or per customer.
- **Swappable behavior.** One frozen base model can serve many adapters, loaded or swapped as needed.

At inference you can also *merge* the adapter into the base weights (`W' = W + (α/r)·B·A`), which removes any added latency, or keep it separate to retain swappability.

## The knobs that matter

- **Rank `r`.** Higher rank means more capacity to express the change, and more parameters. Many tasks do fine at low rank; raise it when the adapter underfits, not by default.
- **Alpha `α`.** The scaling factor. It interacts with `r`, so change them with the ratio in mind rather than independently.
- **Target modules.** Which matrices get adapters. Attention projections are the common starting point; adding the feed-forward layers increases capacity and cost.

As with all fine-tuning, none of this rescues bad data. The data-preparation lesson in this track still governs the outcome.

## QLoRA: making it fit on smaller hardware

LoRA shrinks what you *train*, but the frozen base model still has to sit in GPU memory, and for a large model that alone can exceed what you have. **QLoRA** attacks that: it stores the frozen base weights in 4-bit precision while training the LoRA adapters in higher precision on top.

Three ideas from the paper make this work:

- **4-bit NormalFloat (NF4)** — a 4-bit data type designed around the roughly normal distribution of pretrained weights, so the 4 bits are spent where the values actually are.
- **Double quantization** — quantizing the quantization constants themselves to save a little more memory.
- **Paged optimizers** — handling memory spikes during training by paging optimizer state between GPU and CPU memory.

During the forward and backward pass, the 4-bit weights are dequantized on the fly for computation, and gradients flow only into the adapters. The headline result from the paper is that models in the tens of billions of parameters become fine-tunable on a single high-memory GPU, with quality close to 16-bit LoRA on the benchmarks they report.

## A worked example

**Scenario:** a team wants the format-compliant code-review assistant from this track's earlier lessons, but their one GPU cannot hold their chosen base model in 16-bit.

- **QLoRA** loads the base model in 4-bit NF4, which fits, and trains rank-16 adapters on the attention projections.
- **Evaluation** compares the adapter against the prompted baseline on the held-out set from the data-preparation lesson, checking format compliance and review quality, not just training loss.
- **Deployment** keeps the adapter separate: the same base model serves this adapter and a second one for a different review style, loaded per request. Because the base is quantized, they also confirm quality on the *quantized* base they will actually serve, rather than assuming 16-bit results carry over.

## Common mistakes

- **Raising rank first when results disappoint.** Poor results are more often a data problem than a capacity problem; fix the data before spending more parameters.
- **Evaluating only training loss.** A falling loss says the adapter is fitting; it does not say the behavior you wanted has changed. Use the targeted held-out eval.
- **Assuming merged and unmerged adapters, or 16-bit and 4-bit bases, behave identically.** Small numerical differences exist; validate the exact configuration you will deploy.
