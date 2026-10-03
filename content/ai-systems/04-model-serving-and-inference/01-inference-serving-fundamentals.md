---
title: "Inference Serving Fundamentals: Batching, KV Caching, and Throughput"
short_title: "Inference Serving Fundamentals"
tags: ["inference", "serving", "llm", "performance"]
sources:
  - "vLLM paper: Kwon et al., 'Efficient Memory Management for Large Language Model Serving with PagedAttention' (2023)"
  - "NVIDIA and Hugging Face documentation on LLM inference optimization"
  - "vLLM documentation and blog, docs.vllm.ai and vllm.ai/blog (fetched October 2026)"
  - "llm-d project blog, llm-d.ai/blog/kvcache-wins-you-can-see (fetched October 2026)"
banner:
  layout: line
  nodes:
    - [queue, "requests"]
    - [server, "batcher"]
    - [gpu, "GPU"]
    - [client, "tokens"]
predict:
  question: "A static batch holds four requests. Three finish after 20 tokens; the fourth needs 500 tokens. What happens to the three finished slots?"
  options: ["Queued requests fill them immediately, so the GPU never has idle batch capacity", "They stay idle until the 500-token request finishes, because new requests cannot join a running batch", "The batch is cut short once most requests finish, and the long request restarts alone"]
  answer: 1
  why: "A static batch is only as fast as its slowest member, and new requests cannot join mid-batch. Continuous batching is what refills slots immediately."
check:
  - q: "A chat service stops accepting more concurrent users while GPU compute is far from saturated. What is the most likely ceiling?"
    options: ["Raw arithmetic throughput, so the fix is a faster GPU", "KV cache memory, which grows with sequence length for every concurrent request", "Autoregressive sequencing, which blocks more than one user at once"]
    answer: 1
    why: "The KV cache must stay in GPU memory for each generation, so memory often caps concurrency before compute does."
  - q: "Why does PagedAttention let one GPU support more concurrent requests than reserving a contiguous block per request?"
    options: ["It allocates small pages as generation proceeds, so unused reservation and fragmentation are avoided", "It compresses the KV cache to lower precision so each request takes fewer bytes", "It skips attention over older tokens so each request needs less cache"]
    answer: 0
    why: "Contiguous up-front reservation wastes memory when responses are shorter than reserved and fragments memory. Paging allocates in small increments."
  - q: "A team ships 8-bit quantization because a public benchmark showed minimal degradation. What is the architect-level flaw?"
    options: ["8-bit is too aggressive for any production system, so 16-bit is mandatory", "Quantization only saves memory and never affects speed, so the risk is not worth it", "Quality impact varies by model and task, so it must be checked on a held-out eval for their use case"]
    answer: 2
    why: "The lesson says a generic benchmark does not guarantee the same result on your task; validate on your own eval set before committing."
---

## Why serving an LLM is a different problem than training one

Training optimizes for throughput over a fixed, known dataset, processed in large batches over hours or days. Serving optimizes for latency to unpredictable, arriving-one-at-a-time requests, where the model must respond fast enough to feel interactive, while still using expensive GPU hardware efficiently. These goals pull in different directions, and most of what makes LLM serving infrastructure non-trivial comes from reconciling them.

## Autoregressive generation is inherently sequential

An LLM generates one token at a time, and each new token depends on all the tokens generated before it — the model can't produce token 50 without having already produced (and fed back in) tokens 1 through 49. This means generating a 100-token response requires 100 sequential forward passes through the model, each one a full GPU computation. This sequential dependency is the root cause of most LLM latency, and most serving optimizations exist specifically to work around it.

## Batching: the main lever for throughput

A single inference request rarely uses a GPU's full compute capacity — modern GPUs are so fast that one request's computation finishes with capacity to spare. Batching multiple requests together, so the GPU processes several users' token generations in the same forward pass, dramatically improves throughput (total tokens/second across all users) at some cost to individual-request latency.

- **Static batching** — wait for a fixed number of requests, process them together, wait for all to finish before starting the next batch. Simple, but a batch is only as fast as its slowest member — a short response sits idle waiting for a long one in the same batch to finish, and new requests can't join a batch already in progress.
- **Continuous batching (also called in-flight batching)** — as soon as any request in a batch finishes generating, a new request is immediately slotted into its place, without waiting for the whole batch to complete. This is the technique behind most modern high-throughput serving systems (vLLM, TensorRT-LLM, and others), since it keeps the GPU consistently busy instead of bounded by the slowest request in a static group.

## KV caching: avoiding redundant computation

Each token's generation depends on attending to all previous tokens' key and value projections (the "KV" in KV cache) computed by the attention mechanism. Without caching, generating token 50 would require recomputing the key/value projections for tokens 1-49 all over again — wasteful, since those values don't change once computed. The KV cache stores these projections after they're first computed, so each new token only computes its own key/value pair and reuses the cached ones for everything before it.

The tradeoff: the KV cache grows linearly with sequence length and must be kept in GPU memory for the duration of a generation, so long conversations or long documents consume proportionally more memory — often becoming the actual bottleneck on how many concurrent requests a GPU can serve, before compute capacity is.

**PagedAttention** (introduced by vLLM) addresses a specific inefficiency in naive KV cache management: allocating a large contiguous memory block per request up front wastes memory when the actual generated length is shorter than reserved, and fragments memory over many requests of varying length. PagedAttention manages the KV cache in fixed-size, non-contiguous "pages" (borrowing the idea from OS virtual memory paging), letting memory be allocated and freed in small increments as generation actually proceeds — meaningfully increasing how many concurrent requests a given amount of GPU memory can support.

## Quantization: trading precision for speed and memory

Model weights are usually trained in 16-bit or 32-bit floating point. Quantization reduces this to lower precision (8-bit, 4-bit, or below) for inference, shrinking memory footprint and often improving speed, at some cost to output quality. The quality cost is usually small for moderate quantization (e.g., 8-bit) but grows more noticeable at aggressive levels (4-bit and below), and the acceptable tradeoff point depends heavily on the task — a customer-facing chat assistant tolerates less degradation than an internal batch-classification job.

## A worked example

**Scenario:** serving a chat assistant that needs to support many concurrent users with low latency, on a fixed GPU budget.

- **Continuous batching** is close to mandatory here — static batching would mean a user with a short question waits behind another user's long response finishing in the same batch, directly hurting the metric (latency) that matters most for a chat product.
- **KV cache memory becomes the practical ceiling on concurrency** before raw compute does, for most chat workloads with moderate-length conversations — so a serving engine with efficient KV cache management (like PagedAttention-based vLLM) directly increases how many simultaneous conversations one GPU can handle, which is often the real cost lever, more than a marginally faster GPU would be.
- **Quantization (e.g., 8-bit)** is a reasonable default to reduce memory footprint and fit a larger model or more concurrent requests on the same hardware, with a quality check against a held-out eval set (see this track's evaluation lesson) before committing to it in production, rather than assuming the quality cost is negligible without checking.

## Current practice (verified October 2026)

Continuous batching, paged KV-cache management and prefix caching are now defaults in the main engines, so the interesting decisions are scheduling and topology. vLLM's documentation describes prefill/decode disaggregation as experimental and as a way to tune time-to-first-token and inter-token latency independently and control tail latency, *not* to raise throughput. KV-cache-aware routing (llm-d) is the larger lever for shared-prefix workloads such as chat and agents. Track cache hit rate, TTFT and ITL percentiles and queue depth as first-class SLIs.

## Common mistakes

- **Treating latency and throughput as the same optimization target.** Techniques that maximize throughput (large batch sizes) can increase per-request latency; the right batch size depends on which metric the product actually needs optimized, and that's rarely "both, maximally," since they trade against each other.
- **Ignoring KV cache memory growth for long-context use cases.** A system tested with short prompts can hit an unexpected memory wall in production once users send long documents or long conversation histories — this needs load-testing with realistic context lengths, not just short synthetic ones.
- **Quantizing without measuring quality impact on your actual task.** Quantization's effect on output quality varies by model and task; a generic benchmark showing "minimal degradation" doesn't guarantee the same holds for your specific use case without checking.
