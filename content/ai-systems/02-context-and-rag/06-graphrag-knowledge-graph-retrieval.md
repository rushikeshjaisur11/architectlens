---
title: "GraphRAG and Knowledge-Graph-Augmented Retrieval"
short_title: "GraphRAG"
tags: ["rag", "graphrag", "knowledge-graph", "retrieval"]
sources:
  - "Microsoft Research: \"From Local to Global: A Graph RAG Approach to Query-Focused Summarization\" (Edge et al., 2024)"
  - "Microsoft GraphRAG open-source project documentation (microsoft/graphrag on GitHub)"
  - "Neo4j GraphRAG documentation and LangChain Neo4j integration docs"
  - "LlamaIndex Knowledge Graph Index / Property Graph Index documentation"
---

## What vector RAG structurally can't answer

Standard vector RAG retrieves chunks by semantic similarity to a query, which works well for localized questions ("what does clause 4.2 say") but fails on **global, aggregative questions** that require synthesizing information scattered across many documents — "what are the main themes across this entire corpus," or "how are entity A and entity B connected." No single chunk contains that answer, and no similarity search surfaces the right *set* of chunks reliably, because the connections between facts, not any one fact, are what's being asked about. GraphRAG addresses this by building an explicit structured representation of entities and relationships at index time, so retrieval can traverse relationships instead of only matching text similarity.

## Microsoft's GraphRAG: the reference architecture

Microsoft Research's GraphRAG paper (Edge et al., 2024) formalized the now-common pattern: an LLM extracts entities and relationships from source documents into a **knowledge graph**, then applies community detection (typically the **Leiden algorithm**) to partition the graph into hierarchical clusters of closely related entities. Each community gets an LLM-generated summary at index time. At query time, GraphRAG offers two retrieval modes:

- **Local search**: for questions about specific entities, traverse the graph outward from matched entities to gather their relationships and related text — similar in spirit to vector RAG but grounded in graph structure rather than pure embedding similarity.
- **Global search**: for corpus-wide questions, run map-reduce over the pre-computed community summaries (each is queried in parallel, then results are aggregated) rather than searching raw chunks — this is what makes "summarize the main themes of this corpus" answerable at all, since the community summaries already encode corpus-wide structure that no single chunk holds.

This index-time cost (LLM calls to extract entities/relations, then to summarize every community) is GraphRAG's main tradeoff: building the graph is expensive and slow compared to just chunking and embedding, and it needs to be rebuilt or incrementally updated as documents change.

## Property graphs vs. RDF-style knowledge graphs

Most production GraphRAG implementations (LlamaIndex's `PropertyGraphIndex`, Neo4j's GraphRAG integrations) use **property graphs** — nodes and edges each carrying arbitrary key-value attributes — rather than strict RDF triples, because property graphs let entities and relationships carry the extra metadata (source chunk, confidence, timestamps) that real extraction pipelines need. Neo4j is the most common backing store in production stacks, combining native graph traversal (Cypher queries) with vector indexes on node embeddings, so a single system supports both graph traversal and standard similarity search — hybrid graph+vector retrieval, not graph *instead of* vector.

## When graph structure earns its cost

GraphRAG is not a universal upgrade over vector RAG — it's a targeted answer to a specific failure mode. It's worth the index-time and query-time complexity when:

- Queries are genuinely relational ("how does X relate to Y," "what connects these entities") rather than fact-lookup.
- Queries are aggregative/global across a large corpus, where no single passage is the answer.
- The domain has a naturally graph-shaped structure the LLM extraction can capture reliably (org charts, supply chains, citation networks, regulatory clause cross-references).

It's the wrong tool when queries are simple fact retrieval over well-chunked documents — vector RAG is cheaper, simpler to maintain, and just as accurate for that case, and the entity/relationship extraction step introduces its own error source (LLM extraction is imperfect and can hallucinate or miss relationships, silently corrupting the graph a query later trusts).

## Common mistakes

- **Building a knowledge graph for a corpus of simple fact-lookup queries.** The extraction and community-summarization cost buys nothing if global/relational questions never actually occur.
- **Treating LLM-extracted relationships as ground truth.** Entity/relationship extraction has real error rates; graphs built from it should be validated or spot-checked, not assumed correct because they came from a structured pipeline.
- **Choosing pure graph traversal over hybrid graph+vector.** Most production systems (Neo4j GraphRAG, LlamaIndex PropertyGraphIndex) combine both — graph traversal for relational structure, vector search for semantic matching — rather than picking one exclusively.
- **Underestimating reindexing cost.** Unlike appending new chunks to a vector index, adding documents to a knowledge graph can require recomputing entity resolution and community detection, which doesn't scale as an incremental, low-latency operation the way vector upserts do.
