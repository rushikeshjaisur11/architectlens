---
title: "Designing an Enterprise RAG Assistant"
short_title: "Enterprise RAG Assistant"
tags: ["rag", "enterprise", "retrieval", "permissions", "design"]
sources:
  - "Lewis et al., 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks' (2020)"
  - "Public vendor documentation on enterprise search connectors and document-level access control"
  - "Ragas project documentation on RAG evaluation metrics"
  - "Anthropic, 'Introducing Contextual Retrieval', anthropic.com/news/contextual-retrieval (fetched Oct 2026)"
  - "VentureBeat, 'Enterprise RAG rebuild: hybrid retrieval adoption tripled in Q1 2026' (survey-based, secondary)"
  - "OWASP Top 10 for LLM Applications 2025, LLM08 Vector and Embedding Weaknesses"
---

## The problem

A company wants employees to ask questions in plain language and get answers grounded in internal documents: wikis, tickets, contracts, drive files. The assistant must be **accurate, cite its sources, respect who is allowed to see what, and stay current** as documents change. It is the most common AI product pattern, and most failures come from the plumbing around the model, not the model.

## Step 1: Clarify requirements

- **Functional:** natural-language Q&A, citations with links, follow-up questions in a conversation, feedback buttons.
- **Quality:** answers must be supported by retrieved text. "I could not find that" beats a confident guess.
- **Security:** a user must never receive content from a document they cannot open. This is a hard requirement, not a quality goal.
- **Freshness:** a document edited in the morning should be answerable by the afternoon, deleted documents must disappear quickly.
- **Scale (example):** 2 million documents, 20,000 users, 50 queries per second at peak, answers in under six seconds.

## Step 2: High-level design

Two pipelines meet at an index.

**Ingestion (offline, continuous):** connectors pull documents from each source, a parser extracts text and structure, a chunker splits it, an embedding model turns chunks into vectors, and the chunks plus metadata land in a hybrid index (vector plus keyword).

**Query (online):** the user's question is rewritten with conversation context, retrieval finds candidate chunks filtered by the user's permissions, a reranker keeps the best few, the LLM answers using only those chunks, and the response is checked and returned with citations.

## Step 3: Ingestion in detail

- **Connectors** use each source's change feed (webhooks or incremental sync tokens) rather than re-crawling everything. Full re-crawl is a periodic safety net.
- **Parsing** is where quality is won or lost. Tables, headings and slides lose meaning if flattened. Keep headings as metadata and keep tables intact in one chunk.
- **Chunking** by document structure (sections), with a size target of a few hundred tokens and a little overlap, plus the document title and heading path prepended to each chunk so it makes sense alone.
- **Deduplication** by content hash, since the same text appears in many copies.
- **Metadata** on every chunk: source, document id, version, owner, last modified, and the **access control list (ACL)**.

## Step 4: Permission-aware retrieval

This is the design's defining constraint. Two approaches:

- **Filter at query time.** Store each chunk's allowed users or groups, and pass the user's identity and groups as a filter on every search. Simple and always current, but needs an index that filters efficiently and a fresh group membership lookup.
- **Post-filter after retrieval.** Retrieve more candidates then drop forbidden ones. Easy, but it can return too few results and risks leaking through scores or snippets if done carelessly.

Prefer pre-filtering inside the search. When a document's permissions change, an **ACL update event** must reach the index quickly; if it lags, the safe default is to deny. Never rely on the LLM to "not mention" restricted content: it must never see it.

## Step 5: Answer generation

The prompt contains the question, the retrieved chunks each labelled with an id, and instructions to answer only from them, to cite chunk ids, and to say so when the answer is not present. Afterwards verify that every citation id exists in the retrieved set and that quoted spans appear in the chunk. A weak model can still fabricate a citation, so check it mechanically.

## Step 6: Failure modes and how to handle them

- **Stale answers:** track document versions; show the last-modified date in citations.
- **Conflicting sources:** surface both with dates rather than silently picking one.
- **Retrieval misses:** log queries with low retrieval scores; they point to missing content or poor chunking.
- **Prompt injection from documents:** treat retrieved text as untrusted data. The assistant has no tools that can send data out.
- **Cost spikes:** cap context size, cache answers to identical questions per permission scope, route easy questions to a smaller model.

## Step 7: Evaluation

Build a golden set of real questions with the expected source documents. Measure **retrieval** (was the right chunk in the top k) separately from **generation** (was the answer faithful to the chunks and relevant). Run it on every change to chunking, embedding model or prompt, and track feedback ratings in production for drift.

## A worked example

**Scenario:** an engineer asks "What is our data retention period for EU customers?"

1. The query is rewritten to include the product context from earlier turns.
2. Retrieval runs with the engineer's group list as a filter. The legal policy document is visible to everyone; a draft memo restricted to the legal team is silently excluded.
3. Hybrid search returns 30 chunks; the reranker keeps 5. Two cite the current policy (version 4) and one cites an outdated version 2.
4. The model answers "30 days after account closure" citing version 4, and notes that version 2 said 90 days and was superseded, with dates.
5. Citation check passes. The user clicks thumbs up; the feedback is stored with the trace for later evaluation.

## Enterprise practice (verified October 2026)

**Basics.** Chunk, embed, retrieve top-k, generate with citations (steps above). A prototype that does this scores well on easy questions and fails quietly on real ones.

**What changes at enterprise scale (live-checked).**

- **Hybrid retrieval plus reranking is the default.** Anthropic's published Contextual Retrieval study (prepend a 50 to 100 token model-written context to each chunk before indexing) cut top-20 retrieval failures from **5.7% to 3.7%** (embeddings alone), **2.9%** (with BM25) and **1.9%** (with a reranker added): a 67% reduction. Their one-time cost was about **$1.02 per million document tokens** using prompt caching. A 2026 survey reported by VentureBeat found enterprise intent to adopt hybrid retrieval rising from about 10% to 33% in Q1 2026. Treat these as directional: the corpus was Anthropic's, so measure on yours.
- **Reranking costs latency.** Secondary sources put cross-encoder reranking at around 100 to 150 ms; budget for it and rerank only the top 50 to 100 candidates.
- **Retrieval is agentic and permission-aware.** The retriever may loop (reformulate, search again) and must filter by the caller's entitlements *before* ranking, not after generation. OWASP now lists vector and embedding weaknesses (LLM08) as its own risk: embedding inversion, cross-tenant leakage and poisoned documents.
- **Evaluate retrieval and generation separately.** Track recall at k on a labelled set, faithfulness (is every claim supported by retrieved text) and abstention quality.

**Enterprise pattern.** Version the index (embedding model, chunking, metadata schema) like a database migration; shadow-run a new index against live queries before cutover; keep the original document access control list on every chunk and sync it on a short interval so revoked access disappears quickly.

## Common mistakes

- **Filtering permissions after generation**, so restricted text has already influenced the answer.
- **One giant index with no ACLs** "for now", then retrofitting security.
- **Ignoring deletions and permission changes**, which turns stale data into a leak.
- **Evaluating only the final answer**, hiding whether retrieval or generation failed.
- **Flattening tables and headings** during parsing, then blaming the model.
