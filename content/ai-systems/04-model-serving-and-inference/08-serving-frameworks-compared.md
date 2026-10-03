---
title: "Serving Frameworks Compared: vLLM, TGI, Triton, and SGLang"
short_title: "Serving Frameworks Compared"
tags: ["vllm", "tgi", "triton", "sglang", "inference", "model-serving"]
sources:
  - "vLLM documentation and PagedAttention paper (Kwon et al., 2023)"
  - "Hugging Face Text Generation Inference (TGI) documentation"
  - "NVIDIA Triton Inference Server documentation"
  - "SGLang documentation and RadixAttention paper (Zheng et al., 2024)"
  - "vLLM documentation and blog, docs.vllm.ai and vllm.ai/blog (fetched October 2026)"
  - "Serving framework comparisons, 2026 (secondary: premai.io, deploybase.ai, yottalabs.ai, tensormesh.ai)"
banner:
  layout: fan
  nodes:
    - [server, "engine"]
    - [gpu, "vLLM"]
    - [gpu, "TGI"]
    - [gpu, "TensorRT"]
predict:
  question: "A workload runs tree-of-thought search, where many branches share a long partial history. Which mechanism lets the server reuse KV cache across those branches?"
  options: ["RadixAttention's radix tree, which matches any shared token prefix dynamically", "TensorRT compilation, which fixes one preconfigured prefix for every request", "Rule-based routing, which sends every branch to a separate model tier"]
  answer: 0
  why: "SGLang's RadixAttention reuses KV cache for any shared prefix, which suits branching and multi-turn agent workloads."
check:
  - q: "An LLM-only team picks Triton because it is the most general server. What is the trade-off they overlooked?"
    options: ["Triton cannot serve LLMs at all, so the stack will not run", "Its configuration and per-GPU compilation overhead only pay off for heterogeneous model fleets", "Triton lacks an OpenAI-compatible endpoint, so clients need rewriting"]
    answer: 1
    why: "Triton's steeper setup and TensorRT-LLM compilation step add machinery that LLM-only serving rarely needs."
  - q: "Why should a new build avoid Hugging Face TGI in October 2026?"
    options: ["Its throughput is permanently half of vLLM's on every workload", "It does not support quantization formats such as AWQ or GPTQ", "It is frozen, reported in maintenance mode and archived read-only in 2026"]
    answer: 2
    why: "The lesson reports TGI as archived, so maintenance health matters alongside peak numbers."
  - q: "A framework comparison uses single-request latency tests. Why is this misleading?"
    options: ["Differences show up mainly under concurrent, variable-length load with continuous batching", "Single-request tests favor the slowest server, which skews rankings", "Frameworks behave identically on one request, so only model size matters"]
    answer: 0
    why: "Single-request benchmarks understate the gap; use realistic concurrency, prompt lengths and your own model."
---

## Why the choice of server matters

All four frameworks solve the same underlying problem — serving transformer models efficiently under concurrent load — but they diverge in what they optimize for: raw LLM throughput, multi-framework flexibility, or complex structured-generation workloads. Picking the wrong one costs real throughput and engineering time, since migrating a serving stack later means re-validating latency, quantization support, and deployment tooling from scratch.

## vLLM

vLLM's defining contribution is **PagedAttention** — managing the KV cache in fixed-size, non-contiguous blocks (like OS virtual memory pages) instead of one contiguous per-sequence buffer. This eliminates the internal and external memory fragmentation that plagued earlier serving stacks, letting vLLM pack more concurrent sequences into the same GPU memory and achieve significantly higher throughput under continuous batching. It has become the de facto default for pure LLM serving: broad model support via Hugging Face checkpoint compatibility, built-in support for AWQ/GPTQ quantization, automatic prefix caching, and an OpenAI-compatible API server out of the box. Its focus is squarely on single- and multi-GPU LLM inference — it doesn't try to be a general model server for non-LLM workloads.

## Hugging Face TGI (Text Generation Inference)

TGI was one of the earliest production-grade LLM servers and is tightly integrated with the Hugging Face ecosystem — models, tokenizers, and the Hub. It supports continuous batching, tensor parallelism, and quantization (bitsandbytes, GPTQ, AWQ), and is a reasonable default when a team is already standardized on Hugging Face tooling end to end. Its throughput has historically trailed vLLM on comparable hardware since vLLM's PagedAttention specifically targets the memory-fragmentation bottleneck that TGI's more conventional KV cache allocation doesn't address as aggressively, though the gap has narrowed release over release as TGI has adopted similar techniques.

## NVIDIA Triton Inference Server

Triton is a **general-purpose** model server, not LLM-specific — it serves models from TensorFlow, PyTorch, ONNX, TensorRT, and (via the TensorRT-LLM backend) large language models, all behind one unified serving layer with a consistent API. Its value proposition is standardizing inference infrastructure across an organization running many model types, not just LLMs — plus deep integration with NVIDIA's TensorRT compilation stack for maximum single-GPU throughput on latency-critical workloads. The tradeoff is complexity: configuring Triton (model repository layout, backend-specific config files, ensemble pipelines) has a steeper learning curve than vLLM's near-drop-in Hugging Face compatibility, and getting TensorRT-LLM's full performance requires an explicit model compilation step per target GPU architecture, which is more operational overhead than vLLM's load-and-serve model.

## SGLang

SGLang is built around **RadixAttention**, which generalizes prefix caching using a radix tree keyed by token sequences, so KV cache can be reused across requests that share any prefix — not just an exact, preconfigured one. This makes it especially strong for workloads with heavy structural reuse: multi-turn agent conversations, tree-structured generation (tree-of-thought, best-of-n sampling), and complex prompt templates with shared few-shot components. It also introduces a Python-embedded DSL for expressing structured generation programs (constrained decoding, multi-step control flow) more natively than prompting alone. For straightforward single-turn chat serving, SGLang and vLLM perform comparably; SGLang's edge shows up specifically on workloads with heavy prefix or structural sharing.

## Choosing between them

- **Pure LLM serving, broad compatibility, strong default throughput**: vLLM.
- **Already standardized on Hugging Face tooling**: TGI.
- **Multi-framework model fleet (not just LLMs), need TensorRT-level single-GPU performance**: Triton.
- **Heavy structured generation, agent workloads with shared prefixes/branches**: SGLang.

## Current practice (verified October 2026)

Status check, October 2026 (secondary sources, confirm in each project's repository):

- **vLLM** is the default general-purpose engine (continuous batching, PagedAttention, prefix caching, wide hardware support). Its documentation labels prefill/decode disaggregation **experimental**.
- **SGLang** is favoured for structured generation and agent workloads, with comparison posts reporting higher throughput than vLLM on some H100 tests (for example about 16,200 versus 12,500 tokens per second on a Llama 3.1 8B benchmark); results vary with model and workload.
- **TensorRT-LLM** extracts peak performance on NVIDIA hardware at the cost of compilation and tighter coupling.
- **Hugging Face TGI** is **frozen**: reported put into maintenance mode in December 2025 and archived read-only on 21 March 2026, so avoid it for new builds.
- **Routing and orchestration layers** such as llm-d (a CNCF Sandbox project) add KV-cache-aware routing on top of vLLM, and NVIDIA Dynamo targets the same pattern.

Choose by benchmarking your model, prompt lengths and concurrency, and weigh maintenance health and hardware support as much as peak numbers.

## Common mistakes

- **Benchmarking frameworks on toy request patterns.** Throughput differences between these servers show up mainly under realistic concurrent, variable-length load with continuous batching — single-request latency benchmarks understate the gap.
- **Choosing Triton for a pure-LLM shop without needing its multi-framework generality.** Its added configuration overhead only pays off when serving heterogeneous model types; for LLM-only serving it's usually more machinery than needed.
- **Ignoring quantization format compatibility when picking a server.** Not every framework supports every quantization method equally well (e.g., TensorRT-LLM has its own compilation path distinct from AWQ/GPTQ checkpoints); the model format and the server need to be chosen together, not independently.
