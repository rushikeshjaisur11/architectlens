---
title: "Disaggregated Serving and KV-Cache-Aware Routing"
short_title: "Disaggregated Serving and Cache-Aware Routing"
tags: ["inference", "kv-cache", "disaggregation", "routing", "vllm", "llm-d"]
sources:
  - "vLLM documentation, 'Disaggregated Prefilling' (docs.vllm.ai; labelled experimental; fetched October 2026)"
  - "llm-d project blog, 'KV-Cache Wins You Can See' (llm-d.ai; fetched October 2026)"
  - "Zhong et al., 'DistServe: Disaggregating Prefill and Decoding for Goodput-optimized LLM Serving' (OSDI 2024)"
---

## Two phases with different bottlenecks

Generating a response has two phases that stress hardware differently.

- **Prefill** processes the whole prompt in parallel to build the **KV cache** (the attention keys and values for every prompt token) and produce the first token. It is **compute-bound**: lots of arithmetic on big matrices. Its duration sets time-to-first-token (TTFT).
- **Decode** produces one token at a time, reading the weights and the growing KV cache each step. It is **memory-bandwidth-bound**. Its pace sets inter-token latency (ITL).

When both run on the same GPU, a long prefill can stall decoding for every other request on that GPU, producing latency spikes (tail latency) that users notice as stutter. Batching decisions that help one phase hurt the other.

## Disaggregation: separate the phases

**Prefill/decode disaggregation** runs prefill on one set of instances and decode on another, transferring the KV cache between them. Each pool can use its own parallelism and batch sizes, and can be sized independently. The vLLM documentation, which labels the feature experimental, is precise about the benefit: it lets you tune TTFT and ITL independently and stops prefill jobs from interrupting decode (controlling tail latency), but **it does not improve throughput**. The cost is the KV-cache transfer (over fast interconnects) and operational complexity.

Rule of thumb: consider it when long prompts and long generations share a fleet and your problem is **tail latency under an SLO**, not raw tokens per second. For short prompts and uniform traffic, a colocated deployment with chunked prefill is simpler and often as good.

## Prefix caching and why routing matters

If many requests share a prefix (a system prompt, tool definitions, a long document, an agent's earlier turns), the KV cache for that prefix can be **reused** instead of recomputed. Each instance keeps its own cache, so *which instance receives the request* decides whether the cache is hit. A load-balancer that ignores caches sends a repeat conversation to a random replica and recomputes everything.

**KV-cache-aware routing** tracks which instance holds which prefix blocks and sends requests where the most prefix is already cached, balanced against load. The llm-d project (a CNCF Sandbox project built on vLLM) publishes a benchmark on 8 H100 GPUs serving a 32B model to a simulated 150-customer workload with 6,000-token shared contexts. Precise prefix-aware routing gave a p90 time-to-first-token of about **0.54 s**, versus about 31 s for approximate cache-aware routing and 92 to 95 s for load-only or random routing, and roughly **double the throughput** (about 8,730 versus 4,429 tokens per second). That is one workload shape on one cluster; the direction (cache-blind routing wastes GPUs on repeated prefill) generalises, the magnitudes do not.

## Worked example

A coding assistant sends a 20,000-token repository context plus a short question, many times per hour per developer.

- **Cache-blind:** each request lands on a random replica. Prefill of 20,000 tokens at about 8,000 tokens per second takes 2.5 s per request, and the GPU spends most of its time redoing identical work.
- **Cache-aware:** the router sends the developer's requests to the replica holding that prefix. Only the new 200 tokens are prefilled (about 25 ms). Time-to-first-token drops from about 2.6 s to about 0.1 s, and the same fleet serves several times more developers.
- **Add disaggregation** only if long fresh prompts (such as a newly opened large repository) still cause stutter for other users' decoding.

## Design considerations

- **Session affinity vs balance**: pure stickiness creates hot replicas; good routers score cache overlap and queue depth together.
- **Cache capacity and eviction**: caches live in GPU memory (and increasingly spill to CPU or SSD tiers); evictions reduce hit rates, so size memory for the working set of active prefixes.
- **Prompt layout matters**: keep stable content first and variable content last, or hits vanish.
- **Observability**: track cache hit rate, TTFT and ITL percentiles, queue depth, and transfer time between pools.
- **Isolation**: a shared prefix cache is a side channel in multi-tenant settings; scope cache keys by tenant where confidentiality requires it.

## Common mistakes

- **Assuming disaggregation raises throughput.** It targets latency control.
- **Round-robin load balancing** in front of cache-heavy workloads.
- **Putting timestamps or user ids at the top of prompts**, defeating prefix reuse.
- **Optimising mean latency** when the SLO is on p99.
- **Ignoring interconnect bandwidth** for KV transfer between pools.
