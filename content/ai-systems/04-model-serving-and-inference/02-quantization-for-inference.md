---
title: "Quantization for Inference: INT8, INT4, AWQ, GPTQ, and GGUF"
short_title: "Quantization for Inference"
tags: ["quantization", "inference", "int8", "int4", "gguf", "model-serving"]
sources:
  - "GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers (Frantar et al., 2022)"
  - "AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration (Lin et al., 2023)"
  - "llama.cpp / GGUF format documentation (ggerganov/llama.cpp)"
  - "bitsandbytes LLM.int8() documentation (Hugging Face)"
---

## Why quantize at all

LLM inference is usually **memory-bandwidth bound**, not compute bound: for autoregressive decoding, the GPU spends most of its time moving weights from HBM into registers for a single token at a time, and the FLOPs required are tiny relative to that transfer. A 70B model in FP16 needs ~140GB just for weights, and every decode step re-reads that entire footprint. Quantization shrinks the number of bits per weight — halving or quartering the bytes moved per step — which directly cuts decode latency and lets a bigger model fit in a smaller GPU budget. It's the single highest-leverage lever for serving cost, more impactful than most kernel-level optimizations, because it attacks the bottleneck directly rather than working around it.

The tradeoff is accuracy: naive rounding of 16-bit weights to 4 bits introduces enough error to visibly degrade output quality, especially on models that weren't trained with quantization in mind. The interesting engineering is in **how** you quantize to minimize that loss.

## Post-training quantization: GPTQ and AWQ

Both are **weight-only** PTQ methods — they quantize weights to low bit-width while keeping activations in higher precision, and neither requires retraining.

**GPTQ** (Frantar et al.) quantizes layer by layer, using a calibration dataset to compute the Hessian of the reconstruction error and greedily update remaining unquantized weights to compensate for the error introduced by quantizing each weight — essentially a second-order correction. It's slower to run (calibration can take hours for large models) but was the first PTQ method to get 3-4 bit quantization to near-lossless perplexity on GPT-scale models.

**AWQ** (Lin et al.) starts from the observation that not all weights matter equally: a small fraction of weight channels (roughly 1%) are "salient" because they correspond to activations with large magnitude, and protecting those channels from quantization error preserves most of the accuracy. Instead of mixed-precision (which is hardware-unfriendly), AWQ scales up salient channels before quantization and scales them back down after, keeping everything in a uniform low-bit format. It's cheaper to run than GPTQ (no backprop-like reconstruction) and tends to win on instruction-tuned and chat models where preserving specific attention patterns matters.

In practice: AWQ is the more common default for W4A16 (4-bit weights, 16-bit activations) serving today because it's faster to produce and comparably accurate; GPTQ remains widely supported and is often the first format a new architecture gets.

## INT8 vs INT4

**INT8** (e.g., `bitsandbytes` LLM.int8()) roughly halves memory versus FP16 and is close to lossless for most models — it's a safe default when memory pressure is moderate. It decomposes matrix multiplication to handle outlier feature dimensions in FP16 while quantizing the rest, avoiding the accuracy cliff that naive INT8 rounding causes on transformer activations.

**INT4** (AWQ, GPTQ, GGUF Q4) quarters memory versus FP16 and is where quantization gets serving-relevant: it's often the difference between a model fitting on one GPU versus needing two, or fitting on consumer hardware at all. The accuracy cost is real but usually small (low single-digit percentage degradation on standard benchmarks) for well-calibrated 4-bit methods — below 4 bits, quality degrades much faster and is rarely used in production serving.

## GGUF and CPU/edge serving

**GGUF** (the format used by `llama.cpp`, successor to GGML) is less a quantization *algorithm* and more a **file format and runtime** optimized for CPU and mixed CPU/GPU inference — the kind of deployment relevant for local or edge use rather than datacenter GPU serving. It supports a range of quantization schemes (Q4_K_M, Q5_K_M, Q8_0, etc.) with different bit-widths and block structures, letting you trade file size and speed against quality on a single spectrum. The key architectural difference from AWQ/GPTQ workflows: GGUF targets `llama.cpp`'s own tensor kernels rather than PyTorch/CUDA, which is why it's the standard choice for running models on laptops or without a dedicated inference server.

## Common mistakes

- **Quantizing without a representative calibration set.** GPTQ and AWQ both use calibration data to decide what to protect; calibrating on the wrong domain (e.g., general text for a code model) degrades exactly the outputs you care about.
- **Assuming INT4 is always faster.** On memory-bandwidth-bound decode it usually is, but for compute-bound prefill (long prompts, large batch sizes) dequantization overhead can partially offset the bandwidth win — throughput gains are workload-dependent, not universal.
- **Mixing quantization format with the wrong serving stack.** AWQ/GPTQ checkpoints target CUDA kernels (vLLM, TGI); GGUF targets `llama.cpp`. Picking the format after picking the server, not before, avoids a reconversion step.
