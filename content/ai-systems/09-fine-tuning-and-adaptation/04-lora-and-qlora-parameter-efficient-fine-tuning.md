---
title: "LoRA and QLoRA: Parameter-Efficient Fine-Tuning"
short_title: "LoRA and QLoRA"
tags: ["fine-tuning", "lora", "qlora", "peft"]
sources:
  - "LoRA: Low-Rank Adaptation of Large Language Models (Hu et al., 2021, arXiv:2106.09685)"
  - "QLoRA: Efficient Finetuning of Quantized LLMs (Dettmers et al., 2023, arXiv:2305.14314)"
  - "Hugging Face PEFT documentation"
---

## The core idea

Full fine-tuning updates every weight in a model — for a 7B-parameter model, that's 7 billion gradients, optimizer states, and activations to hold in memory simultaneously, easily 4-8x the model's own footprint with Adam. **LoRA (Low-Rank Adaptation)** sidesteps this by freezing the original weight matrix `W` entirely and learning a small additive update instead. For a weight matrix `W ∈ R^(d×k)`, LoRA introduces two low-rank matrices `A ∈ R^(d×r)` and `B ∈ R^(r×k)` where `r` (the rank) is typically 4-64 — far smaller than `d` or `k`. The forward pass becomes `Wx + BAx`, and only `A` and `B` are trained. For a 4096×4096 attention projection, full fine-tuning trains ~16.8M parameters per matrix; LoRA at rank 8 trains `4096×8 + 8×4096 = 65,536` — a 250x reduction for that layer.

This isn't a hack that trades quality for size. The paper's central hypothesis, borne out empirically, is that weight updates during adaptation have a low "intrinsic rank" — the meaningful change needed to specialize a model for a task lives in a much lower-dimensional subspace than the full weight matrix. LoRA matches or beats full fine-tuning on many benchmarks while training a tiny fraction of the parameters.

## Where to apply it and what rank to pick

The original paper applied LoRA only to the attention projection matrices (`W_q`, `W_v`); later work (and most production PEFT setups) extends it to `W_k`, `W_o`, and the MLP layers too, since gains compound when more of the network can adapt. Rank `r` is the main lever: higher rank gives the adapter more capacity to represent complex behavior changes (useful for tasks far from the base model's distribution, like a new domain or language) but increases trained parameters and risks overfitting on small datasets. Common practice is `r=8` to `r=16` for lightweight style/format adaptation, `r=32` to `r=64` for larger behavior shifts. A second hyperparameter, `alpha`, scales the LoRA update (`alpha/r` is the effective multiplier) — a common convention is `alpha = 2×r`.

Because `A` and `B` are separate from `W`, multiple LoRA adapters can be trained for different tasks and hot-swapped against the same frozen base model, or even merged back into `W` at inference time (`W' = W + BA`) for zero added latency, unlike adapter methods that add extra forward-pass layers.

## QLoRA: fitting it in less memory

**QLoRA** answers a different bottleneck: even with LoRA reducing trainable parameters, the frozen base model still needs to sit in memory in full precision to compute forward/backward passes. QLoRA quantizes the frozen base model to 4-bit (using **NF4**, a data type tuned for the roughly-normal distribution of neural network weights) and trains LoRA adapters in bfloat16 on top of it. Three techniques make this work without quality loss:

- **4-bit NormalFloat (NF4)**: an information-theoretically optimal quantization for normally-distributed weights, outperforming standard 4-bit int or float formats.
- **Double quantization**: quantizes the quantization constants themselves, saving ~0.4 bits/parameter on top.
- **Paged optimizers**: use NVIDIA unified memory to page optimizer states to CPU RAM during memory spikes, avoiding OOM crashes on long sequences.

The result: QLoRA fine-tuned a 65B model on a single 48GB GPU, something that would otherwise require multiple 80GB GPUs — while matching full 16-bit fine-tuning performance on benchmarks like Vicuna evaluations. The tradeoff is training speed (dequantizing on the fly costs compute) and that quality can degrade slightly on tasks requiring very fine-grained numeric precision in the base weights.

## Common mistakes

- **Setting rank too low for the task distance.** A rank-4 adapter can teach a model a new output format but usually can't teach genuinely new knowledge or a very different domain's vocabulary — mistaking "it trains" for "it has enough capacity."
- **Applying LoRA only to attention when the task needs MLP capacity.** Many gains in later PEFT work came specifically from including `up_proj`/`down_proj`/`gate_proj` in the target modules, not just attention.
- **Confusing QLoRA's memory savings with training-time savings.** QLoRA reduces memory footprint dramatically but doesn't make training faster — dequantization overhead and paged optimizer swaps can make it slower per step than full-precision LoRA when memory isn't the constraint.
- **Forgetting to merge or manage adapters explicitly at deploy time.** An unmerged adapter adds a small but real inference latency; production serving of many adapters needs an explicit strategy (per-request adapter loading, merged checkpoints, or multi-adapter serving frameworks) rather than assuming it "just works" like the base model.
