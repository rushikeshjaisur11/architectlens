---
title: "Embedding Drift, Model Versioning, and Re-Indexing Strategy"
short_title: "Embedding Drift & Re-Indexing"
tags: ["embeddings", "vector-search", "mlops", "versioning", "retrieval"]
sources:
  - "OpenAI embeddings model deprecation and migration documentation"
  - "Pinecone and Weaviate documentation on index migration and re-embedding"
  - "Muennighoff et al., 'MTEB: Massive Text Embedding Benchmark' (2023)"
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

## Common mistakes

- **Re-embedding only new documents after a model upgrade.** This is the single most common incident: the index silently becomes a mix of two incompatible vector spaces, and search quality degrades in a way that's hard to diagnose because most queries still return *some* results.
- **Treating a "minor" provider model update as safe to ignore.** Embedding providers can update an endpoint's underlying weights without a version bump in some cases; pin explicit model versions where the API supports it, and monitor for silent behavior changes via a standing eval set.
- **No rollback plan during cutover.** Blue-green re-indexing only pays off if the old index is kept queryable until the new one is validated — deleting `docs_v1` immediately after building `docs_v2` removes the safety net the whole pattern exists for.
- **Sizing re-indexing cost only in engineering time, not embedding API cost.** For API-based embedding models, re-embedding a large corpus is a real, sometimes substantial dollar cost that should be estimated and approved before a migration, not discovered on the bill afterward.
