---
title: "Vector Quantization and Memory Efficiency at Scale"
short_title: "Vector Quantization"
tags: ["vector-search", "quantization", "memory", "embeddings"]
sources:
  - "Jégou, Douze & Schmid, 'Product Quantization for Nearest Neighbor Search' (2011)"
  - "Faiss documentation on quantization and index compression"
---

## Why memory becomes the real bottleneck at large scale

This track's vector-search-and-ANN lesson noted that full-precision vectors at scale can consume tens of gigabytes for millions of embeddings, and that this memory footprint is often the actual cost driver, more than raw compute. A typical embedding stored as 32-bit floats (say, 1536 dimensions) takes roughly 6 KB per vector — for 100 million vectors, that's around 600 GB just for the raw vectors, before accounting for the index structure (HNSW graph edges, for instance) built on top of them. This is the specific problem vector quantization addresses: reducing the memory footprint per vector, ideally without a proportional loss in retrieval quality.

## Scalar quantization: the simplest reduction

**Scalar quantization** reduces each dimension's precision independently — converting 32-bit floats to 8-bit integers (or lower), typically by mapping each dimension's observed value range onto the smaller integer range. This gives a straightforward 4x memory reduction (32-bit to 8-bit) with generally modest quality impact for many embedding models, since the relative differences between vectors that matter for similarity search are often preserved reasonably well even at reduced per-dimension precision. It's the least aggressive quantization technique, and often a reasonable first step before considering more aggressive options.

## Product quantization: compressing by sub-vector, not just per-dimension

**Product quantization (PQ)** takes a more aggressive approach: it splits each vector into several sub-vectors (say, a 1536-dimension vector split into 96 sub-vectors of 16 dimensions each), and for each sub-vector position, learns a small codebook (a limited set of representative sub-vector "centroids," typically 256 of them, learned via clustering over the actual data) — each original sub-vector is then replaced by the ID of its nearest codebook centroid (a single byte, if the codebook has 256 entries). This can achieve dramatic compression (a 1536-dimension, 6 KB float vector compressed to under 100 bytes is a realistic ratio) since each sub-vector is now represented by a single small code rather than its original floating-point values.

The tradeoff: PQ introduces real approximation error, since each sub-vector is now represented by its nearest codebook centroid rather than its exact original value — distance calculations between quantized vectors are themselves now approximate, not exact, which directly affects retrieval recall (per this track's vector-search lesson's evaluation methodology, this needs to be measured against real data and query patterns, not assumed acceptable). The codebooks also need to be learned from representative data (typically a sample of the actual vector distribution) before quantization can be applied — a codebook trained on unrepresentative data will compress poorly for the actual vectors it's later applied to.

## Combining quantization with indexing: IVF-PQ

This track's vector-search lesson mentioned IVF-PQ as a common combination: IVF (Inverted File Index) clusters the vector space to narrow a search to relevant partitions before doing a finer-grained comparison, and PQ compresses the vectors within each partition to keep memory footprint low even as partition count and total vector count grow. This combination directly addresses vector search at genuinely massive scale (hundreds of millions to billions of vectors), where neither clustering alone (still requiring full-precision vectors for the fine-grained comparison step) nor quantization alone (still requiring an exhaustive or near-exhaustive scan without clustering to narrow the search space) would be sufficient on its own.

## Binary quantization: the most aggressive common option

**Binary quantization** reduces each dimension to a single bit (typically, whether the original value is above or below zero, or some other threshold), achieving an extreme 32x compression ratio (32-bit float to 1-bit) at the cost of the most significant approximation error among the common quantization techniques. This is appropriate specifically when memory constraints are severe enough to justify a larger quality tradeoff, often used as a fast, cheap first-pass filter (quickly narrowing a huge candidate set using binary-quantized vectors' fast Hamming-distance comparison) followed by a more precise re-ranking pass over the (much smaller) filtered candidate set using full-precision or less-aggressively-quantized vectors — directly analogous to the two-stage retrieval-then-reranking pattern from this track's hybrid-search-and-reranking lesson, but applied to precision level rather than retrieval method.

## A worked example

**Scenario:** a semantic search system needs to index 500 million product embeddings, where the full-precision memory footprint would be prohibitively large for the available infrastructure budget.

- **IVF-PQ is chosen** as the base indexing approach, since pure HNSW at full precision would require an infeasible amount of memory at this scale (500 million × ~6 KB ≈ 3 TB for raw vectors alone, before index overhead) — IVF's clustering narrows the search space, and PQ's compression keeps the per-vector memory footprint manageable even at this count.
- **PQ codebooks are trained on a representative sample** of the actual product embedding distribution (not a synthetic or unrelated sample), specifically because codebook quality directly determines compression quality for the real data it will later be applied to.
- **Recall is validated against a labeled eval set** (following the methodology from this track's embedding-model-evaluation lesson) comparing full-precision and PQ-compressed retrieval on the same queries, confirming the compression's recall impact is acceptable for this product's actual quality bar before committing to it in production — not assumed acceptable purely from the compression ratio looking reasonable on paper.
- **A two-stage approach is layered on top for the highest-traffic queries**: an initial fast pass over binary-quantized vectors narrows candidates aggressively, followed by re-ranking that smaller candidate set using the less-aggressively-quantized PQ vectors — balancing speed and precision similarly to the hybrid-search-and-reranking lesson's two-stage pattern, but for precision level rather than retrieval method.

## Common mistakes

- **Applying aggressive quantization (PQ or binary) without measuring the actual recall impact against real queries and labeled relevant results.** Compression ratio alone doesn't indicate retrieval quality impact — this needs to be validated empirically, following the same evaluation discipline as embedding model selection itself.
- **Training quantization codebooks on unrepresentative or insufficient sample data**, producing compression that performs worse in production than validation suggested, since the codebook doesn't actually capture the real data distribution's structure well.
- **Defaulting to the most aggressive quantization available "to save memory," without checking whether a less aggressive option (scalar quantization, or no quantization at all) would already fit the actual infrastructure budget** — quantization aggressiveness should match the actual memory constraint, not be maximized by default at unnecessary cost to retrieval quality.
