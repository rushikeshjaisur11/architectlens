---
title: "Vector Index Architectures Compared: HNSW, IVF, DiskANN, and ScaNN"
short_title: "Vector Index Architectures"
tags: ["vector-search", "ann", "hnsw", "indexing", "retrieval"]
sources:
  - "Malkov & Yashunin, 'Efficient and Robust Approximate Nearest Neighbor Search Using HNSW Graphs' (2018)"
  - "Subramanya et al., 'DiskANN: Fast Accurate Billion-point Nearest Neighbor Search on a Single Node' (NeurIPS 2019)"
  - "Guo et al., 'Accelerating Large-Scale Inference with Anisotropic Vector Quantization' (ScaNN, ICML 2020)"
  - "Faiss documentation (github.com/facebookresearch/faiss/wiki)"
---

## Why the index choice is an architecture decision, not a config flag

Every approximate nearest neighbor (ANN) index trades off three resources differently: **query latency, recall, and memory/disk footprint**. Picking one isn't a tuning knob you set once — it determines whether your corpus fits in RAM, whether you can update the index online, and how your infra costs scale with dataset size. Getting this wrong at 1M vectors is invisible; at 500M it's the difference between a $2K/month box and a $40K/month cluster.

## HNSW: the default for in-memory, high-recall workloads

**Hierarchical Navigable Small World** graphs build a multi-layer proximity graph — top layers are sparse "highways," bottom layers are dense. Search starts at the top layer, greedily descends toward the query, and refines at the bottom. This gives **logarithmic-ish search complexity** and typically 95%+ recall at low latency (single-digit milliseconds for millions of vectors).

The catch: HNSW is **memory-hungry**. Each vector needs its full-precision (or quantized) representation *plus* graph edges — typically an extra 30-60% overhead on top of raw vector storage, since each node stores ~M bidirectional links per layer (M is usually 16-64). It also has **no native support for exact deletes** — most implementations (Faiss, hnswlib, Qdrant, Weaviate) mark vectors as tombstoned and require periodic rebuilds to reclaim space and keep recall stable. This makes HNSW excellent for read-heavy, memory-available workloads (product search, RAG over a few million chunks) and a poor fit for high-churn datasets that don't fit in RAM.

## IVF: partition-then-search, and the flat/PQ variants

**Inverted File Index (IVF)** clusters the vector space into `nlist` Voronoi cells (via k-means), then at query time probes only `nprobe` of the nearest cells instead of scanning everything. This is the workhorse behind Faiss's `IVF_FLAT` and `IVF_PQ`.

- **IVF_FLAT** stores full vectors per cell — high recall, but you pay full memory cost, just less compute per query than brute force.
- **IVF_PQ** compresses vectors inside each cell using product quantization, cutting memory 10-30x at the cost of some recall — the standard choice when the raw vectors don't fit in RAM (see the quantization lesson for PQ mechanics).

IVF's key tradeoff knob is `nprobe`: too low and recall craters near cell boundaries (a query vector near the edge of its assigned cell may have true neighbors in an adjacent cell that never gets probed); too high and you approach brute-force cost. IVF also handles **inserts and rebalancing more gracefully than HNSW** in some implementations, but clusters trained on stale data degrade — a corpus that drifts significantly from the original k-means centroids needs periodic re-clustering.

## DiskANN: billion-scale search without billion-scale RAM

DiskANN (Microsoft Research) targets the case IVF_PQ and HNSW both struggle with: **an index too large for memory, but where disk-only brute force is too slow**. It builds a single-layer navigable graph (Vamana) stored on SSD, keeping a compressed (PQ) representation in memory for fast candidate scoring and only fetching full-precision vectors from disk for final re-ranking. This lets a single node search **billions of vectors** with a memory footprint proportional to the compressed index, not the raw data — at the cost of higher tail latency than pure in-memory HNSW, since disk I/O (even fast NVMe) is orders of magnitude slower than RAM access. It's the right call when the corpus genuinely can't fit in memory at your budget and you can tolerate tens-of-milliseconds queries rather than single digits.

## ScaNN: anisotropic quantization for maximum throughput on TPU/CPU

Google's ScaNN (used internally at Google and in Vertex AI Vector Search) distinguishes itself with **anisotropic vector quantization** — instead of minimizing quantization error uniformly (as standard PQ does), it weights the error to preserve the vectors most likely to be top-k results under inner-product/cosine scoring. Combined with a partitioning step similar to IVF and SIMD-optimized scoring, ScaNN typically wins on **queries-per-second at a fixed recall** in benchmarks like ann-benchmarks.com, particularly for inner-product search. It's less commonly self-hosted outside Google's ecosystem (it's the engine behind Vertex AI Vector Search) but the algorithm's core insight — quantization error should be weighted by its effect on ranking, not raw reconstruction error — has influenced other libraries.

## Choosing between them

| Index | Best fit | Memory | Update cost |
|---|---|---|---|
| HNSW | <50M vectors, low latency required | High | Expensive (rebuild for compaction) |
| IVF_PQ | Memory-constrained, 10M-1B vectors | Low-medium | Moderate (re-cluster periodically) |
| DiskANN | >500M vectors, RAM-constrained | Very low (disk-resident) | Expensive (graph rebuild) |
| ScaNN | Max throughput at fixed recall, Google Cloud | Medium | Moderate |

## Common mistakes

- **Benchmarking recall at `nprobe`/`ef_search` defaults.** Every index has a runtime accuracy/latency knob (`nprobe` for IVF, `ef_search` for HNSW); comparing indexes at default settings compares tuning laziness, not the algorithms.
- **Choosing HNSW for a corpus with heavy delete/update churn.** Tombstone accumulation silently degrades recall until a full rebuild — teams often discover this only after production recall drops.
- **Ignoring build time.** HNSW graph construction and IVF k-means both scale with data size; a billion-vector HNSW build can take many hours, which matters for re-indexing cadence (see the drift/re-indexing lesson).
- **Assuming one index type fits every collection in a multi-tenant system.** A tenant with 500 vectors and a tenant with 50M vectors have different optimal indexes — most vector DBs let you set this per-collection, and defaulting everyone to the same config wastes resources at both ends.
