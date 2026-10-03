---
title: "Advanced Retrieval: Hybrid Search and Reranking"
short_title: "Hybrid Search and Reranking"
tags: ["rag", "retrieval", "reranking", "hybrid-search"]
sources:
  - "Pinecone and Weaviate documentation on hybrid search"
  - "Cohere documentation on rerank models"
---

## Why pure vector search alone often isn't enough

Basic RAG (covered in this track's RAG fundamentals lesson) retrieves chunks by semantic similarity via vector embeddings. This works well for conceptual, meaning-based queries, but has a real weakness: embeddings capture semantic similarity, not exact term matching, so a query containing a specific product code, an exact name, or a rare technical term can fail to retrieve a document that contains that exact term but whose overall semantic embedding doesn't happen to be the closest match — the exact string is present, but semantic similarity alone doesn't reliably surface it. This is the same tension covered in this track's system-design counterpart lesson on search and retrieval, between keyword precision and semantic recall.

## Hybrid search: combining keyword and vector retrieval

**Hybrid search** runs both a traditional keyword search (often BM25, per the search-and-retrieval lesson) and a vector similarity search over the same corpus, then merges the two ranked result lists into a single combined ranking. This captures both retrieval modes' strengths: BM25 reliably surfaces exact-term matches (product codes, names, specific terminology) that a vector search might rank low despite their obvious relevance, while vector search catches conceptually related content that shares no exact wording with the query.

The merging step needs its own method, since BM25 scores and vector similarity scores aren't on comparable scales. **Reciprocal Rank Fusion (RRF)** is a common, simple approach: rather than trying to combine raw scores directly, it combines each result's *rank position* in each list, weighting higher ranks more heavily — a document ranked highly by either method contributes meaningfully to its combined score, without needing the two scoring systems to be numerically comparable.

## Reranking: a second, more expensive pass for precision

Initial retrieval (whether keyword, vector, or hybrid) typically needs to be fast enough to search across potentially millions of documents, which limits how sophisticated the relevance scoring can be at that stage. **Reranking** adds a second stage: take the top-k candidates from initial retrieval (a much smaller set, say 50-100) and score them with a more computationally expensive, more accurate model — often a cross-encoder, which processes the query and each candidate document together (rather than independently, as embedding-based retrieval does), letting it capture more nuanced relevance signals at the cost of being too slow to run over an entire corpus directly.

This two-stage pattern — fast, approximate retrieval over the full corpus, followed by slow, precise reranking over a small candidate set — is a standard tradeoff pattern in information retrieval generally, not unique to RAG: get a manageable candidate set cheaply, then spend more compute where it counts, on the much smaller set that actually needs precise ranking.

## Why reranking measurably improves RAG quality

Embedding-based retrieval's similarity scoring is a fairly coarse signal — it captures overall semantic closeness but can miss finer-grained relevance distinctions (e.g., a document that's topically related but doesn't actually answer the specific question asked, versus one that directly addresses it). A cross-encoder reranker, processing the query and candidate jointly, can make this finer distinction more reliably, which matters directly for RAG quality: the chunks that make it into the final context sent to the LLM determine what the model can ground its answer in, so improving precision at this stage — filtering out topically-similar-but-not-actually-relevant chunks — measurably reduces the model's chance of generating an answer based on the wrong (or a merely tangentially related) passage.

## A worked example

**Scenario:** a legal document search RAG system, where queries often reference specific case numbers, statute citations, or exact legal terms, alongside more conceptual questions ("what's the precedent for X").

- **Hybrid retrieval** is close to essential here, not optional: a query containing a specific citation needs BM25's exact-term matching to reliably surface the document containing that citation, while a conceptual question about precedent benefits from vector search's semantic matching — relying on either alone would systematically fail one of these two common query types.
- **Reranking** is layered on top because legal relevance is nuanced — two documents can both mention the same statute, but only one actually applies it to a factually similar situation, a distinction a cross-encoder reranker is better positioned to make than the coarser initial retrieval scoring.
- **Cost tradeoff, made deliberately**: reranking the full corpus directly would be prohibitively slow, but reranking only the top 50 hybrid-search candidates keeps the added latency and compute cost bounded and predictable, regardless of overall corpus size — this is exactly the two-stage pattern's purpose, and the candidate-set size (50, in this case) is a tunable parameter balancing reranking quality against added latency.

## Common mistakes

- **Relying purely on vector search for a domain where exact terms (codes, names, IDs) are common in queries.** This is a predictable, systematic gap — not a rare edge case — for any domain with meaningful structured terminology, and hybrid search exists specifically to close it.
- **Skipping reranking and assuming initial retrieval's top-k is already well-ordered.** Initial retrieval is optimized for being fast over a large corpus, not for being maximally precise on a small candidate set — treating its raw output as final ranking leaves a real quality improvement on the table for a comparatively small amount of added latency.
- **Reranking too large a candidate set**, unnecessarily inflating latency and cost for the reranking stage — the value of reranking comes from applying a more expensive, more accurate model to a deliberately small, already-relevant candidate set, not from trying to run it over an unnecessarily large slice of the corpus.
