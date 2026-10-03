---
title: "Chunking Strategies: Fixed-Size, Semantic, Recursive, and Sentence-Window"
short_title: "Chunking Strategies"
tags: ["rag", "chunking", "retrieval", "foundations"]
sources:
  - "LangChain Text Splitters documentation"
  - "LlamaIndex Node Parsers / Chunking documentation"
  - "Greg Kamradt's 5 Levels of Text Splitting (deeplearning.ai / YouTube)"
  - "Pinecone Chunking Strategies guide"
---

## Why chunking determines retrieval quality before anything else runs

Chunking splits a source document into the units a retriever indexes and a generator receives. Every downstream choice — embedding model, reranker, prompt — operates on whatever a chunker decided was "one piece of context." Chunk too large and irrelevant text dilutes the embedding, hurting retrieval precision; chunk too small and you lose the surrounding context a passage needs to be understood, hurting generation quality even when retrieval is correct. There's no universal chunk size — the right choice depends on document structure, embedding model context limits, and how atomic the underlying facts are.

## Fixed-size chunking

The baseline: split text every N tokens or characters, usually with an **overlap** (commonly 10-20% of chunk size) so a sentence straddling a boundary isn't fully lost from either chunk. Simple, fast, and library-supported everywhere (`CharacterTextSplitter` in LangChain). Its weakness is that it's blind to structure — it will cut a sentence, a table row, or a code block in half with no regard for meaning. It works acceptably on homogeneous prose but degrades on structured or heterogeneous documents (mixed markdown, code, tables).

## Recursive chunking

**Recursive character/text splitting** (LangChain's `RecursiveCharacterTextSplitter`, the most commonly deployed default) tries a prioritized list of separators — paragraph breaks, then sentence breaks, then words — recursively splitting on the first separator that yields chunks under the target size, falling back to finer separators only where needed. This keeps semantically coherent units (paragraphs, sentences) intact whenever the size budget allows, and only forces harder splits where a single paragraph exceeds the limit. It's a heuristic, not a semantic method — it doesn't know what the text *means*, only that paragraph boundaries are usually good split points — but it's the highest quality-to-cost default and is what most production RAG systems ship first.

## Semantic chunking

**Semantic chunking** splits based on meaning shifts rather than fixed structure: embed consecutive sentences, compute the cosine distance between adjacent sentence embeddings, and cut where the distance exceeds a threshold (a local maximum in "semantic distance" signals a topic change). LlamaIndex's `SemanticSplitterNodeParser` and Greg Kamradt's semantic chunking notebook popularized this approach. It produces chunks that are more topically coherent than recursive splitting, which matters for embedding quality — a chunk about one coherent idea embeds to a sharper point in vector space than one spanning two unrelated ideas. The cost is real: it requires an embedding call per sentence at index time (or a cheap proxy model), it's slower, and the threshold is a hyperparameter that needs tuning per corpus — too sensitive and you over-split into tiny fragments, too loose and you're back to arbitrary boundaries.

## Sentence-window retrieval

A different strategy entirely: index at **sentence granularity** (each chunk is a single sentence, giving very precise embedding matches), but at retrieval time, expand each hit to include a window of surrounding sentences (e.g., 2-3 before and after) before passing it to the generator. This decouples the unit of *matching* (small, precise) from the unit of *context* (larger, coherent) — a pattern implemented directly in LlamaIndex as `SentenceWindowNodeParser` + `MetadataReplacementPostProcessor`. It solves a real tension: small chunks retrieve more precisely (less noise diluting the embedding) but read poorly in isolation; sentence-window retrieval gets the precision of small chunks and the readability of large ones, at the cost of extra metadata bookkeeping (storing each sentence's position and neighbors) and slightly larger context payloads per hit.

## Choosing chunk size in practice

Chunk size interacts with the embedding model's effective context: most embedding models (e.g., `text-embedding-3-small`, BGE, E5) degrade when chunks approach their max token length because the pooled representation gets diluted across too many topics — 256-512 tokens is a common sweet spot for dense-passage retrieval, versus 100-200 tokens for precision-critical sentence-level matching. Document structure should override defaults where it exists: chunk by heading/section for structured docs (markdown, HTML), by function/class for code (tools like `RecursiveCharacterTextSplitter.from_language` respect syntax), and by row/table for tabular data rather than treating everything as flat prose.

## Common mistakes

- **Using one chunk size for a heterogeneous corpus.** Code, tables, and prose have different natural units; a single global chunk size forces a bad fit somewhere.
- **Skipping overlap on fixed-size chunking.** Zero overlap means facts spanning a chunk boundary are unrecoverable by either chunk's embedding.
- **Treating semantic chunking as strictly better.** It adds latency and a tunable threshold; for well-structured documents (docs with real headings), recursive chunking on structural separators often matches its quality for a fraction of the cost.
- **Optimizing chunk size without testing retrieval end-to-end.** Chunk size choices should be validated against an actual eval set (see RAG evaluation), not picked by intuition — the "best" size shifts with query type and corpus.
