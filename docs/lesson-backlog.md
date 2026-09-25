# Lesson Backlog — Full Concept Coverage

Every module currently has 3 lessons. Goal: expand each module to cover every core concept in its domain. List researched against 2026 system-design/AI-engineering curricula (see chat for sources). Work batch by batch — check off `[x]` as generated, filename goes in parens once created.

Format per module: existing lessons noted, then **new** lessons to add.

---

## ai-systems

### 01-foundations-and-prompting — ✅ DONE
Existing: Prompting Fundamentals, Context Windows & Token Economics, Structured Output & CoT
- [x] Few-shot vs zero-shot prompting and template design (04-few-shot-vs-zero-shot-and-templates.md)
- [x] System prompts vs user prompts, role conditioning, instruction hierarchy (05-system-vs-user-prompts-and-role-conditioning.md)
- [x] Tokenization mechanics (BPE/tiktoken, why token count ≠ word count) (06-tokenization-mechanics.md)
- [x] Sampling parameters: temperature, top-p, top-k, and determinism (07-sampling-parameters.md)
- [x] Multimodal prompting (image/audio input handling) (08-multimodal-prompting.md)

### 02-context-and-rag — ✅ DONE
Existing: RAG Fundamentals, Hybrid Search & Reranking, Multi-Hop/Agentic RAG
- [x] Chunking strategies (04-chunking-strategies.md)
- [x] Context compression and long-document summarization for RAG (05-context-compression-and-summarization.md)
- [x] GraphRAG and knowledge-graph-augmented retrieval (06-graphrag-knowledge-graph-retrieval.md)
- [x] Query rewriting, expansion, and HyDE (07-query-rewriting-expansion-hyde.md)
- [x] RAG evaluation (08-rag-evaluation.md)

### 03-retrieval-and-vector-search — ✅ DONE
Existing: Vector Search & ANN, Embedding Model Selection, Quantization
- [x] Vector DB index architectures compared (04-vector-index-architectures-compared.md)
- [x] Hybrid sparse+dense retrieval (05-hybrid-sparse-dense-retrieval.md)
- [x] Metadata filtering and multi-tenant vector search at scale (06-metadata-filtering-multi-tenant-vector-search.md)
- [x] Embedding drift, versioning, and re-indexing strategy (07-embedding-drift-versioning-reindexing.md)

### 04-model-serving-and-inference — ✅ DONE
Existing: Serving Fundamentals (batching/KV cache), Speculative Decoding & Distillation, Multi-GPU Parallelism
- [x] Quantization for inference (04-quantization-for-inference.md)
- [x] Model routing and cascades (05-model-routing-and-cascades.md)
- [x] Autoscaling GPU inference fleets and cold-start mitigation (06-autoscaling-gpu-inference-fleets.md)
- [x] Prefix/prompt caching at the serving layer (07-prefix-and-prompt-caching.md)
- [x] Serving frameworks compared (08-serving-frameworks-compared.md)

### 05-agents-and-tool-use — ✅ DONE
Existing: Agent Loops & Tool Use, Multi-Agent Orchestration, Agent Memory Architectures
- [x] Tool/function-calling schema design and argument validation (04-tool-schema-design-and-argument-validation.md)
- [x] Planning strategies (ReAct, ToT, plan-and-execute) (05-planning-strategies-react-tot-plan-and-execute.md)
- [x] Agent-to-agent and agent-to-tool protocols (MCP, A2A) (06-agent-to-agent-and-tool-protocols.md)
- [x] Failure recovery, retries, self-correction loops (07-failure-recovery-and-self-correction-loops.md)
- [x] Human-in-the-loop and approval gates (08-human-in-the-loop-and-approval-gates.md)

### 06-evaluation-and-observability — ✅ DONE
Existing: Evaluating LLM Applications, Tracing/Debugging Pipelines, Human Feedback & RLHF Basics
- [x] LLM-as-judge design, calibration, and bias pitfalls (04-llm-as-judge-design-calibration-and-bias-pitfalls.md)
- [x] Golden datasets and regression testing for prompts (05-golden-datasets-and-regression-testing-for-prompts.md)
- [x] Production monitoring: drift detection, hallucination rate tracking (06-production-monitoring-drift-and-hallucination-tracking.md)
- [x] A/B testing and online evaluation for LLM features (07-ab-testing-and-online-evaluation-for-llm-features.md)

### 07-safety-and-guardrails — ✅ DONE
Existing: Prompt Injection & Input Guardrails, Content Moderation & Output Safety, Jailbreaks & Adversarial Robustness
- [x] PII detection and redaction pipelines (04-pii-detection-and-redaction-pipelines.md)
- [x] Multi-agent security boundaries and tool permission scoping (05-multi-agent-security-boundaries-and-tool-permission-scoping.md)
- [x] Red-teaming methodology for LLM applications (06-red-teaming-methodology-for-llm-applications.md)
- [x] Data governance and compliance for LLM systems (07-data-governance-and-compliance-for-llm-systems.md)

### 08-cost-and-latency — ✅ DONE
Existing: Cost/Latency Optimization, Caching LLM Responses, Streaming & Perceived Latency
- [x] Model selection economics (04-model-selection-economics.md)
- [x] Batch and async processing to cut cost (05-batch-and-async-processing.md)
- [x] Token budget management across multi-step pipelines (06-token-budget-management.md)

### 09-fine-tuning-and-adaptation — ✅ DONE
Existing: Fine-Tuning vs Prompting vs RAG, Preparing Training Data, RLHF/PPO/DPO
- [x] LoRA and QLoRA parameter-efficient fine-tuning (04-lora-and-qlora-parameter-efficient-fine-tuning.md)
- [x] Continual learning and catastrophic forgetting (05-continual-learning-and-catastrophic-forgetting.md)
- [x] Synthetic data generation for fine-tuning (06-synthetic-data-generation-for-fine-tuning.md)

### 10-production-reliability — ✅ DONE
Existing: Handling LLM Failures, Shadow Deployments & Canary Releases, Multi-Region Deployment
- [x] Rate limiting and backpressure for LLM APIs (04-rate-limiting-and-backpressure-for-llm-apis.md)
- [x] Fallback chains across providers/models (05-fallback-chains-across-providers-and-models.md)
- [x] Cost runaway protection and spend circuit breakers (06-cost-runaway-protection-and-spend-circuit-breakers.md)

---

## system-design

### 01-foundations — ✅ DONE
Existing: CAP Theorem, Back-of-Envelope Estimation, Availability & the Nines
- [x] Latency numbers every engineer should know (04-latency-numbers-every-engineer-should-know.md)
- [x] Consistency models overview (05-consistency-models-overview.md)
- [x] Vertical vs horizontal scaling tradeoffs (06-vertical-vs-horizontal-scaling-tradeoffs.md)

### 02-apis-services-protocols — ✅ DONE
Existing: REST vs gRPC vs GraphQL, Idempotency & API Design, Pagination/Versioning/Webhooks
- [x] API gateway patterns and edge rate limiting (04-api-gateway-patterns-and-edge-rate-limiting.md)
- [x] AuthN/AuthZ patterns (05-authn-authz-patterns.md)
- [x] Long-running operations and async API design (06-long-running-operations-and-async-api-design.md)

### 03-data-modeling-and-sql — ✅ DONE
Existing: Normalization/Denormalization, ACID & Isolation Levels, Indexing Strategies
- [x] Query optimization and execution plans (04-query-optimization-and-execution-plans.md)
- [x] Connection pooling and read replicas (05-connection-pooling-and-read-replicas.md)
- [x] Schema migration strategies at scale (06-schema-migration-strategies-at-scale.md)

### 04-nosql-partitioning-and-ids — ✅ DONE
Existing: Sharding Strategies, NoSQL Data Models, Eventual Consistency in Practice
- [x] Distributed ID generation (04-distributed-id-generation.md)
- [x] Consistent hashing in depth (05-consistent-hashing-in-depth.md)
- [x] Hot partition mitigation and rebalancing (06-hot-partition-mitigation-and-rebalancing.md)

### 05-caching-and-fast-reads — ✅ DONE
Existing: Caching Strategies & Invalidation, Cache Eviction & Thundering Herd, Multi-Level Caching & CDN
- [x] Cache-aside vs write-through vs write-behind (04-cache-aside-write-through-write-behind.md)
- [x] Distributed cache coherence (05-distributed-cache-coherence.md)

### 06-distributed-coordination — ✅ DONE
Existing: Consensus & Leader Election, Distributed Locks, Gossip Protocols & Failure Detection
- [x] Raft vs Paxos walkthrough (04-raft-vs-paxos-walkthrough.md)
- [x] Distributed transactions (2PC, Saga) (05-distributed-transactions-2pc-saga.md)
- [x] Clock synchronization (06-clock-synchronization.md)

### 07-storage-engines — ✅ DONE
Existing: B-Trees vs LSM-Trees, Replication Strategies, Compression & Columnar Storage
- [x] Write-ahead logging and crash recovery (04-write-ahead-logging-and-crash-recovery.md)
- [x] Compaction strategies and storage engine internals (05-compaction-strategies-and-storage-engine-internals.md)

### 08-async-work-and-streams
Existing: Message Queues & Delivery Guarantees, Stream Processing, Event Sourcing & CQRS
- [ ] Dead letter queues and poison message handling
- [ ] Exactly-once processing semantics
- [ ] Kafka/Pulsar architecture deep dive (partitions, consumer groups, offsets)

### 09-search-and-retrieval
Existing: Inverted Indexes & Full-Text Search, Search Relevance & Autocomplete, Spell Correction & Faceted Search
- [ ] Distributed search index sharding and replication (Elasticsearch/Solr architecture)
- [ ] Search query caching and performance tuning

### 10-analytics-and-sketches
Existing: Probabilistic Data Structures, Real-Time Analytics Pipelines, T-Digest & Percentile Estimation
- [ ] Bloom filters and Count-Min Sketch in depth
- [ ] OLAP vs OLTP and columnar analytics engines (star schema, materialized views)

### 11-realtime-social-and-feeds
Existing: Fanout Strategies, WebSockets/Long Polling/SSE, Ranking Feeds
- [ ] Presence systems (online/offline/typing indicators)
- [ ] Notification delivery at scale (push/email/SMS fanout, dedup)

### 12-geo-matching-and-recs
Existing: Geospatial Indexing, Recommendation Systems, Two-Sided Marketplace Matching
- [ ] Real-time bidding and auction systems
- [ ] ETA prediction and routing estimation

### 13-media-files-and-cdn
Existing: CDNs & Content Delivery, Object Storage & Large Files, Image Optimization
- [ ] Video streaming protocols (HLS/DASH, adaptive bitrate)
- [ ] Chunked/resumable upload for large files

### 14-reliability-and-operations
Existing: Load Balancing & Health Checks, Graceful Degradation & Circuit Breakers, Chaos Engineering & DR
- [ ] SLIs, SLOs, and error budgets
- [ ] Observability stack: metrics, logs, traces (three pillars)
- [ ] Deployment strategies: blue-green, rolling, feature flags

### 15-service-and-data-designs
Existing: Rate Limiter Design, Distributed Key-Value Store, Microservices vs Monolith
- [ ] Designing a distributed task scheduler
- [ ] Designing a payment/billing system
- [ ] Designing a distributed lock service

### 16-product-designs
Existing: URL Shortener, Chat System, Web Crawler
- [ ] Designing a ride-sharing system
- [ ] Designing an e-commerce inventory/checkout system
- [ ] Designing a ticket-booking system (seat inventory, overselling prevention)

### 17-media-and-operations-designs
Existing: Video Upload/Transcoding Pipeline, Notification System, Distributed Logging/Monitoring
- [ ] Designing a live-streaming platform
- [ ] Designing a search autocomplete service
- [ ] Designing a distributed cron/job scheduler

### 18-engineering-case-studies
Existing: Amazon Dynamo, Facebook TAO, Google Spanner
- [ ] Case study: Netflix chaos engineering and microservices resilience
- [ ] Case study: Uber's Schemaless/DOSA data platform
- [ ] Case study: Kafka at LinkedIn (origin and design decisions)

---

## Totals
- ai-systems: 30 existing + 33 new = 63 lessons across 10 modules
- system-design: 54 existing + 45 new = 99 lessons across 18 modules
- **Grand total new lessons: 78**

## Sources consulted
- [The Complete System Design Interview Guide 2026](https://atul4u.medium.com/the-complete-system-design-interview-guide-2026-1784f8beb092)
- [System Design Interview Guide 2026 — DesignGurus](https://www.designgurus.io/blog/complete-guide-sys-design)
- [80 Distributed Systems Interview Questions 2026 — MentorCruise](https://mentorcruise.com/questions/distributedsystems/)
- [AI Engineering Roadmap 2026 — Learnixo](https://learnixo.io/blog/ai-engineering-roadmap-2026)
- [AI Engineer Roadmap 2026 — dataskew.io](https://dataskew.io/roadmaps/ai-engineering/)
