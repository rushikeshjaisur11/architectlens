---
title: "Embedding Drift, Model Versioning, and Re-Indexing Strategy"
short_title: "Embedding Drift & Re-Indexing"
tags: ["embeddings", "vector-search", "mlops", "versioning", "retrieval"]
sources:
  - "OpenAI embeddings model deprecation and migration documentation"
  - "Pinecone and Weaviate documentation on index migration and re-embedding"
  - "Muennighoff et al., 'MTEB: Massive Text Embedding Benchmark' (2023)"
  - "Embedding model roundups, 2026 (secondary); pgvector documentation"
banner:
  layout: line
  nodes:
    - [model, "model v1"]
    - [model, "model v2"]
    - [server, "re-embed"]
    - [db, "new index"]
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

## Why embeddings aren't a fire-and-forget asset

An embedding is a coordinate in a vector space **defined by a specific model version**. Vectors from `text-embedding-3-small` and vectors from `text-embedding-3-large` are not comparable — they live in different-dimensional, differently-trained spaces, and mixing them in one index produces nonsense distances (a query embedded with model A compared against documents embedded with model B will look almost uniformly dissimilar, or match at random). This sounds obvious stated directly, but it's one of the most common production incidents in RAG systems: a provider updates a "minor version" embedding endpoint, teams re-embed only new documents going forward, and search quality silently degrades because old and new vectors now coexist in the same index.

## Two distinct kinds of drift

**Model drift** — the embedding model itself changes (a new version, a fine-tune, or a switch to a different provider entirely). This is a **hard break**: there is no compatibility between old and new vector spaces, full re-embedding is mandatory, and it should be treated as a breaking schema migration, not a hot-swap.

**Data drift** — the underlying content distribution shifts even though the model stays fixed. A support-ticket search system trained implicitly (via the embedding model's own training distribution) on 2023-era language may embed 2026 product terminology, slang, or new entity names less precisely — not broken, but gradually less discriminative. This is subtler: retrieval quality metrics (recall@k against a golden eval set) degrade slowly rather than breaking outright, and it's caught by **ongoing eval**, not a version diff.

## Versioning the index, not just the model

The practical fix is treating the embedding model as part of the index's identity, not an implementation detail. Concretely:

- Tag every vector's metadata with the **embedding model name and version** it was produced by (e.g., `embedding_model: "text-embedding-3-large-2024-01"`). This makes it possible to detect a mixed-version index with a simple metadata query rather than discovering it via degraded search quality in production.
- Maintain indexes as **versioned collections**, not a single mutable one (`docs_v1`, `docs_v2`), so a model migration can build the new index alongside the old one, validate it against a golden eval set, and cut over atomically rather than mutating in place while serving live traffic.
- Never blend embedding versions in a single ANN index. If a migration must be incremental for cost reasons, migrate by **rebuilding a new index and dual-writing** until cutover — not by re-embedding a subset in place inside the old index.

## Re-indexing strategy: blue-green over in-place

The standard pattern mirrors blue-green deployment: build the new index (`docs_v2`) fully from source documents with the new embedding model while `docs_v1` continues serving reads. Once `docs_v2` passes eval (recall@k, NDCG against a labeled or LLM-judged query set) at parity or better than `docs_v1`, switch read traffic and decommission the old index after a safety window. This costs double the storage/compute temporarily but avoids serving a half-migrated, mixed-quality index to users — a much worse failure mode than a slower migration.

For very large corpora where a full rebuild is expensive (re-embedding is often the dominant cost — API-based embedding models charge per token, so re-embedding a 500M-chunk corpus is a real line-item cost to budget, not just an engineering task), a **chunked cutover** — migrating by tenant, by document collection, or by time range, with per-segment version tags — lets you amortize cost and rollback blast radius, provided query-time routing knows which version each segment lives in and doesn't compare across them.

## Triggering re-indexing: eval, not calendar

Re-indexing cadence shouldn't be purely time-based ("re-embed every quarter") because that's disconnected from actual quality signal. The better trigger is a standing **retrieval eval pipeline** — a labeled or LLM-judged query set run periodically (or on every candidate model change) measuring recall@k / NDCG / MRR against the current production index. A meaningful drop against baseline is the actual signal to re-index, whether that happens on day 10 or month 6. This also gives you the artifact needed to justify the cost of a re-embed to stakeholders: a measured quality delta, not a hunch.

## Current practice (verified October 2026)

Providers retire and replace embedding models on their own schedule, and newer multimodal models change dimensions and similarity behaviour, so re-embedding is a normal operation. Make it routine: version the index (model, dimension, chunker, parser, ACL schema), build the new index in parallel, shadow-query both with live traffic, compare recall and business metrics, then cut over and retire the old one. Budget the cost up front as corpus tokens times the embedding price, and keep the original text so you can re-embed without re-parsing.

## Common mistakes

- **Re-embedding only new documents after a model upgrade.** This is the single most common incident: the index silently becomes a mix of two incompatible vector spaces, and search quality degrades in a way that's hard to diagnose because most queries still return *some* results.
- **Treating a "minor" provider model update as safe to ignore.** Embedding providers can update an endpoint's underlying weights without a version bump in some cases; pin explicit model versions where the API supports it, and monitor for silent behavior changes via a standing eval set.
- **No rollback plan during cutover.** Blue-green re-indexing only pays off if the old index is kept queryable until the new one is validated — deleting `docs_v1` immediately after building `docs_v2` removes the safety net the whole pattern exists for.
- **Sizing re-indexing cost only in engineering time, not embedding API cost.** For API-based embedding models, re-embedding a large corpus is a real, sometimes substantial dollar cost that should be estimated and approved before a migration, not discovered on the bill afterward.
