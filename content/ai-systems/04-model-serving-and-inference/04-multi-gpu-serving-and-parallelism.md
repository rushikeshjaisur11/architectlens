---
title: "Multi-GPU Serving: Tensor, Pipeline, and Data Parallelism"
short_title: "Multi-GPU Serving and Parallelism"
tags: ["inference", "serving", "parallelism", "gpu"]
sources:
  - "NVIDIA documentation on tensor parallelism and TensorRT-LLM multi-GPU serving"
  - "Shoeybi et al., 'Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism' (2019)"
---

## Why a single GPU eventually stops being enough

This track's inference-serving-fundamentals lesson covered optimizing inference on a single GPU (batching, KV caching). Beyond a certain model size, a single GPU's memory can't even hold the full model's weights, let alone the KV cache for concurrent requests — a genuinely different problem than optimizing throughput on hardware that already fits the model. Serving such a model requires splitting it across multiple GPUs, and the specific way you split it (parallelism strategy) has real, different tradeoffs for latency, throughput, and inter-GPU communication cost.

## Tensor parallelism: splitting individual layers across GPUs

**Tensor parallelism** splits individual weight matrices within each layer across multiple GPUs — a single matrix multiplication that would normally run on one GPU is divided so each GPU computes a portion of it, with results combined (via inter-GPU communication) before proceeding to the next layer. This lets a model too large for one GPU's memory fit across several, with every GPU actively participating in computing every layer's output.

The cost: this requires frequent, fast communication between GPUs at every layer boundary (to combine each GPU's partial results before the next layer can proceed), which means tensor parallelism generally needs very high-bandwidth interconnects between GPUs (like NVLink, connecting GPUs within the same physical server) to avoid the communication overhead dominating and erasing the benefit of parallelizing in the first place — tensor parallelism across GPUs on physically separate machines, connected only by standard networking, typically performs poorly due to this communication requirement.

## Pipeline parallelism: splitting the model's layers across GPUs

**Pipeline parallelism** takes a different split: instead of dividing individual layers, different GPUs are assigned different, sequential ranges of the model's layers (GPU 1 handles layers 1-10, GPU 2 handles layers 11-20, and so on), with each GPU passing its output to the next in the pipeline. This requires much less frequent inter-GPU communication than tensor parallelism (only at the boundary between each GPU's assigned layer range, not within every layer), making it more tolerant of lower-bandwidth connections between GPUs, including GPUs on different physical machines.

The cost: naive pipeline parallelism can leave GPUs idle waiting for their turn in the pipeline (a "pipeline bubble" — GPU 2 has nothing to do until GPU 1 finishes processing the current input's early layers), reducing effective utilization unless techniques like micro-batching (splitting a batch into smaller pieces that flow through the pipeline with some overlap, keeping more GPUs busy simultaneously) are used to fill these idle gaps.

## Data parallelism: replicating the whole model, splitting the requests

**Data parallelism** (most relevant for serving, distinct from tensor/pipeline parallelism's role in fitting one very large model) replicates the *entire* model across multiple GPUs (or multiple groups of GPUs, if the model itself needs tensor/pipeline parallelism to fit), with different incoming requests routed to different replicas — this is really an application of the load-balancing pattern from this track's system-design counterpart lesson, applied at the model-replica level rather than splitting any individual model's computation. This is the right lever specifically for scaling *throughput* (serving more concurrent requests) once the model already fits and runs efficiently on a given GPU allocation — it doesn't help a model that's too large to fit on that allocation in the first place, which is what tensor and pipeline parallelism exist to solve.

## Combining strategies for large-scale serving

Real large-model serving deployments often combine all three: tensor parallelism to split a very large model across the GPUs within one physical server (leveraging that server's fast NVLink interconnect), pipeline parallelism to span multiple servers if the model is too large even for one server's full tensor-parallel GPU group, and data parallelism to replicate that entire tensor+pipeline-parallel group multiple times for throughput scaling across incoming request volume — each layer of parallelism addressing a genuinely different constraint (fitting the model, spanning physical hardware boundaries, and scaling request throughput, respectively), rather than being alternative solutions to the same problem.

## A worked example

**Scenario:** serving a very large language model that doesn't fit on a single GPU's memory, needing to handle high concurrent request volume across a multi-server GPU cluster.

- **Tensor parallelism across the GPUs within each physical server** (say, 8 GPUs connected via NVLink) splits the model's layers to fit within that server's combined GPU memory, taking advantage of NVLink's high bandwidth to keep the frequent inter-GPU communication tensor parallelism requires from becoming a bottleneck.
- **If the model is still too large even for one 8-GPU server's combined memory**, pipeline parallelism spans multiple such servers, each server handling a range of the model's layers — using pipeline parallelism specifically because the between-server connection has meaningfully lower bandwidth than NVLink, and pipeline parallelism's lower communication frequency tolerates that better than tensor parallelism would.
- **Data parallelism replicates this entire tensor+pipeline-parallel unit** across multiple such GPU groups, with a load balancer (per this track's system-design load-balancing lesson) distributing incoming requests across replicas — directly scaling throughput to match request volume, independent of the model-fitting problem the other two parallelism strategies already solved.

## Common mistakes

- **Using tensor parallelism across GPUs connected only by standard networking (not NVLink or similar high-bandwidth interconnect)**, resulting in communication overhead that can erase or even reverse the expected benefit of parallelizing — tensor parallelism's frequent communication requirement makes interconnect bandwidth a hard constraint, not a minor performance detail.
- **Using data parallelism alone for a model that doesn't fit on a single GPU**, which doesn't work at all — data parallelism replicates a model that already fits; it doesn't help split a model that doesn't, which is a category error in reaching for the wrong parallelism strategy for the actual constraint being faced.
- **Ignoring pipeline bubbles in a naive pipeline-parallel setup**, leaving real GPU capacity idle and underutilized — micro-batching or similar scheduling techniques are needed to actually realize pipeline parallelism's throughput potential, not just its memory-fitting benefit.
