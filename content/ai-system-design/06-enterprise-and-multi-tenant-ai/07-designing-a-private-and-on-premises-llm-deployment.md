---
title: "Designing a Private and On-Premises LLM Deployment"
short_title: "Private and On-Prem LLM Deployment"
tags: ["on-premises", "private-cloud", "air-gapped", "open-weight", "gpu", "design"]
sources:
  - "Public documentation of open-weight model licences and self-hosted serving frameworks"
  - "NVIDIA and cloud-provider documentation on GPU cluster design and confidential computing"
  - "NIST SP 800-53 security and privacy controls (overview)"
  - "Open-weight model landscape and licence summaries, 2026 (secondary: digitalapplied.com, lushbinary.com, hidekazu-konishi.com)"
  - "NVIDIA NIM for LLMs documentation, air-gap deployment, docs.nvidia.com/nim (via search results, October 2026)"
---

## The problem

Banks, hospitals, governments and defence contractors often cannot send data to an external model API: regulation, contracts, sovereignty or sheer risk appetite require models to run **inside their own boundary**, sometimes with no internet at all (air-gapped). A private deployment gives control over data, location and availability, but moves the burden of **hardware, operations, model quality and updates** onto the organisation.

## Step 1: Requirements and constraints

- **Boundary:** on-premises data centre, private cloud or VPC, sovereign cloud region, or fully air-gapped.
- **Data classification:** what data the models may see, and what must never leave.
- **Capability needs:** model quality required, context length, modalities, languages.
- **Scale:** concurrent users, throughput, latency targets.
- **Compliance:** certifications and controls required, audit evidence.
- **Operational reality:** the team, skills and on-call capacity available; hardware lead times.

## Step 2: Model selection

Open-weight models are the usual choice. Evaluate on **your tasks**: general capability, domain performance, tool use and structured output, context length, multilingual quality, licence terms (commercial use, redistribution, acceptable-use clauses) and the size that fits your hardware. Smaller or quantized models often meet narrow needs at far lower cost; consider a **portfolio**: a larger model for hard tasks, a small one for routing and classification, embedding and reranking models for retrieval. Plan for periodic **model updates**, which in an air-gapped site means a controlled import process with scanning and evaluation.

## Step 3: Hardware and cluster design

- **GPU sizing:** from required throughput and latency, using measured benchmarks of the chosen model and serving engine, plus headroom and redundancy.
- **Memory fit:** weights plus KV cache; tensor parallelism across GPUs within a node needs high-bandwidth interconnect.
- **Nodes and network:** high-speed fabric for multi-node training or serving, separate management and storage networks.
- **Storage:** fast local NVMe for model weights to cut load times; shared storage for artifacts and indexes.
- **CPU and memory** for retrieval, preprocessing and the application tier.
- **Power, cooling and lead time:** GPU servers are dense and arrive on long lead times; plan the facility.
- **Heterogeneous fleet:** different GPU types for embeddings, small models and large models.

## Step 4: Software platform

Run an inference platform inside the boundary: a serving engine with continuous batching and paged KV cache, an internal OpenAI-compatible API, a gateway for authentication, quotas and logging, and a scheduler (often Kubernetes with GPU operators). Include the rest of the stack locally: vector database, document ingestion, evaluation tools, observability and guardrails. Everything must function **without external calls**: package mirrors, container registries, model hubs and update mechanisms all hosted internally.

## Step 5: Security architecture

- **Zero-trust inside the boundary:** every service authenticates; least-privilege access to models, indexes and data.
- **Network segmentation:** inference, data and application zones, with controlled paths between them; no direct internet egress.
- **Data protection:** encryption at rest and in transit, key management with hardware security modules, per-tenant keys where required.
- **Confidential computing** options (hardware-isolated environments) for workloads with strict isolation needs.
- **Supply-chain controls** for models and packages: checksums, signatures, malware scanning, an approval process for imports.
- **Auditing:** immutable logs of access and usage, within retention policy.
- **Same AI threats apply:** prompt injection, excessive agency and leakage still need guardrails inside.

## Step 6: Operations

Staff for GPU operations: driver and firmware management, node failures, thermal issues, capacity planning and model lifecycle. Provide autoscaling inside a fixed fleet (scheduling, quotas, priority classes, preemption) because you cannot burst to the cloud. Implement observability for GPU utilisation, queue depth and latency, plus quality monitoring on real traffic. Prepare for hardware failure with spares, redundancy and a degraded mode (smaller model) rather than an outage. Plan upgrades with blue-green cluster changes.

## Step 7: Hybrid strategies

Often the best answer is **tiered**: sensitive workloads run privately while non-sensitive ones use hosted APIs, routed by data classification at the gateway. A private cluster can also burst to a sovereign or dedicated cloud region for non-sensitive overflow. Keep applications behind the same internal API so workloads can move as policy and economics change.

## Step 8: Cost and ROI

Account for hardware or reserved capacity, facility, networking, staff, software licences, power and refresh cycles, versus API alternatives at expected volume. Utilisation drives cost per token: a half-idle cluster is expensive. Quantify the value of control, such as access to regulated use cases that would otherwise be impossible.

## A worked example

**Scenario:** a regional bank needs an internal assistant over confidential documents with no data leaving its data centre.

1. Requirements: 3,000 users, peak 60 concurrent requests, answers within 6 seconds, all data on premises, audit logs retained for 7 years.
2. Models: after evaluation on 400 bank-specific questions, a 70B-class open-weight model (quantized to 8-bit) meets the quality bar; a small 8B model handles routing and classification; a separate embedding model and reranker serve retrieval.
3. Hardware: two 8-GPU nodes for the large model (tensor parallel within a node, one active plus one for redundancy), one smaller node for the small models and retrieval; local NVMe holds weights for fast restarts.
4. Platform: Kubernetes with an inference engine, an internal gateway with SSO and quotas, an on-prem vector database, and ingestion from the document system with permission preservation; no internet egress, with an internal registry and mirrors.
5. Updates: a quarterly process imports new model versions through a scanned staging zone, runs the evaluation suite, then canaries to 5 percent of users before promotion.

## Enterprise practice (verified October 2026)

**Basics.** Choose a model, size GPUs, serve with an inference engine, put a gateway and access control in front, and plan updates (steps above).

**Model and licence landscape (secondary summaries, 2026; read each licence).** Open-weight options now include Google Gemma 4, Alibaba Qwen 3.x, Mistral Small 4 and Large 3, Zhipu GLM-5, DeepSeek V4, OpenAI's gpt-oss and Meta Llama 4. Reported licences: Apache 2.0 or MIT for Gemma 4, gpt-oss, GLM-5, Qwen and Mistral Small 4; **Llama 4 uses Meta's community licence with a 700 million monthly-active-user threshold** and acceptable-use terms, so legal review matters. "Open weights" is not "open source": check redistribution, fine-tuning and field-of-use clauses, and EU restrictions on some multimodal models.

**Serving and air-gap.** vLLM (no licence cost) and NVIDIA NIM (a supported container) both expose an OpenAI-compatible API. NVIDIA's documentation describes **air-gapped deployment**: pre-stage model assets into an offline cache while connected, transfer them by archive or media, and run the container with no outbound network or API keys.

**Enterprise pattern.** Decide on evidence, not principle: run your evaluation set on the best open model and on the hosted model, and compare quality, latency and total cost including GPUs, staff and refresh cycles. Treat the model as a supply-chain artefact (verify hashes, pin versions, scan weights and containers), plan a quarterly model-refresh process with regression evaluation, keep the same gateway, guardrail and logging layers as in the cloud design, and design for patching and capacity without internet access.

## Common mistakes

- **Underestimating hardware lead times** and operational effort.
- **Choosing a model by leaderboard** instead of testing on your tasks.
- **Ignoring the update path** in air-gapped sites.
- **Weaker internal security** because "it is inside the firewall".
- **Low utilisation**, making cost per token worse than the API.
