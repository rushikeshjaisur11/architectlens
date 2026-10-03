---
title: "Query Rewriting, Expansion, and HyDE"
short_title: "Query Rewriting & HyDE"
tags: ["rag", "query-rewriting", "hyde", "retrieval"]
sources:
  - "\"Precise Zero-Shot Dense Retrieval without Relevance Labels\" (Gao et al., 2022 — the HyDE paper)"
  - "\"Query Rewriting for Retrieval-Augmented Large Language Models\" (Ma et al., 2023)"
  - "LangChain MultiQueryRetriever documentation"
  - "Microsoft/Bing classic query expansion literature (pseudo-relevance feedback background)"
banner:
  layout: line
  nodes:
    - [user, "question"]
    - [model, "rewrite"]
    - [db, "retrieve"]
    - [doc, "answer"]
predict:
  question: "A user types \"stop billing me\". The best document matches \"how do I cancel my subscription\" strongly but the literal query weakly. A multi-query retriever generates three phrasings, one of them the cancel phrasing. What happens to that document?"
  options: ["It is dropped, because the union of results keeps only the literal query's hits", "It is retrieved through the cancel variant and merged into the combined results", "It is retrieved only after the reranker rewrites the original query itself"]
  answer: 1
  why: "Each variant is searched independently and the results are unioned, so a document weak for one phrasing can still be recovered by another."
check:
  - q: "Why is HyDE a poor fit for a narrow lookup like \"what is the capital of France\"?"
    options: ["The hypothetical document can state a wrong or generic answer that pulls retrieval off target", "HyDE only works on queries longer than the documents it is searching against", "The hypothetical document is shown to the user, so it must be factually correct"]
    answer: 0
    why: "The query is already a strong retrieval signal there. HyDE helps most on short, underspecified conceptual queries."
  - q: "A team merges results from five expanded queries and feeds them straight to generation. What goes wrong?"
    options: ["Recall drops, since merging results from several queries removes relevant chunks", "Latency falls, since five queries are answered with a single generation call", "Near-duplicate chunks inflate the context and push out distinct relevant ones"]
    answer: 2
    why: "Expansion should be paired with deduplication and reranking before generation."
  - q: "A rewriter sees only the current turn \"what about the next one\". What is the likely outcome?"
    options: ["It cannot resolve the reference, so the rewritten query stays ambiguous", "It guesses the product name correctly, since the corpus vocabulary hints at it", "It skips rewriting and passes the literal text, which is always equivalent"]
    answer: 0
    why: "A rewriter needs the same conversation history a human would need to disambiguate the question."
---

## Why the raw user query is often the wrong retrieval input

Embedding a user's literal query and searching against it assumes the query and the relevant document use similar language — but real questions are often short, ambiguous, colloquially phrased, or conversationally dependent on prior turns, while the documents that answer them are written in a different register (formal, technical, third-person). This asymmetry is the core motivation for the family of techniques that transform the query *before* it hits the retriever, rather than assuming the raw input is already a good search query.

## Query rewriting

**Query rewriting** uses an LLM to reformulate the user's question into a version better suited for retrieval — resolving pronouns and ellipsis from conversation history ("what about the next one" → "what is the pricing for the Pro plan"), correcting ambiguous phrasing, or restating a colloquial question in terms closer to the target corpus's vocabulary. Ma et al. (2023) frame this explicitly as a trainable step between the user and the retriever — a small "rewriter" model (or an LLM prompted for the task) sits before retrieval, optimized (via prompting or fine-tuning with feedback from downstream QA performance) specifically to produce retrieval-friendly queries rather than to answer the question itself. This matters most in multi-turn conversational RAG, where the literal last message is frequently not self-contained.

## Query expansion / multi-query retrieval

Rather than picking one reformulation, **query expansion** generates several variants of the query and retrieves for each, then merges (usually deduplicates and unions, sometimes reciprocal-rank-fuses) the results. LangChain's `MultiQueryRetriever` implements this directly: an LLM generates N alternative phrasings of the input question, each is embedded and searched independently, and the union of retrieved documents is passed downstream. This mitigates the risk of any single phrasing missing relevant documents due to embedding-space quirks — a document might be a strong match for "how do I cancel my subscription" but a weak match for the user's literal "stop billing me," and generating both variants recovers documents either alone would miss. The cost is straightforward: N embedding searches instead of one, and more candidate documents that then usually need reranking to cut back down before generation.

## HyDE: Hypothetical Document Embeddings

**HyDE** (Gao et al., 2022) inverts the usual direction of embedding comparison. Instead of embedding the query and comparing it against document embeddings, HyDE prompts an LLM to generate a *hypothetical answer* to the query — a fabricated passage that looks like what an ideal answer document would contain, with no requirement that it be factually correct — and embeds *that* hypothetical document to search against the corpus. The insight: document-to-document semantic similarity is a better-behaved match than query-to-document similarity, because a hypothetical answer is written in the same register and level of detail as real answer documents, closing the asymmetry a short question has against a long passage. This is a zero-shot technique — no relevance-labeled training data needed — and the paper reports it competitive with, and in some cross-lingual/low-resource settings better than, contrastively fine-tuned dense retrievers, without any retrieval-specific fine-tuning. It costs one extra LLM generation call per query before the embedding step, and the hypothetical document is discarded after embedding — it's never shown to the user or used as a source, since it isn't grounded in the actual corpus.

## Choosing among them

These techniques compose rather than compete: a conversational system might rewrite the query for context resolution, then apply HyDE or multi-query expansion on the rewritten query before retrieval. As a rough guide: query rewriting is the right first step whenever the input is conversational or noisy; multi-query expansion helps when recall (not missing relevant documents) is the priority and the corpus has real linguistic diversity in how the same fact is phrased; HyDE helps most when the query is short/underspecified relative to the target documents' length and register (e.g., short factual questions against long technical documents), and least when the query is already detailed and close in style to the corpus.

## Common mistakes

- **Applying HyDE to factual, entity-specific queries.** A hypothetical document for "what is the capital of France" can hallucinate a wrong or generic answer that pulls retrieval toward an unrelated passage; HyDE helps most for conceptual/descriptive queries, not narrow factual lookups where the query itself is already a strong retrieval signal.
- **Skipping deduplication/reranking after multi-query expansion.** Merging results from N queries without deduplication inflates context with near-duplicate chunks and pushes out genuinely distinct relevant ones — expansion should be paired with reranking, not fed straight to generation.
- **Rewriting without access to conversation history.** A rewriter given only the current turn can't resolve references that depend on prior turns; it needs the same context a human would need to disambiguate the question.
- **Treating these as free.** Every added LLM call (rewrite, expand, HyDE generation) is added latency and cost before retrieval even starts — justify each stage against a measured recall/precision gain, not by default.
