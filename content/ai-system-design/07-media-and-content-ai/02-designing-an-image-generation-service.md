---
title: "Designing an Image Generation Service"
short_title: "Image Generation Service"
tags: ["image-generation", "diffusion", "gpu", "queues", "safety", "design"]
sources:
  - "Ho, Jain and Abbeel, 'Denoising Diffusion Probabilistic Models' (2020)"
  - "Rombach et al., 'High-Resolution Image Synthesis with Latent Diffusion Models' (2022)"
  - "Public documentation on content provenance standards for AI-generated media"
  - "C2PA Content Credentials specification v2.3 (December 2025), via secondary summaries"
  - "European Commission, Code of Practice on marking and labelling of AI-generated content (final, 10 June 2026), via secondary summaries"
  - "EU AI Omnibus summary, Gibson Dunn (Article 50 dates; fetched Oct 2026)"
---

## The problem

Users type a prompt and expect an image in seconds. Unlike a chat reply, an image generation call is **heavy, slow and bursty**: a single image can occupy a GPU for several seconds, demand spikes around launches, and the output must be safe, attributable and storable. The service is a queue-driven GPU pipeline with safety checks on both ends.

## Step 1: Requirements

- **Functional:** text-to-image, image-to-image, inpainting and variations; sizes and styles; seed control; history and gallery.
- **Latency:** a result within 5 to 15 seconds, with visible progress.
- **Throughput:** thousands of images per minute at peak, with fair sharing among users and tiers.
- **Safety:** block disallowed prompts and outputs; honour copyright and likeness policies; label generated content.
- **Cost:** GPU time dominates, so utilisation matters.
- **Scale (example):** 3 million images a day, peak 150 per second.

## Step 2: Architecture

- **API and gateway:** authentication, quotas, validation, idempotent job submission.
- **Prompt safety service:** checks the prompt before any GPU time is spent.
- **Job queue:** durable, prioritised by plan and interactivity, with per-user fairness.
- **GPU worker pool:** workers load models and run the generation loop.
- **Output pipeline:** image safety check, post-processing (upscale, format), metadata and provenance, storage.
- **Delivery:** results in object storage behind a CDN; a notification or poll channel tells the client.

Generation is **asynchronous**: submit returns a job id immediately; the client streams status or polls, since a held-open HTTP request for 10 seconds scales badly.

## Step 3: GPU worker efficiency

- **Model residency:** loading a multi-gigabyte model takes far longer than a generation, so workers keep models loaded; route jobs for the same model and settings to the same workers.
- **Batching:** group compatible requests (same model and resolution) into one forward pass to raise throughput; wait a few tens of milliseconds to fill batches, balancing latency.
- **Fewer steps:** use samplers and distilled models that need fewer denoising steps for common tiers; offer quality modes.
- **Resolution strategy:** generate at a base resolution then upscale, cheaper than generating large directly.
- **Memory management:** optimised attention, half precision and offloading let larger batches fit.
- **Scheduling:** mix interactive and bulk jobs; bulk fills idle capacity at lower priority.

## Step 4: Queueing, fairness and backpressure

Under load queues grow, so design explicit behaviour: per-user concurrency limits, weighted fair queues by tier, estimated wait times shown to users, and **load shedding** with clear messages when the queue exceeds a bound rather than letting waits grow without limit. Make submission idempotent so client retries do not double-charge. Autoscale workers on queue depth with warm pools, since GPU start-up is slow.

## Step 5: Safety

Layered checks:

- **Prompt filtering** (policy classifiers, blocklists for people and brands where required) before generation.
- **Output classification:** an image classifier screens results for disallowed content before the user sees them; blocked outputs are replaced with a message and logged.
- **Prompt rewriting** that adds safety constraints or removes risky details.
- **Provenance:** embed signed metadata or invisible watermarks identifying content as AI-generated, following industry standards, and keep records linking images to jobs.
- **Abuse monitoring:** rate limits, anomaly detection for bulk generation, reports and takedown flows.
- Respect training-data and likeness policies in prompt handling and appeals.

## Step 6: Storage and delivery

Store originals in object storage with lifecycle rules, generate thumbnails and web formats on write, serve through a CDN with signed URLs for private images. Keep prompts and parameters as metadata for reproducibility (seed, model version, steps), subject to privacy policy and retention. Deduplicate identical requests where seeds and settings match.

## Step 7: Observability and cost

Track queue wait, generation time per step count, GPU utilisation, batch sizes, failure rate (out-of-memory, safety blocks), and cost per image by tier. Alert on queue age, not just depth. Use per-model dashboards to decide when to retire older models or promote a cheaper distilled model.

## A worked example

**Scenario:** a marketing user submits "a red bicycle on a beach at sunset, photo style" for four variations.

1. The API validates and enqueues one job with a client-supplied idempotency key, returns a job id, and the UI shows "queued, about 6 seconds".
2. The prompt safety service approves it. The scheduler groups the four variations into one batch on a worker with the photo model already loaded.
3. After 25 denoising steps (about 4 seconds) the images are produced at base resolution and upscaled.
4. The output classifier passes all four; provenance metadata is embedded; files go to storage; the CDN URLs are pushed to the client over a stream.
5. A second user, queued behind a bulk job, is served first because interactive requests have priority; the bulk job finishes later using idle GPUs.

## Enterprise practice (verified October 2026)

**Basics.** Prompt filtering, generation, output safety checks, delivery through a CDN (steps above).

**Provenance is now a compliance feature.** EU AI Act **Article 50** transparency duties apply from **2 August 2026**, with a watermarking grace period for **existing systems until 2 December 2026** (per the Omnibus). Secondary sources report that the Commission's final Code of Practice on marking and labelling (10 June 2026) points to a **multi-layer approach**: cryptographically signed metadata (**C2PA Content Credentials**, spec v2.3 as of December 2025) together with imperceptible watermarking. Reports say major providers (OpenAI, Google, ElevenLabs) ship provenance by default while at least one popular image generator does not. Metadata can be stripped by re-encoding, which is why the watermark layer exists; neither survives every edit, so detection stays probabilistic.

**Also new in the EU:** the Omnibus adds an Article 5 prohibition on AI systems generating **non-consensual intimate imagery and child sexual abuse material** (transitional period to 2 December 2026), so prompt and output classifiers for these categories are a legal requirement, not a policy choice.

**Enterprise pattern.** Sign every generated asset at the egress point (one service, one key hierarchy in an HSM or KMS), embed an invisible watermark, store a provenance record keyed by asset hash for later verification, expose a verification endpoint, and log safety-classifier decisions for audit.

## Common mistakes

- **Synchronous requests** held open for the whole generation.
- **Reloading models** per request instead of keeping workers warm and routed by model.
- **Safety checks only on prompts**, ignoring harmful outputs.
- **No fairness or load shedding**, so one user or launch ruins everyone's wait.
- **No provenance or audit trail** for generated content.
