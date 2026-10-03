---
title: "Designing a Semantic Search Service"
short_title: "Semantic Search Service"
tags: ["search", "embeddings", "vector-search", "hybrid", "design"]
sources:
  - "Karpukhin et al., 'Dense Passage Retrieval for Open-Domain Question Answering' (2020)"
  - "Public documentation of vector databases and search engines on hybrid retrieval and filtering"
  - "Cormack, Clarke and Buettcher, 'Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods' (SIGIR 2009)"
  - "Embedding model comparison roundups and benchmarks, 2026 (secondary: premai.io, mixpeek.com); Anthropic, Contextual Retrieval (fetched Oct 2026); pgvector documentation"
banner:
  layout: line
  nodes:
    - [doc, "content"]
    - [model, "embed"]
    - [db, "ANN index"]
    - [user, "results"]
predict:
  question: "A user searches \"laptop won't charge after update\". Vector search ranks \"Battery not detected after BIOS update\" high, sharing no words with the query, while keyword search puts \"Charging indicator blinking orange\" first. After rank fusion, which article leads?"
  options: ["The charging indicator article, because it matches the exact query words", "The BIOS article, as it appears in both ranked lists", "Neither, because fusion first needs calibrated scores from both lists"]
  answer: 1
  why: "Reciprocal rank fusion sums 1 over (constant plus rank) across lists and needs no score calibration, so the BIOS article wins by appearing in both lists."
check:
  - q: "Why is mixing vectors from two embedding models in one index dangerous?"
    options: ["It silently ruins results, so you need a second index", "It raises memory per vector but leaves result quality as it was", "It breaks only the keyword side of the hybrid search"]
    answer: 0
    why: "Everything in the index is tied to its embedding model; mixing models gives meaningless distances without any error, so you build a new index and cut over."
  - q: "Why must a selective metadata filter be applied inside the vector search rather than after it?"
    options: ["Post-filtering is always slower than the embedding step itself", "Post-filtering removes the delta index from the search path", "Filtering after retrieval can leave almost nothing from the top k"]
    answer: 2
    why: "If the filter runs after the top-k is taken, most candidates may be dropped and the page comes back nearly empty."
  - q: "Why run vector and keyword search together instead of vector search alone?"
    options: ["Keyword search is faster, so it can replace the reranking stage", "Vectors blur exact tokens like codes, which keywords catch", "Vector search cannot handle paraphrased queries at all well"]
    answer: 1
    why: "Dense vectors catch paraphrases but blur exact strings, while BM25 does the opposite, so fusing both covers each other's gaps."
---

## The problem

Keyword search fails when users describe what they mean rather than the words a document uses ("how do I get my money back" versus a page titled "Refund policy"). A semantic search service finds results by **meaning**, returns them in tens of milliseconds, and exposes search as a reusable platform for many teams' products.

## Step 1: Requirements

- **Functional:** search over text (and later images) with filters, pagination, and result snippets; an indexing API for producers.
- **Quality:** high recall on paraphrases, but exact identifiers (error codes, SKUs, names) must still match.
- **Latency:** p95 under 100 ms for retrieval, 300 ms with reranking.
- **Scale (example):** 200 million items, 1,000 queries per second, updates visible within a minute.

## Step 2: Architecture

- **Indexing path:** producers send documents to an ingest API; a queue buffers them; embedding workers batch-compute vectors; an index writer upserts vectors and keyword fields into a sharded index.
- **Query path:** query understanding (normalize, optionally expand) goes to a retrieval layer that runs **both** a vector search and a keyword search in parallel, fuses the lists, optionally reranks the top few dozen, applies business rules, and returns results.

## Step 3: Choosing and operating the embedding model

The embedding model is a long-lived decision. Everything in the index is tied to it. Consider quality on your own data, dimensions (memory and speed), languages, maximum input length and cost. **Version the model and the index together.** To change models you build a second index and cut over; mixing vectors from two models in one index silently destroys results.

## Step 4: The vector index

At 200 million vectors an exact scan is impossible, so use an **approximate nearest neighbour** index.

- **HNSW** gives excellent recall and speed but keeps the graph in RAM.
- **IVF with product quantization** compresses heavily and fits more per machine, with lower recall.
- **Disk-based graph indexes** keep most data on SSD to cut memory cost.

Shard by document id so each shard holds a slice and queries fan out to all shards, then merge. Replicas add read throughput and availability. Memory per vector multiplied by count sets the machine budget: 768 floats at 4 bytes is about 3 KB, so 200 million vectors is around 600 GB raw, which is why quantization matters.

## Step 5: Hybrid retrieval and fusion

Dense vectors catch paraphrases but blur exact tokens. Keyword scoring (BM25) catches exact strings but misses meaning. Run both and merge the ranked lists with **reciprocal rank fusion**, which needs no score calibration: each document's fused score is the sum of 1 divided by (a constant plus its rank) across lists. A cross-encoder reranker then reads the query with each of the top candidates for precise ordering, at higher cost per item, so it runs only on the shortlist.

## Step 6: Filters and freshness

- **Metadata filters** (language, product, date, tenant) must be applied **inside** the search, not after, or a selective filter returns almost nothing. Index the filterable fields and use a filter-aware search mode.
- **Freshness:** writes go to a small, fast, in-memory delta index that is searched together with the large main index, and merged into it periodically. Deletes are recorded as tombstones applied at query time until the merge.

## Step 7: Quality and operations

- **Offline metrics:** recall@k and nDCG against labelled query-document pairs, run for every model, index or ranking change.
- **Online metrics:** click-through, reformulation rate (users rewriting the query signals failure), zero-result rate.
- **Monitoring:** embedding drift (live query distribution versus the index), latency percentiles per stage, index size and shard imbalance.

## A worked example

**Scenario:** a user searches "laptop won't charge after update" in a support knowledge base.

1. The query is embedded; keyword search extracts the terms.
2. Vector search returns an article titled "Battery not detected after BIOS update" (no shared words). Keyword search returns "Charging indicator blinking orange".
3. Fusion ranks the BIOS article first because it ranks high in the vector list and appears lower in the keyword list; the charging indicator article ranks second.
4. The reranker confirms the BIOS article answers the question, and the first result shows a snippet highlighting the relevant sentence.
5. The user clicks it and does not reformulate: a success signal logged for evaluation.

## Enterprise practice (verified October 2026)

**Basics.** Embed documents and queries, index with ANN, return nearest neighbours, rerank (steps above).

**Choosing and operating the embedding layer (2026).** Leading embedding families include Google's Gemini Embedding (top of the MTEB multilingual leaderboard at its March 2025 release with a task mean of about 68), Voyage, Cohere Embed v4 (multimodal) and open models such as Qwen3 embedding variants; the differences among leaders on public leaderboards are small, so decide on **domain accuracy, dimension, price per million tokens, latency, multilingual coverage and licence**. Dimension matters operationally: pgvector's HNSW index supports up to about 2,000 dimensions for full-precision vectors, and many models offer shortened (Matryoshka-style) or quantised vectors that cut memory with modest quality loss.

**Quality levers in order of payoff.** (1) Hybrid retrieval (BM25 plus vectors) with reciprocal-rank fusion, (2) a cross-encoder reranker, (3) contextual chunk enrichment (Anthropic reported failure-rate reductions from 5.7% to 1.9% with embeddings, BM25 and reranking combined on its test sets), (4) query rewriting and expansion, (5) domain fine-tuning of the embedder.

**Enterprise pattern.** Build a labelled relevance set from real queries and clicks; track recall at k, nDCG and zero-result rate by language and segment; store the embedding model version with every vector; plan model changes as a dual-index migration (index new, compare, cut over, retire); and add query-time filters and ACLs without hurting recall (test with filtered queries specifically).

## Common mistakes

- **Vector-only retrieval**, which loses exact matches on codes and names.
- **Post-filtering selective filters**, returning empty or partial pages.
- **Mixing embedding model versions** in one index.
- **No delta index**, so new documents wait for a full rebuild.
- **Tuning by eyeballing** a few queries instead of a labelled set.
