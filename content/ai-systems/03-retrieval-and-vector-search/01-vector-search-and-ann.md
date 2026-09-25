---
title: "Vector Search and Approximate Nearest Neighbors"
short_title: "Vector Search and ANN"
tags: ["vector-search", "embeddings", "retrieval", "ann"]
sources:
  - "Malkov & Yashunin, 'Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs' (2018, HNSW paper)"
  - "Pinecone, Weaviate, and pgvector documentation on index types"
---

## What a vector search index is actually doing

An embedding model turns text (or images, audio) into a vector — a list of a few hundred to a few thousand numbers representing its meaning as a point in high-dimensional space. Two pieces of text with similar meaning end up as nearby points; unrelated text ends up far apart. Vector search means, given a query vector, finding the stored vectors closest to it — nearest-neighbor search.

The naive approach — compute the distance from the query to every stored vector, sort, take the closest k — is exact but doesn't scale. It's O(n) per query, so a million-vector index means a million distance computations per search. Past a few tens of thousands of vectors, this gets too slow for interactive use.

## Why "approximate" nearest neighbors is the practical answer

Approximate Nearest Neighbor (ANN) algorithms trade a small amount of accuracy for a large speedup — instead of guaranteeing the exact k closest vectors, they return vectors that are *very likely* among the closest, in a fraction of the time. For most retrieval use cases (RAG, recommendation, semantic search) this tradeoff is close to free: missing the 11th-closest result out of a top-10 request rarely changes the outcome, but going from O(n) to O(log n) search time is the difference between a usable product and a timeout.

## Common ANN index types

- **HNSW (Hierarchical Navigable Small World)** — builds a multi-layer graph where each vector is a node connected to its approximate neighbors; search starts at a sparse top layer and descends, narrowing in on the right region. Very fast queries and good recall, at the cost of higher memory use and slower index build/insert time. The default choice in most modern vector databases (pgvector, Weaviate, Pinecone all support it) unless a specific constraint rules it out.
- **IVF (Inverted File Index)** — clusters the vector space into partitions (via k-means or similar) at index-build time; a query only searches the partitions nearest to it, rather than the whole space. Faster to build and lower memory than HNSW, but recall depends heavily on how well the clustering matches the actual query distribution.
- **Product Quantization (PQ)** — compresses vectors by splitting them into sub-vectors and quantizing each to a small codebook, trading some accuracy for a large reduction in memory footprint. Often combined with IVF (IVF-PQ) for very large-scale indexes where holding full-precision vectors in memory isn't feasible.

## The tradeoffs that actually drive a choice

- **Recall vs. latency:** every ANN index exposes a tunable parameter (e.g., HNSW's `ef_search`, IVF's `nprobe`) trading search time for how thoroughly it searches — higher values improve recall at the cost of latency. This needs tuning against your actual data and query patterns, not left at a default.
- **Build time and update cost:** HNSW graphs are relatively expensive to update incrementally (inserting into a live graph is slower than an initial bulk build); if your data changes constantly, an index type and update strategy that handles incremental inserts cheaply matters more than raw query speed.
- **Memory footprint:** full-precision vectors at scale (millions of 1536-dimension embeddings, for instance) can require tens of gigabytes of RAM for the index alone — quantization (PQ) or reducing embedding dimensionality becomes a real cost lever, not a micro-optimization, once you're past a few million vectors.

## Filtered search: the part naive vector search misses

Real retrieval usually needs more than "find similar vectors" — it needs "find similar vectors that also satisfy a metadata condition" (e.g., "similar documents, but only ones the current user has access to," or "similar products, but only in stock"). This is **filtered vector search**, and it's harder than it sounds: applying the filter *before* the ANN search (pre-filtering) can shrink the candidate pool so much that the ANN index's assumptions about density break down; applying it *after* (post-filtering) risks returning fewer than k results if most of the nearest neighbors get filtered out. Production vector databases handle this differently — some push filters into the graph traversal itself — so it's worth checking a specific database's filtered-search behavior rather than assuming it "just works" the way exact SQL `WHERE` clauses do.

## A worked example

**Scenario:** a RAG system over 2 million document chunks, needing sub-100ms retrieval, where each user should only see chunks from documents they have access to.

- **Index choice:** HNSW, since query latency matters more than build time here, and 2 million vectors at typical embedding dimensions (768-1536) fits comfortably in memory on a reasonably provisioned server without needing PQ compression.
- **Filtering:** access control can't be a post-filter on the top-k results — if a user's accessible documents are a small fraction of the corpus, naive post-filtering could return zero results even though relevant, accessible chunks exist further down the ranked list. This is exactly the filtered-search problem above, and the fix is checking whether the vector database supports pushing the access-control filter into the search itself, rather than trusting a default "search then filter" flow.
- **Recall tuning:** `ef_search` gets tuned against a held-out set of real queries with known-relevant chunks, checking recall@10 at a few candidate values, rather than guessing a value and shipping it.

## Common mistakes

- **Treating all ANN indexes as interchangeable.** HNSW and IVF have meaningfully different build-time, update-cost, and memory tradeoffs — picking one because it's the library's default, without checking it matches your update frequency and scale, causes problems that only show up once the index is large.
- **Ignoring the filtered-search problem until access control breaks in production** — silently returning fewer or zero results for users with narrow access is a common, easy-to-miss failure mode.
- **Never measuring recall against ground truth.** Without a labeled set of "for this query, these are the actually-relevant results," it's easy to tune latency parameters down to a point where retrieval quietly gets worse, since a fast wrong answer looks the same as a fast right one until someone checks.
