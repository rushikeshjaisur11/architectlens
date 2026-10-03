---
title: "Quantization for Inference: INT8, INT4, AWQ, GPTQ, and GGUF"
short_title: "Quantization for Inference"
tags: ["quantization", "inference", "int8", "int4", "gguf", "model-serving"]
sources:
  - "GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers (Frantar et al., 2022)"
  - "AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration (Lin et al., 2023)"
  - "llama.cpp / GGUF format documentation (ggerganov/llama.cpp)"
  - "bitsandbytes LLM.int8() documentation (Hugging Face)"
  - "Quantization guides, 2026 (secondary: gmicloud.ai, vrlatech.com, packet.ai, spheron.network); NVIDIA benchmarks as reported"
banner:
  layout: line
  nodes:
    - [doc, "fp16"]
    - [server, "quantize"]
    - [gpu, "int4"]
    - [shield, "quality"]
predict:
  question: "A 70B model needs about 140 GB for FP16 weights. It is quantized to 4-bit. What is the expected effect on weights and decode?"
  options: ["About 70 GB of weights, and decode latency is unchanged because decode is compute-bound", "About 35 GB of weights, and decode latency drops because fewer bytes move per step", "About 35 GB of weights, and decode latency is unchanged because decode is compute-bound"]
  answer: 1
  why: "INT4 quarters memory versus FP16, and decode is memory-bandwidth bound, so fewer bytes read per step cuts latency."
check:
  - q: "Why is AWQ often the default for W4A16 serving over GPTQ?"
    options: ["It is faster to produce and comparably accurate, while GPTQ's calibration can take hours", "It is the only method that keeps activations in 16-bit precision during inference", "It needs no calibration data and no knowledge of which channels matter"]
    answer: 0
    why: "AWQ avoids GPTQ's expensive reconstruction step and protects salient channels; both are weight-only and keep activations at higher precision."
  - q: "A team assumes INT4 will speed up every workload. Where can the gain shrink?"
    options: ["Decode with small batches, since reading fewer bytes per step does not matter there", "Compute-bound prefill with long prompts, where dequantization overhead offsets the win", "Single-GPU serving, since INT4 only helps when the model is split across several GPUs"]
    answer: 1
    why: "Decode is bandwidth-bound so INT4 helps, but compute-bound prefill pays dequantization overhead that can partly cancel the gain."
  - q: "A code model is quantized with GPTQ using general web text as the calibration set. What is the likely outcome?"
    options: ["No effect, since calibration only matters for the speed of quantization", "Better results, since broader calibration data always generalizes more safely", "Degraded quality on code outputs, since calibration decides what gets protected"]
    answer: 2
    why: "Calibrating on the wrong domain degrades exactly the outputs you care about, because calibration data guides what the method protects."
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

<div data-anim="quantization-tradeoff"></div>

## GGUF and CPU/edge serving

**GGUF** (the format used by `llama.cpp`, successor to GGML) is less a quantization *algorithm* and more a **file format and runtime** optimized for CPU and mixed CPU/GPU inference — the kind of deployment relevant for local or edge use rather than datacenter GPU serving. It supports a range of quantization schemes (Q4_K_M, Q5_K_M, Q8_0, etc.) with different bit-widths and block structures, letting you trade file size and speed against quality on a single spectrum. The key architectural difference from AWQ/GPTQ workflows: GGUF targets `llama.cpp`'s own tensor kernels rather than PyTorch/CUDA, which is why it's the standard choice for running models on laptops or without a dedicated inference server.

## Current practice (verified October 2026)

Precision defaults have moved. **FP8** is reported as the default serving precision on Hopper and Blackwell GPUs, typically within about 0.5 to 1% of BF16 on standard benchmarks. **FP4 (NVFP4)** is native to Blackwell GPUs (B200, B300 and some workstation cards), doubles FP8 tensor throughput on the B200 per NVIDIA's figures, and shrinks a 70B model from about 140 GB to about 40 GB; with good calibration accuracy often lands within 1 to 3% of BF16 (NVIDIA reported 1% or less on several benchmarks for DeepSeek-R1). INT4 methods (AWQ, GPTQ) and GGUF remain common on older GPUs and on-device. Rules: evaluate the quantised model on your task, keep sensitive layers at higher precision where tools allow, and remember FP4 needs Blackwell-class hardware.

## Common mistakes

- **Quantizing without a representative calibration set.** GPTQ and AWQ both use calibration data to decide what to protect; calibrating on the wrong domain (e.g., general text for a code model) degrades exactly the outputs you care about.
- **Assuming INT4 is always faster.** On memory-bandwidth-bound decode it usually is, but for compute-bound prefill (long prompts, large batch sizes) dequantization overhead can partially offset the bandwidth win — throughput gains are workload-dependent, not universal.
- **Mixing quantization format with the wrong serving stack.** AWQ/GPTQ checkpoints target CUDA kernels (vLLM, TGI); GGUF targets `llama.cpp`. Picking the format after picking the server, not before, avoids a reconversion step.
