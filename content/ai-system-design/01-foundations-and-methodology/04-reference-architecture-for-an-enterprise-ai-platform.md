---
title: "Reference Architecture for an Enterprise AI Platform"
short_title: "Enterprise AI Platform Architecture"
tags: ["reference-architecture", "platform", "enterprise", "governance", "layers"]
sources:
  - "Google Cloud, AWS and Microsoft Azure reference architectures for generative AI platforms"
  - "NIST AI Risk Management Framework (AI RMF 1.0, 2023)"
  - "Team Topologies (Skelton and Pais, 2019) on platform teams and paved roads"
---

## The problem

When every team builds its own AI stack, the company ends up with ten gateways, five vector stores, inconsistent safety controls and an unreadable bill. An **enterprise AI platform** provides shared, governed building blocks so product teams can ship quickly on a **paved road**, while security, cost and quality are handled once. The architecture below is a vendor-neutral reference.

## Layered view

From the user down to the metal:

1. **Experience and channels:** web, mobile, chat tools, APIs, voice, embedded copilots.
2. **Application and orchestration:** business logic, prompts, workflows, agents, memory.
3. **AI platform services:** gateway, guardrails, evaluation, prompt registry, observability, cost management, feature flags and experimentation.
4. **Knowledge and data services:** connectors, ingestion pipelines, vector and search indexes, knowledge graphs, caches, data catalogue.
5. **Model services:** external provider APIs, self-hosted inference, fine-tuned models, embeddings, rerankers, routing.
6. **Foundation:** identity and access management, networking, secrets, compute (CPU and GPU), storage, queues, monitoring.
7. **Governance and security spanning all layers:** policy, risk classification, audit, privacy, incident response.

## Core platform components

- **AI gateway:** the single path to models: authentication, quotas, routing and fallbacks, caching, redaction, logging and cost attribution.
- **Guardrails service:** input and output safety, injection detection, policy enforcement, action checks.
- **Knowledge platform:** governed ingestion from enterprise sources with permission-preserving indexes and freshness guarantees.
- **Agent and workflow runtime:** durable execution, tool registry, identity propagation, approvals, sandboxes.
- **Evaluation platform:** datasets, scorers, regression gates and online monitors.
- **Prompt and configuration management:** versioned prompts, model settings, rollout controls.
- **Observability:** traces across chains and agents, quality and cost metrics, drift detection.
- **Model hosting:** managed endpoints and self-hosted inference with autoscaling and GPU scheduling.
- **Experimentation and feedback:** online tests, feedback capture, labelling.
- **Developer experience:** SDKs, templates, a catalogue of approved models and tools, documentation, sandbox environments.

## The paved road and the escape hatch

A platform wins by making the right way the easy way. Provide **opinionated templates** (a compliant RAG service, a support-agent skeleton) that come with logging, evaluation and guardrails wired in. Allow **escape hatches** (custom models, special tools) through a reviewed process, so innovation is not blocked but exceptions are visible. Measure platform success by adoption, time to first production release and incident rates, not by the number of components.

## Tenancy and ownership

Decide how business units share the platform: **shared services** with logical isolation by tenant and project, with dedicated resources for sensitive or high-volume workloads. Each AI system has a registered owner, a risk tier, a budget and an on-call contact. Central teams own the platform; product teams own their application behaviour and quality.

## Cross-cutting concerns

- **Identity:** every request carries user and application identity; agents use delegated, scoped tokens.
- **Data protection:** classification drives which models and regions are allowed; redaction and encryption by policy.
- **Observability and audit:** uniform trace and log formats; immutable audit for regulated flows.
- **Reliability:** multi-provider fallbacks, regional deployment, degradation modes, defined SLOs.
- **Cost:** attribution by team and feature, budgets, anomaly detection, optimisation guidance.
- **Compliance:** control mapping to frameworks and regulations, evidence collection by default.

## Build, buy and integrate

Few organisations build everything. Typical split: **buy or adopt** commodity pieces (vector database, tracing, labelling tools, model APIs), **build** the differentiating glue (gateway policy, knowledge connectors tied to your systems, evaluation datasets, domain tools), and **integrate** through standard interfaces (OpenTelemetry, OAuth, common model API shapes) so components can be replaced. Avoid lock-in at layers likely to change fast, such as models and orchestration frameworks.

## Evolution path

1. **Start small:** a gateway with logging and quotas, plus a golden-path RAG template.
2. **Add controls:** guardrails, evaluation gates, prompt registry.
3. **Scale knowledge:** governed ingestion and shared indexes.
4. **Enable agents:** runtime, tool registry, identity delegation, approvals.
5. **Optimise:** cost management, routing, caching, self-hosting where economical.
6. **Mature governance:** risk tiering, continuous assurance, audit automation.

## A worked example

**Scenario:** a bank with 30 teams building AI features asks for a platform strategy.

1. An inventory finds 11 direct provider integrations, 4 vector stores and no shared evaluation. Spend is split across 9 cost centres with 22 percent unattributed.
2. Phase 1 (eight weeks): a gateway fronts all providers with authentication, redaction, quotas and cost tagging; direct provider keys are revoked.
3. Phase 2: a reference RAG template includes permission-aware retrieval, guardrails, an evaluation harness and tracing. Two pilot teams migrate and cut time to production from five months to six weeks.
4. Phase 3: a risk-tiering process classifies use cases; high-risk ones require approval and human oversight; the audit store captures prompts, versions and decisions.
5. Within a year, 24 of 30 teams run on the paved road; unattributed spend falls to 2 percent and a quarterly review retires two duplicate vector stores.

## Common mistakes

- **Building the platform before knowing the first use cases.**
- **A platform with no adoption plan**, so teams route around it.
- **Mandating one model or framework** at layers that change monthly.
- **Governance as paperwork** rather than automated controls.
- **No owner or budget attribution** for AI systems.
