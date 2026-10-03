---
title: "Small Language Models and On-Device Inference"
short_title: "Small Models and On-Device Inference"
tags: ["slm", "on-device", "edge", "quantization", "privacy", "inference"]
sources:
  - "Small language model and edge inference roundups, 2026 (secondary: derekmolloy.ie, meta-intelligence.tech, iotdigitaltwinplm.com)"
  - "llama.cpp, ExecuTorch and ONNX Runtime project documentation"
banner:
  layout: line
  nodes:
    - [client, "device"]
    - [model, "small LM"]
    - [cloud, "fallback"]
    - [doc, "answer"]
---

## Why run a small model at all

A frontier model is a remote service: network latency, per-token cost, data leaving your boundary. A **small language model (SLM)**, roughly 0.5 to 15 billion parameters, can run on a laptop, phone, factory gateway or a single modest GPU. The motivations are concrete:

- **Privacy and data residency**: text never leaves the device or site.
- **Latency**: no round trip; useful for keystroke-level features and voice.
- **Offline operation**: factory floors, vehicles, field devices, air-gapped sites.
- **Cost at volume**: no per-token fee for millions of small calls.
- **Control**: pinned weights, no silent provider updates.

The price is capability. An SLM is weaker at broad knowledge, long reasoning and rare languages, so the engineering question is *which tasks it can own*.

## What small models can do well

Tasks that are narrow, well-defined and checkable: classification and routing, entity and field extraction, short summarisation, rewriting and autocomplete, on-device search over local notes, intent detection for voice, and structured output against a schema. Roundups for 2026 report that current small models (for example Gemma 4's 4.5B-effective-parameter variant at about 69% on MMLU-Pro, or Qwen3's 4B model matching a much larger earlier generation) reach quality that needed models more than ten times bigger two years ago. A mixture-of-experts design (a 26B-parameter model with about 4B active per token) can approach a dense 31B model's quality at far lower compute. Treat these as secondary figures and test on your task.

## How they fit in memory

Memory, not arithmetic, decides what runs where. Weights need roughly parameters times bytes per parameter:

- 4B parameters at 16-bit: about 8 GB.
- 4B at 4-bit quantisation: about 2 GB, plus the KV cache.
- 8B at 4-bit: about 4 to 5 GB.

A phone with 8 GB of RAM shared with the operating system can hold a 3B to 4B model at 4-bit comfortably, an 8B only tightly. The KV cache grows with context length, so a 32,000-token context can add gigabytes; on-device apps usually cap context at a few thousand tokens.

## The runtime stack

On-device engines such as **llama.cpp**, **ExecuTorch** and **ONNX Runtime** load quantised weights, tokenise, and dispatch the compute graph to a hardware backend: the NPU (neural processing unit) where supported, else GPU or CPU for operators the accelerator cannot handle. Recent phone-class NPUs are marketed in the range of about 100 TOPS, and vendors cite generation speeds above 200 tokens per second for small models. Real speed depends on quantisation format, memory bandwidth and the model's operators, so measure on the target device.

## A worked example

A field-service app helps technicians in basements with no signal.

1. Requirement: summarise a repair note into a structured work order (fields: asset, fault, parts, status) in under 3 seconds, offline.
2. A 3B model quantised to 4-bit (about 1.7 GB) runs through ExecuTorch on the phone's NPU at about 25 tokens per second; the work order needs about 80 output tokens, so roughly 3 seconds including prompt processing.
3. Output is constrained to a JSON schema; fields that fail validation fall back to a form.
4. When connectivity returns, notes sync to the server, where a larger model re-checks a 5% sample for quality and feeds corrections into the next fine-tune.

## Hybrid architectures

Most enterprise designs are **tiered**: the device model handles private, low-latency, simple work; a cloud model handles hard cases when allowed. A router decides using task type, confidence and policy ("never send this field type off device"). Distillation from a large model into an SLM, plus fine-tuning on your narrow task, is the usual way to close the quality gap.

## Operating it

- **Updates**: model files are large; ship deltas, version them, and allow rollback.
- **Fleet diversity**: devices differ in RAM, NPU support and OS; keep a capability matrix and fallbacks.
- **Evaluation**: test the quantised model on the device, not the full-precision model on a server.
- **Security**: weights on a device can be extracted; do not embed secrets in prompts or fine-tunes.
- **Telemetry** that respects privacy: log latency and errors, not content.

## Common mistakes

- **Choosing by parameter count** instead of task accuracy on your data.
- **Evaluating at full precision** and shipping a 4-bit model.
- **Ignoring the KV cache** when sizing memory.
- **No cloud fallback** for the 5% of inputs the small model cannot handle.
- **Forgetting battery and thermal limits** on sustained generation.
