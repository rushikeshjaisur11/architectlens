---
title: "Designing an LLM Inference Platform"
short_title: "LLM Inference Platform"
tags: ["inference", "gpu", "serving", "autoscaling", "platform", "design"]
sources:
  - "Kwon et al., 'Efficient Memory Management for Large Language Model Serving with PagedAttention' (2023)"
  - "Yu et al., 'Orca: A Distributed Serving System for Transformer-Based Generative Models' (OSDI 2022)"
  - "Public documentation of open-source LLM serving frameworks and GPU orchestration systems"
---

## The problem

An organisation hosts its own models (open-weight or fine-tuned) for cost, privacy or latency reasons and wants every team to consume them like a managed API. The platform must turn expensive, scarce GPUs into a **reliable, efficient, multi-tenant service**: high utilisation, predictable latency, fast model rollout and sensible scaling. GPU time is the dominant cost, so efficiency is the design goal.

## Step 1: Requirements

- **API:** a chat and completions interface compatible with common clients, streaming, tool calling, structured output.
- **Models:** many models and fine-tuned adapters, versioned, with fast load and rollback.
- **Performance targets:** time to first token under about 500 ms and steady decode speed, at stated concurrency.
- **Efficiency:** keep GPUs busy; pay for what is used.
- **Multi-tenancy:** quotas, priorities, isolation between teams.
- **Scale (example):** 40 GPU nodes, 5,000 concurrent streams, a dozen models.

## Step 2: Architecture

- **Gateway / router:** authentication, quotas, request validation, model selection, and routing to a replica.
- **Model replicas:** inference servers running a serving engine on one or more GPUs, loaded with a model.
- **Scheduler / autoscaler:** decides how many replicas of each model run and where.
- **Model registry and artifact store:** versioned weights, configs and adapters.
- **Observability:** per-request and per-GPU metrics, traces, cost attribution.

The serving **engine** does the heavy lifting inside each replica; the platform decides which requests reach which replica and how many replicas exist.

## Step 3: What makes a replica efficient

- **Continuous batching:** new requests join the running batch at each decoding step instead of waiting for a whole batch to finish, keeping the GPU busy.
- **Paged KV cache:** the attention cache is stored in fixed-size blocks allocated on demand, avoiding wasted reserved memory and allowing many more concurrent sequences.
- **Prefix caching:** share the computed state of common prompt prefixes (system prompts) across requests.
- **Quantization:** serve weights in 8-bit or 4-bit to fit larger models or more batch on a GPU, validated against quality evaluations.
- **Parallelism:** tensor parallelism splits a model across GPUs within a node for models too big for one GPU; replicas scale throughput.
- **Speculative decoding:** a small draft model proposes tokens verified by the large one, cutting latency.

## Step 4: Routing and scheduling

Routing quality affects cost and latency:

- **Load-aware routing:** send to the replica with the most free capacity (running sequences, KV-cache usage), not round robin.
- **Cache-aware routing:** route requests sharing a prefix to the same replica to maximise prefix-cache hits.
- **Priority classes:** interactive requests preempt or are served before batch work; batch jobs fill idle capacity.
- **Admission control and queueing:** when overloaded, queue with limits and reject with a clear retry hint rather than letting latency collapse.
- **Disaggregation (advanced):** separate **prefill** (compute-bound) and **decode** (memory-bound) onto different pools to tune each independently.

## Step 5: Autoscaling GPUs

GPU autoscaling is hard because **cold starts are slow**: pulling many gigabytes of weights and loading them can take minutes. Mitigations: keep model weights cached on local NVMe, use fast loading formats, keep a **warm pool** of pre-loaded replicas, and scale on leading indicators (queue depth, tokens in flight, KV-cache pressure) rather than lagging GPU utilisation. Scale to zero only for rarely used models where the cold start is acceptable. Bin-pack small models onto shared GPUs and place large ones with the right interconnect.

## Step 6: Model lifecycle

New versions roll out with **canary** traffic and quality checks using the evaluation platform; adapters (LoRA) load on top of a shared base model so many fine-tunes share GPUs. Keep the previous version loaded or loadable for instant rollback. Version the whole serving configuration (engine version, quantization, parameters), since changes there alter outputs.

## Step 7: Reliability and cost

Handle GPU failures (node loss, memory errors) with health checks and automatic replacement; retry idempotent requests on another replica, and surface mid-stream failures clearly. Track **cost per million tokens**, GPU utilisation, tokens per second per GPU and goodput (requests meeting their latency target). Use spot or preemptible capacity for batch and keep reserved capacity for interactive load.

## A worked example

**Scenario:** the platform serves a 70B chat model and a small 8B model during a traffic spike.

1. The router sees the 70B pool's KV-cache utilisation hit 85 percent and its queue grow. The autoscaler, watching tokens in flight, starts two more replicas from the warm pool; they are serving within 40 seconds.
2. Requests with the long shared system prompt are routed to the same replica, lifting its prefix-cache hit rate to 70 percent and cutting time to first token.
3. A batch summarisation job submitted at low priority is paused briefly so interactive latency holds, then resumes as the spike passes.
4. A node reports GPU memory errors; health checks drain it, in-flight streams on it fail with a retryable error, and a replacement replica loads in the background.
5. After the spike the platform scales back down, and the cost dashboard shows tokens per GPU-hour for the day.

## Common mistakes

- **Static batching and fixed memory reservations**, wasting GPUs.
- **Round-robin routing**, ignoring load and prefix reuse.
- **Autoscaling on GPU utilisation alone**, reacting too late for slow cold starts.
- **No admission control**, so overload turns into minute-long latencies.
- **Changing quantization or engine versions** without re-running quality evaluations.
