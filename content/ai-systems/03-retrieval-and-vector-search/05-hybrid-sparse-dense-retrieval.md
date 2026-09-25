---
title: "Hybrid Retrieval: Combining BM25 and Dense Embeddings with Fusion"
short_title: "Hybrid Sparse+Dense Retrieval"
tags: ["retrieval", "hybrid-search", "bm25", "rag", "fusion"]
sources:
  - "Robertson & Zaragoza, 'The Probabilistic Relevance Framework: BM25 and Beyond' (2009)"
  - "Cormack, Clarke & Buettcher, 'Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods' (SIGIR 2009)"
  - "Elasticsearch / OpenSearch hybrid search documentation"
  - "Weaviate and Qdrant hybrid search documentation"
---

## Why dense embeddings alone aren't enough

Dense retrieval (embedding similarity search) is excellent at **semantic matching** — it finds "the CEO stepped down" when you search "leadership change" even with zero shared words. But it's weaker on **exact-match signals**: product SKUs, error codes, acronyms, proper nouns, and rare terms the embedding model under-trained on. A query for "error code E0451" can retrieve semantically similar-sounding chunks that don't contain that exact string, while a lexical index nails it instantly. Hybrid retrieval combines both so the weaknesses of one are covered by the strength of the other.

## BM25: still the lexical baseline that works

**BM25** (Best Match 25) is a term-frequency/inverse-document-frequency scoring function — a refinement of TF-IDF that saturates term-frequency contribution (repeating a word 50 times doesn't make a document 50x more relevant) and normalizes for document length. It requires no training, no GPU, and is exact — it will always find documents containing the literal query tokens. Modern search infra (Elasticsearch, OpenSearch, Lucene-based systems, and Postgres's `ts_rank` with tsvector) implements it natively, so pairing it with a vector store isn't exotic infrastructure — it's usually already available.

## Fusion methods: combining two ranked lists

The core problem: BM25 and dense search return two independently-scored ranked lists with **incomparable score scales** (BM25 scores are unbounded and corpus-dependent; cosine similarity is bounded [-1, 1] or [0, 1]). You can't just add the raw scores. Two main approaches:

**Reciprocal Rank Fusion (RRF)** ignores scores entirely and works purely on rank position:

```
RRF_score(d) = sum over each ranker r of  1 / (k + rank_r(d))
```

where `k` is a constant (commonly 60, from the original paper) that dampens the influence of very high ranks. A document ranked #1 in both lists gets a high combined score; a document that appears in only one list still contributes, just less. RRF's appeal is that it needs **no score normalization and no training** — it's a pure rank-position heuristic, robust across wildly different scoring distributions, and it's the default hybrid strategy in Weaviate, Qdrant, and OpenSearch's hybrid query.

**Weighted score combination (alpha blending)** normalizes both score sets (typically min-max or z-score normalization within the retrieved candidate set) and combines them as `alpha * dense_score + (1 - alpha) * sparse_score`. This gives more explicit control — you can tune `alpha` toward semantic or lexical weighting per use case — but it's more fragile: normalization is sensitive to the candidate set composition, and the right `alpha` is often corpus- and query-type-dependent, requiring offline tuning against a labeled eval set.

## Re-ranking as a second stage

Both fusion methods are typically used to produce a **candidate set** (e.g., top 100 from each retriever, fused down to top 20-50), which then feeds a **cross-encoder reranker** (e.g., a `bge-reranker` or Cohere Rerank model) that scores each (query, document) pair jointly rather than via separate embeddings. Cross-encoders are far more accurate than bi-encoder cosine similarity because they let the query and document attend to each other directly, but they're too slow to run over the full corpus — hence the two-stage retrieve-then-rerank pipeline, where hybrid fusion supplies a higher-quality candidate set than either retriever alone.

## When hybrid search matters most

- **Domain-specific terminology**: legal, medical, and code search where exact term matches (statute numbers, drug names, function names) carry disproportionate signal that embeddings compress away.
- **Short or keyword-heavy queries**: dense embeddings trained mostly on natural-language pairs tend to underperform on queries that are just a few keywords or an ID.
- **Long-tail entities**: names, IDs, and rare terms an embedding model saw rarely during training end up poorly separated in embedding space, while BM25 handles them exactly by construction.

## Common mistakes

- **Fusing scores directly without normalization.** Adding a BM25 score of 12.4 to a cosine similarity of 0.83 produces a combined score dominated entirely by whichever has the larger numeric range — usually BM25 drowns out the dense signal.
- **Skipping BM25 index maintenance.** Lexical indexes need tokenization/analyzer choices (stemming, stopwords, synonyms) that get set once and forgotten; a mismatched analyzer between indexing and query time silently kills recall.
- **Assuming hybrid always beats dense-only.** For queries that are genuinely paraphrastic with no lexical overlap, BM25 contributes noise, not signal — hybrid should be validated against a dense-only baseline on your actual query distribution, not assumed to be strictly better.
- **Running full reranking over hundreds of candidates.** Cross-encoder rerankers cost roughly O(candidates) in latency since each pair needs a forward pass; rerank the fused top 20-50, not the raw top 100+100 from both retrievers.
