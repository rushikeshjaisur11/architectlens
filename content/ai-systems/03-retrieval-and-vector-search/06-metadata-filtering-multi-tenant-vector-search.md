---
title: "Metadata Filtering and Multi-Tenant Vector Search at Scale"
short_title: "Metadata Filtering & Multi-Tenancy"
tags: ["vector-search", "multi-tenancy", "filtering", "retrieval", "scalability"]
sources:
  - "Pinecone namespaces and metadata filtering documentation"
  - "Weaviate multi-tenancy documentation"
  - "Qdrant payload filtering and collection design documentation"
  - "Milvus partition key and multi-tenancy documentation"
  - "pgvector 0.8.0 iterative scans and PostgreSQL row-level security documentation; multi-tenant RAG isolation guides, 2026 (secondary: truto.one, render.com)"
banner:
  layout: line
  nodes:
    - [user, "query"]
    - [shield, "filter"]
    - [db, "vector index"]
    - [doc, "results"]
predict:
  question: "You run IVF with a small nprobe, and a query vector sits right at the edge of its assigned cell. What happens?"
  options: ["True neighbors in the adjacent cell may never be probed, so recall drops", "The query automatically probes every cell and becomes brute-force speed", "The index returns exact results, because the query's own cell is searched fully"]
  answer: 0
  why: "With low nprobe only the nearest cells are scanned, so neighbors lying across a cell boundary can be missed, which craters recall."
check:
  - q: "Your corpus has heavy delete and update churn. Why is HNSW a risky default?"
    options: ["Deletes are tombstoned, and accumulating tombstones silently degrade recall until a rebuild", "HNSW stores no vectors, so deleted items cannot be removed from disk", "Each delete forces an immediate full rebuild, which blocks all queries"]
    answer: 0
    why: "HNSW lacks native exact deletes, so tombstones build up and recall quietly drops until the index is rebuilt."
  - q: "A corpus of 800M vectors must fit a tight RAM budget and tens-of-millisecond queries are acceptable. Which is the better fit and why?"
    options: ["HNSW, because it keeps single-digit millisecond latency at any scale", "DiskANN, which scores from compressed in-memory data and fetches full vectors from SSD", "ScaNN, because it needs no memory for the quantized representation"]
    answer: 1
    why: "DiskANN keeps the memory footprint proportional to the compressed index and trades higher tail latency for disk residency, matching the over-500M, RAM-constrained case."
  - q: "Two teams compare HNSW and IVF using each library's default ef_search and nprobe. What is wrong with this?"
    options: ["Defaults are always set to the maximum, which makes both indexes exact", "Index comparison only makes sense on filtered queries, never unfiltered ones", "It compares tuning laziness rather than the algorithms, since each knob trades accuracy for latency"]
    answer: 2
    why: "Each index has a runtime accuracy and latency knob, so comparing at defaults does not reveal how the algorithms actually perform."
---

## Why filtering breaks the ANN assumption

ANN indexes (HNSW, IVF, etc.) are built assuming you'll search the whole index and return the globally closest vectors. Real applications almost always need **filtered search**: "closest documents to this query, but only from tenant X, only where `status=published`, only from the last 30 days." The naive approaches to this both fail at scale in different ways, which is why filtered vector search is a genuinely hard architecture problem, not a solved one.

## Pre-filtering vs. post-filtering vs. filtered search

**Post-filtering**: run the ANN search first (say, top 100), then discard results that don't match the metadata filter. Simple to implement, but breaks badly when the filter is selective — if only 2% of the corpus matches the filter, your top 100 ANN results might contain zero matches, and you'd need to keep expanding `k` until enough survive, which degrades toward brute force.

**Pre-filtering**: compute the set of documents matching the metadata filter first, then restrict the ANN search to that subset. Correct in principle, but naive implementations do this by intersecting a bitmap with graph traversal, which most graph-based indexes (HNSW) don't support natively — you can't easily "search only within a subgraph" without breaking the graph's navigability guarantees.

**True filtered ANN** (what production vector DBs implement) integrates the filter into the traversal itself. Weaviate, Qdrant, and Milvus all implement variants where the graph/IVF search checks the filter predicate during traversal and skips non-matching candidates without abandoning the index structure — Qdrant's approach (a filterable HNSW variant) and Milvus's bitmap-accelerated scalar filtering are examples. The recall/latency cost of filtering scales with **filter selectivity**: a filter matching 50% of the corpus barely affects recall, but a filter matching 0.1% can force the traversal to visit far more nodes than usual to find enough matches, sometimes falling back to brute force below a selectivity threshold.

## Multi-tenancy patterns

Three architectural patterns dominate, each with different isolation/cost tradeoffs:

1. **Metadata filter per tenant (shared index)**: every vector carries a `tenant_id` field; queries always include a `tenant_id` filter. Cheapest operationally — one index, one set of resources — but tenants share the same graph/IVF structure, so a single huge tenant can dominate cluster placement and noisy-neighbor effects are real. Also a security consideration: filter-based isolation depends on every query path correctly applying the filter — a missing filter is a cross-tenant data leak, not just a bug.

2. **Namespace/partition per tenant (logical separation, shared infrastructure)**: Pinecone namespaces, Milvus partitions, and similar constructs give each tenant its own logical sub-index within shared compute/storage. This bounds a query to one tenant's vectors structurally rather than via a filter predicate, which is both faster (no filter overhead) and safer (no filter-omission leak risk). The tradeoff is overhead per namespace — many vector DBs have per-namespace memory or connection overhead that makes thousands of tiny namespaces inefficient (Pinecone's own guidance caps recommended namespace counts; check current limits before assuming unbounded namespace count is free).

3. **Collection/index per tenant (full isolation)**: each tenant gets a fully separate index, sometimes a separate deployment. Maximum isolation and per-tenant tuning (a tenant with 10M vectors can have IVF_PQ while one with 10K uses flat search), but highest operational overhead — hundreds of tenants means hundreds of indexes to provision, monitor, and rebuild. This pattern is typically reserved for enterprise tenants with compliance requirements (data residency, dedicated compute) rather than used uniformly.

Most production systems land on a hybrid: high-value or compliance-sensitive tenants get dedicated collections, the long tail of small tenants shares a namespaced or filtered index.

## Scalar filter indexing

Metadata filters on high-cardinality fields (timestamps, IDs) or combined filters (`category=X AND date > Y AND status=Z`) benefit from the same indexing discipline as a relational database — inverted indexes or B-trees on filterable scalar fields, which is why most vector DBs let you declare which payload/metadata fields should be indexed for filtering rather than indexing everything by default (indexing every field bloats memory for no benefit if it's rarely filtered on).

## Current practice (verified October 2026)

Two 2026-relevant points. First, **iterative scans** in pgvector 0.8.0 make tenant and ACL filters safe for recall by continuing the scan until enough filtered rows are found. Second, isolation must be enforced in the data layer: Postgres **row-level security** policies force a tenant predicate on every query, and list partitioning by tenant (or a namespace or index per tenant) stops one tenant's vectors from changing recall and speed for others on a shared graph index. Take the tenant id from a signed token, never from user input, and test with cross-tenant canary queries in CI.

## Common mistakes

- **Treating tenant_id as "just another filter" without checking it's applied on every query path.** A single code path (an admin tool, a batch job, a new API route) that forgets the tenant filter is a cross-tenant data leak — this deserves the same scrutiny as a SQL injection risk, not casual trust in application code.
- **Ignoring filter selectivity when benchmarking.** A filtered-search latency test run only with low-selectivity filters (matching most of the corpus) won't surface the recall cliff that appears with highly selective filters in production.
- **Over-partitioning into thousands of tiny namespaces "for cleanliness."** Many vector DBs impose real per-namespace resource overhead; thousands of near-empty namespaces can cost more than one well-filtered shared index.
- **Not indexing the scalar fields actually used in filters.** Unindexed metadata filtering degrades to a linear scan over candidates, silently reintroducing brute-force cost on the filter side even with a fast ANN index underneath.
