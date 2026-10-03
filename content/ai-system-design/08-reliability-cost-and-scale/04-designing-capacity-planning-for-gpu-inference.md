---
title: "Designing Capacity Planning for GPU Inference"
short_title: "Capacity Planning for GPU Inference"
tags: ["capacity-planning", "gpu", "inference", "forecasting", "sizing", "design"]
sources:
  - "Public documentation of LLM serving benchmarks and GPU specifications"
  - "Pope et al., 'Efficiently Scaling Transformer Inference' (2022)"
  - "Google SRE Workbook, chapters on capacity and demand forecasting"
  - "GPU rental price trackers, September to October 2026 (secondary: getdeploying.com, spheron.network, dev.to/fastgpu)"
  - "llm-d project blog (KV-cache hit rate and throughput, fetched Oct 2026)"
---

## The problem

GPUs are expensive, scarce and slow to procure. Too little capacity means queues, timeouts and unhappy users; too much burns money. LLM serving makes planning harder than for classic services: throughput depends on model size, **prompt and output lengths**, batching, quantization and latency targets, and traffic is bursty. **Capacity planning** turns product forecasts into a defensible number of GPUs, with headroom, a procurement timeline and a plan for when forecasts are wrong.

## Step 1: Define the workload and the target

State the service levels first, since capacity depends on the promise:

- **Latency targets:** time to first token (TTFT) and inter-token latency (decode speed), at a percentile such as p95.
- **Traffic profile:** requests per second over the day and week, peak-to-average ratio, growth.
- **Request shape:** distribution of input tokens and output tokens (not just averages; the long tail drives memory), share of cache-hit prefixes.
- **Models and variants:** sizes, quantization, context lengths, adapters.
- **Priorities:** interactive versus batch share.

## Step 2: Understand what limits a GPU

Inference has two phases with different bottlenecks:

- **Prefill** (processing the prompt) is compute-bound; cost scales with input tokens.
- **Decode** (generating tokens one at a time) is **memory-bandwidth-bound**: each step reads the model weights and the KV cache; batching amortises weight reads, which is why concurrency lifts throughput.
- **Memory capacity** limits how many sequences fit: weights plus KV cache for all in-flight requests. KV cache size grows with context length and batch size; this often caps concurrency before compute does.

So capacity is rarely "FLOPs divided by demand"; it is governed by memory, batching efficiency and latency constraints.

## Step 3: Measure, don't guess

Benchmark your actual model, serving engine and hardware with a load generator replaying a realistic distribution of prompt and output lengths. Sweep concurrency and record **goodput**: requests per second that meet the latency targets (not raw throughput). Plot the curve of throughput versus latency; the usable operating point is where p95 latency still meets targets, which is lower than the maximum throughput. Re-run after changing the engine, quantization or hardware, as results shift substantially.

## Step 4: From benchmark to fleet size

A worked method:

1. From benchmarks, get **sustainable requests per second per replica** at your target latency (or tokens per second per replica).
2. Convert forecast traffic to the same units: peak requests per second, or peak tokens per second (requests times average tokens), per model.
3. Divide peak demand by per-replica capacity, then add **headroom** for burst, failures and deployments.
4. Account for **N+1 or N+2 redundancy**, so losing a node does not break the SLO.
5. Account for **cold start and scaling lag**: if a new replica takes five minutes to become useful, headroom or a warm pool must cover growth within that window.
6. Add a separate allocation for **batch** work that can use leftover capacity.

Then express the result in GPUs, nodes (considering interconnect for tensor parallelism), power and cost.

## Step 5: Forecasting demand

Combine drivers rather than extrapolating the past: users times requests per user times tokens per request. Consider product launches, seasonality, new features that raise tokens per request (agents, longer contexts) and model changes that alter cost per token. Express forecasts as ranges (low, expected, high) and plan capacity for expected with a defined response to the high case. Track forecast error and revise.

## Step 6: Efficiency levers that change the plan

Capacity needs can fall dramatically through engineering: quantization, prefix caching, speculative decoding, better batching, routing small models for easy requests, shortening prompts and outputs, and disaggregating prefill and decode. Estimate each lever's effect with benchmarks and include them in scenarios: "with prefix caching at 60 percent hits we need 30 percent fewer GPUs." Track utilisation targets; sustained utilisation below about 40 percent signals overprovisioning, while above about 80 percent leaves little room for spikes.

## Step 7: Procurement, scaling and risk

- **Mix of commitments:** reserved or committed capacity for the baseline, on-demand for the spikes, spot for batch.
- **Lead times:** GPUs can take weeks or months to obtain; plan quarters ahead and keep relationships with multiple providers or regions.
- **Fallback capacity:** a provider API as overflow when your fleet saturates.
- **Autoscaling policy:** scale on leading indicators (queue depth, tokens in flight, KV-cache pressure), with warm pools to hide start-up time.
- **Failure scenarios:** node loss, a bad model rollout doubling memory use, a traffic spike.
- **Regular reviews:** monthly utilisation, cost per million tokens, and plan versus actual.

## A worked example

**Scenario:** a chat product forecasts 400 requests per second at peak next quarter on a 70B model with 800 average input tokens and 250 output tokens, targeting TTFT under 1 second and 30 tokens per second per user at p95.

1. Benchmarks on 8-GPU nodes (tensor parallel) with quantization show a node sustains about 45 requests per second inside the targets, limited by KV-cache memory at 60 concurrent sequences.
2. Peak demand of 400 divided by 45 gives 9 nodes. Adding 25 percent headroom for burst and deployments gives 11; N+1 redundancy for node failure brings it to 12 nodes (96 GPUs).
3. Enabling prefix caching (measured 55 percent hit rate on the shared system prompt) raises per-node capacity to 58 requests per second in a second benchmark, reducing the plan to 9 nodes with the same headroom.
4. The team procures 7 committed nodes, plans 2 on-demand for spikes, and contracts a provider API as overflow for traffic above 90 percent fleet utilisation.
5. A warm pool of 1 node plus scaling on queue depth covers the five-minute start-up; the plan is revisited monthly against actual traffic, and a "high" scenario of 600 requests per second has a documented trigger to order more nodes.

## Enterprise practice (verified October 2026)

**Basics.** Capacity = peak tokens per second needed / tokens per second per GPU, plus headroom (steps above).

**Price anchors (third-party trackers, September 2026; rates move monthly).** On-demand **H100** rentals cluster around a **median near $3 per GPU-hour** (about $1.5 on marketplaces to about $7 at hyperscalers), down from above $7 in early 2024. **B200** is reported around **$4 to $6.4 per GPU-hour** on specialist clouds and higher on hyperscaler capacity blocks; **GB200** around **$8 to $19**. Interruptible spot capacity is far cheaper (H100 from about $1). A B200 is reported at roughly 2.5x H100 training throughput, so a higher hourly price can still be cheaper per result; measure inference throughput on **your** model and context length before assuming that.

**Planning rules that survive price changes.**

- **Plan on tokens, not requests.** Separate prefill tokens (compute-bound) from decode tokens (memory-bandwidth-bound); disaggregated serving pools size each independently.
- **Cache hit rate moves capacity.** In llm-d's benchmark, precise prefix-aware routing roughly doubled throughput on identical GPUs, so a routing change can substitute for hardware.
- **Reserve versus burst.** Reserve (or commit) for the steady floor, use spot or on-demand for the peak, and keep a provider-API fallback for spikes beyond your pool.
- **Headroom and drain.** Keep 20 to 30 percent headroom, and test GPU-node failure and rolling model updates, because model load takes minutes.

## Common mistakes

- **Planning from average lengths** and ignoring the long tail and KV-cache memory.
- **Using maximum throughput** instead of goodput at the latency target.
- **No headroom for failures and deployments.**
- **Forgetting lead times and cold starts.**
- **A single forecast**, with no response plan when demand is higher or lower.
