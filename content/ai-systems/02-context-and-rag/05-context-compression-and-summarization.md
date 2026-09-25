---
title: "Context Compression and Long-Document Summarization for RAG"
short_title: "Context Compression"
tags: ["rag", "context-compression", "summarization", "retrieval"]
sources:
  - "LangChain Contextual Compression Retriever documentation"
  - "LLMLingua / LongLLMLingua papers (Microsoft Research)"
  - "\"Lost in the Middle: How Language Models Use Long Contexts\" (Liu et al., 2023)"
  - "LlamaIndex Response Synthesis / Refine and Tree Summarize documentation"
---

## The problem compression solves

Retrieval often returns more relevant text than fits — or should fit — into the generation prompt. Stuffing every retrieved chunk verbatim into context has two costs beyond token price: the **"lost in the middle"** effect (Liu et al., 2023), where models attend reliably to the start and end of a long context but degrade on information buried in the middle, and simple noise dilution, where irrelevant sentences inside an otherwise-relevant chunk compete for the model's attention against the actual answer. Context compression is the general term for reducing retrieved content to what's load-bearing before it reaches the generator, without losing the facts needed to answer.

## Extractive compression: contextual compression retrievers

The simplest form wraps a base retriever with a **compressor** that filters or trims each retrieved document against the query *after* retrieval. LangChain's `ContextualCompressionRetriever` composes a base retriever with a `DocumentCompressor` — options range from an `LLMChainExtractor` (asks an LLM to extract only the sentences relevant to the query from each chunk) to an `LLMChainFilter` (a cheaper binary keep/discard per document) to embedding-based filters that drop chunks below a similarity threshold. This is extractive: it removes text, it doesn't rewrite it, so it's cheap to trust (no hallucination risk from the compression step itself) but is bounded by chunk boundaries chosen at index time — it can't recombine information split across chunks.

## Prompt-level token compression: LLMLingua

**LLMLingua** and **LongLLMLingua** (Microsoft Research) take a more aggressive approach: use a small language model to score each token's information content (perplexity-based) and drop low-information tokens directly, achieving up to 20x compression while claiming minimal task-performance loss on long-context QA and summarization benchmarks. LongLLMLingua specifically targets the RAG setting — it reorders and compresses retrieved documents to counteract the lost-in-the-middle effect, pushing the most question-relevant content toward the positions the model attends to best. This is a fundamentally different mechanism from extractive filtering: it operates at token granularity guided by a language model's own uncertainty signal, not by sentence-level relevance to the query.

## Abstractive compression: summarization

Where extraction isn't enough — e.g., a retrieved document is long and only its gist matters — **abstractive summarization** rewrites content into a shorter form rather than selecting from it. For RAG over long documents, two synthesis patterns dominate (both implemented directly in LlamaIndex's response synthesis module):

- **Refine**: process retrieved chunks sequentially, maintaining a running answer that gets updated (refined) as each new chunk is considered. Cheap in parallel compute but sequential in latency, and early chunks can anchor the answer in ways later chunks struggle to correct.
- **Tree summarize** (map-reduce over chunks): summarize each chunk independently in parallel, then recursively summarize the summaries until they fit in one context window. Parallelizable and less order-sensitive than refine, at the cost of more total LLM calls.

For long single documents (a contract, a research paper) exceeding context limits outright, **hierarchical summarization** — chunk, summarize each chunk, summarize the summaries, recursively — is the standard pattern for producing a document-level summary an LLM couldn't otherwise ingest in one pass, and is separately useful as a pre-indexed artifact: storing a summary alongside raw chunks lets a retriever match on the gist even when no single chunk contains the queried fact.

## Compression as a retrieval-time vs. index-time decision

Compression can happen at index time (pre-summarizing documents into a `summary` field retrievable alongside raw chunks, e.g., LlamaIndex's document summary index) or at retrieval time (compressing whatever was just retrieved, before it hits the prompt). Index-time compression is reusable across queries and amortizes cost, but it's fixed — it can't tailor the summary to a specific question. Retrieval-time compression is query-aware and therefore more precise, but it adds latency on every request since it can't be precomputed.

## Common mistakes

- **Compressing before checking whether the corpus actually causes context overflow.** If retrieved content already fits comfortably and isn't causing lost-in-the-middle degradation, compression only adds latency and a new failure mode (over-aggressive extraction dropping the answer).
- **Using LLM-based extraction/filtering without capping cost.** Contextual compression retrievers issue one LLM call per retrieved chunk by default — at scale this can cost more than the generation call it's meant to make cheaper.
- **Assuming abstractive summarization preserves numbers and named entities reliably.** Summarization models are prone to dropping or blurring specific figures; for fact-critical RAG (legal, financial), prefer extractive or token-level compression over free-form rewriting.
- **Ignoring reordering.** Even without dropping any tokens, simply placing the most relevant retrieved chunk at the start or end of context (rather than mid-list) measurably improves answer accuracy given the lost-in-the-middle effect.
