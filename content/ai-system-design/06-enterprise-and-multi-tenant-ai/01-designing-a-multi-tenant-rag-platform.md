---
title: "Designing a Multi-Tenant RAG Platform"
short_title: "Multi-Tenant RAG Platform"
tags: ["multi-tenant", "rag", "isolation", "quotas", "platform", "design"]
sources:
  - "Public documentation of vector databases on namespaces, partitions and multi-tenancy"
  - "Microsoft Azure Architecture Center, multi-tenant SaaS guidance"
  - "OWASP guidance on broken access control"
  - "Multi-tenant RAG isolation guides, 2026 (secondary: truto.one, render.com, thenile.dev); pgvector and Postgres row-level security documentation"
  - "OWASP Top 10 for LLM Applications 2025, LLM08 Vector and Embedding Weaknesses"
banner:
  layout: fan
  nodes:
    - [shield, "isolation"]
    - [user, "tenant A"]
    - [user, "tenant B"]
    - [db, "shared index"]
predict:
  question: "Tenant A bulk-uploads 40 million documents while tenant B runs a live support assistant. Ingestion uses per-tenant queues with weighted fair scheduling. What happens to B's small updates?"
  options: ["They queue behind A's backlog and wait until A's upload finishes", "They are applied within seconds because A holds only a capped share of workers", "They are rejected until A's upload drops below a size threshold"]
  answer: 1
  why: "Per-tenant queues with a capped share of embedding workers stop A's bulk load from delaying B's small updates."
check:
  - q: "Why should the tenant id come from the authenticated identity rather than the request body?"
    options: ["Client-supplied tenant ids are ignored, so a caller cannot name another tenant", "Token claims are faster to parse than request parameters at the edge", "Request bodies cannot be forwarded through the data access layer"]
    answer: 0
    why: "The id is derived at the edge from the authenticated identity, so a caller cannot choose a different tenant."
  - q: "Why use a single data access layer instead of asking each feature team to add a tenant filter?"
    options: ["It lets the vector database skip building an index per tenant", "Isolation then does not depend on every developer remembering a filter", "It removes the need for cross-tenant tests and canary documents"]
    answer: 1
    why: "One enforced path injects the tenant scope into every query, so a forgotten filter cannot cause a breach. Tests and canaries are still added on top."
  - q: "A semantic cache is shared across all tenants to save cost. What is the architectural problem?"
    options: ["Cache entries expire too quickly to be worth the saving", "Cached answers cannot be compared against query embeddings", "Shared caches are a classic leakage path unless keys include tenant"]
    answer: 2
    why: "Caches, logs and traces must be scoped by tenant, and semantic cache keys must include tenant and permissions."
---

## The problem

A company offers RAG as a service to many customers (tenants): each uploads documents and asks questions. The platform must give every tenant **strong isolation**, fair resource sharing, predictable cost, and the ability to scale from tenants with a hundred documents to tenants with hundreds of millions. One tenant's data must never appear in another's answers, and one tenant's load must never ruin another's latency.

## Step 1: Requirements

- **Isolation:** no cross-tenant data access, including through caches, logs, embeddings and error messages.
- **Fairness:** quotas and rate limits per tenant; noisy neighbours contained.
- **Flexibility:** per-tenant configuration (models, chunking, retention, data region).
- **Cost efficiency:** small tenants must not each require dedicated infrastructure.
- **Compliance:** data residency, deletion on request, audit trails, and optionally customer-managed encryption keys.
- **Scale (example):** 5,000 tenants, a long tail of small ones and a few giants.

## Step 2: Isolation models

There is a spectrum with a cost trade-off:

- **Shared index with a tenant filter:** one collection, every chunk tagged with a tenant id, every query filtered. Cheapest and simplest, but a single bug in filtering is a data breach, and noisy neighbours share resources.
- **Namespace or partition per tenant:** the vector database separates tenants logically inside shared infrastructure, with physical separation of data structures. Good middle ground.
- **Index or cluster per tenant:** dedicated resources. Strongest isolation and independent scaling, highest cost and operational overhead.

A common design is **tiered**: small tenants share partitioned infrastructure; large or regulated tenants get dedicated indexes or clusters. Make the tier a property of the tenant so they can be migrated.

## Step 3: Enforcing the boundary

Isolation must not depend on every developer remembering a filter.

- The **tenant id is derived from the authenticated identity** at the edge and carried in request context; client-supplied tenant ids are ignored.
- A single **data access layer** is the only code path to the index, and it **injects the tenant scope** into every query. Direct index access is not permitted from application code.
- Add **automated tests** that attempt cross-tenant reads and fail the build if they succeed, and canary documents in each tenant that must never appear elsewhere.
- Scope **caches, prompt-cache keys, logs and traces** by tenant too; shared caches are a classic leakage path.

## Step 4: Ingestion at scale, fairly

Ingestion jobs from all tenants share worker pools. Use **per-tenant queues** with weighted fair scheduling and concurrency caps, so one tenant uploading a million documents does not delay everyone else's small updates. Rate-limit embedding calls per tenant, and prioritise interactive edits over bulk backfills. Track ingestion lag per tenant as an SLO.

## Step 5: Query path and noisy neighbours

- **Rate limits and quotas** on queries per second and tokens per day per tenant, with burst allowances.
- **Concurrency limits** on expensive operations (reranking, long generations).
- **Resource isolation** for the heaviest tenants: separate shards or replicas.
- **Fair queueing** under overload so latency degrades evenly rather than starving small tenants.
- **Per-tenant model routing:** some tenants require a specific provider or region.

## Step 6: Per-tenant configuration and cost

Store settings (chunk size, embedding model, allowed models, retention period, guardrail level) in a **versioned tenant config** service. Meter usage precisely: documents stored, embedding tokens, queries, generation tokens, storage. Attribute cost per tenant to support pricing and to find unprofitable tenants. Since changing an embedding model requires re-indexing, make migrations **per tenant and blue-green** so one tenant's upgrade does not affect others.

## Step 7: Lifecycle, residency and deletion

- **Residency:** route and store a tenant's data only in its chosen region, including embeddings, caches and logs.
- **Deletion:** removing a tenant or a document must remove chunks, vectors, caches, backups on a defined schedule, and derived data; verify and provide evidence.
- **Encryption:** per-tenant keys allow cryptographic deletion and customer-managed key options.
- **Audit:** log who accessed what, queryable per tenant.

## A worked example

**Scenario:** tenant A uploads 40 million documents while tenant B runs a live support assistant.

1. A's ingestion goes to its own queue; a weighted scheduler gives A a capped share of embedding workers, keeping B's updates within seconds.
2. B's queries carry a tenant id derived from the API key; the data access layer scopes the vector search to B's partition.
3. A starts a heavy evaluation run; per-tenant concurrency limits cap its reranker usage so B's p95 stays within target.
4. A requests deletion of a project folder: the pipeline removes its chunks, vectors and cache entries, and logs a verification report.
5. A canary document planted in A's tenant is regularly searched from B's identity; it must never appear, and an alert fires if it does.

## Enterprise practice (verified October 2026)

**Basics.** Tag every chunk with a tenant id and filter every query by it (steps above).

**Isolation levels used in practice (secondary guides, 2026).**

- **Enforce at the data layer, never in the prompt.** Take the tenant id from a signed token claim, not from user input, and apply it as an absolute filter in the vector store or database. **Postgres row-level security** can force a tenant predicate on every query so a forgotten `WHERE` clause cannot leak rows. Never rely on the model or system prompt to hold back other tenants' data (OWASP lists vector and embedding weaknesses as LLM08).
- **Shared index versus index per tenant.** One shared index with metadata filters is cheapest, but approximate indexes (HNSW, IVF) traverse a graph built over *all* rows and apply the filter afterwards, so one tenant's data affects recall and latency for others and filtered queries can under-return (see the vector database note on iterative scans). **List-partition by tenant** or use a namespace or dedicated index per tenant for strict isolation and for high-compliance customers.
- **Tiered model.** Pool small tenants in shared partitions, give large or regulated tenants dedicated indexes (and sometimes dedicated keys and regions); make the tier a property of the tenant record so it can change without code changes.

**Also isolate the surrounding state:** caches (semantic cache keys must include tenant and permissions), conversation memory, evaluation sets, fine-tuned adapters, logs and traces, and cost metering. **Test the boundary** with automated cross-tenant probes in CI: seed two tenants with unique canary strings and assert tenant A can never retrieve tenant B's canary, including through rerankers, caches and tool calls. Per-tenant encryption keys give a crypto-erase path for offboarding.

## Common mistakes

- **Relying on a query-time filter added by each feature team**, instead of one enforced access layer.
- **Shared caches and logs** without tenant scoping.
- **One shared queue**, letting a bulk uploader starve everyone.
- **No per-tenant metering**, hiding unprofitable tenants.
- **Ignoring deletion** of derived data like embeddings, caches and backups.
