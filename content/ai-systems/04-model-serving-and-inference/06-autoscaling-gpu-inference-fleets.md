---
title: "Autoscaling GPU Inference Fleets and Cold-Start Mitigation"
short_title: "Autoscaling GPU Fleets"
tags: ["autoscaling", "gpu", "inference", "cold-start", "kubernetes", "model-serving"]
sources:
  - "KServe / Knative autoscaling documentation"
  - "AWS SageMaker Inference autoscaling and multi-model endpoints documentation"
  - "Ray Serve autoscaling documentation (docs.ray.io)"
  - "Hugging Face Text Generation Inference (TGI) deployment docs"
---

## Why GPU autoscaling is harder than CPU autoscaling

Standard HTTP autoscaling (CPU utilization, request count per pod) assumes new replicas come up in seconds. GPU inference breaks that assumption at every stage: provisioning a GPU instance can take minutes if capacity isn't already warm, container images for inference servers (CUDA, cuDNN, framework runtime) are often multi-gigabyte pulls, and the model weights themselves — tens to hundreds of gigabytes — must be loaded into GPU memory before the replica can serve a single request. A 70B model at FP16 is ~140GB; even from fast local NVMe, that load alone can take 30-90 seconds, and pulling from object storage over the network can take minutes. The result: naive reactive autoscaling (scale up after latency degrades) reacts too late — by the time a new replica is ready, the traffic spike that triggered it may already be over, and users experienced minutes of degraded latency in the meantime.

## Cold-start mitigation strategies

- **Keep a warm pool.** Maintain a minimum number of replicas above zero at all times, sized to absorb normal traffic variance, so scale-to-zero is reserved for genuinely idle low-traffic models. This trades idle GPU cost for eliminated cold-start latency — often the right trade given GPU-hour cost versus the cost of a bad p99.
- **Predictive/scheduled scaling.** If traffic has a known daily or weekly pattern (business hours, batch job windows), pre-scale ahead of the predictable ramp rather than reacting to it. This is cheaper to implement than true predictive autoscaling and covers a large fraction of real-world traffic shapes.
- **Snapshot or checkpoint the loaded model state.** Some serving stacks support snapshotting a GPU process after model load (e.g., CUDA checkpoint/restore approaches) so a "warm" replica can be restored from a snapshot far faster than a cold model load — this is an emerging technique, not yet universal, but directly attacks the dominant cold-start cost (weight loading).
- **Split image pull from model load.** Bake the inference server and CUDA stack into a small, cached base image, and stream model weights separately (from a fast object store or a co-located cache) so the two don't serialize — this alone can cut cold-start time substantially since image pull and weight load are otherwise sequential.
- **Over-provision briefly during known-risky windows** (a product launch, a marketing push) rather than relying purely on autoscaler reaction time; autoscaling is a cost optimization, not a substitute for capacity planning around known spikes.

## Scaling signals that actually work for LLM serving

CPU utilization is a poor signal for GPU inference — a GPU can be at high utilization while still having headroom in the request queue, or the bottleneck can be memory rather than compute. Better signals:

- **Queue depth / pending requests per replica** — directly measures whether a replica is falling behind, independent of what resource is the bottleneck.
- **Time-to-first-token and inter-token latency** — degradation here reflects real user-facing impact, and often degrades before naive utilization metrics do (e.g., under KV-cache memory pressure).
- **GPU memory utilization**, specifically KV-cache occupancy for continuous-batching servers (vLLM, TGI) — a replica can be "full" from a memory standpoint well before compute utilization looks saturated, and that's the more common bottleneck for long-context or high-concurrency workloads.

## Fleet-level tactics

- **Heterogeneous instance pools**: route latency-sensitive traffic to always-warm reserved instances, and burst or batch-tolerant traffic to spot/preemptible GPU capacity, which is materially cheaper but can be reclaimed with short notice.
- **Multi-model endpoints / model packing**: for many small or lightly-used models, packing several onto shared GPU capacity (rather than one dedicated replica per model) improves utilization, at the cost of needing swap-in/swap-out logic when a request arrives for a currently-unloaded model — which reintroduces a cold-start problem at the model level even with warm hardware.

## Common mistakes

- **Using request-count thresholds tuned for CPU services.** GPU replicas have wildly different capacity depending on model size, batch size, and sequence length; a fixed "requests per replica" threshold doesn't generalize the way it does for stateless CPU services.
- **Scaling to zero for latency-sensitive endpoints.** Scale-to-zero is attractive for cost but reintroduces the full cold-start penalty on the next request; reserve it for genuinely bursty, latency-tolerant workloads.
- **Ignoring KV-cache memory as a distinct scaling dimension.** A replica can be compute-idle but memory-full under continuous batching; scaling decisions that only look at compute utilization miss this and under-provision.
