---
title: "Designing a RAG Ingestion and Connector Platform"
short_title: "RAG Ingestion and Connectors"
tags: ["ingestion", "connectors", "etl", "chunking", "freshness", "platform", "design"]
sources:
  - "Public documentation of document parsing, chunking and embedding pipelines for retrieval systems"
  - "Kleppmann, Designing Data-Intensive Applications (2017), on change data capture and stream processing"
  - "Public API documentation of common enterprise systems on change feeds and access control"
  - "RAG chunking and ingestion guides, 2026 (secondary: firecrawl.dev, atlan.com, digitalapplied.com); Jina AI, late chunking (2024)"
  - "Anthropic, Contextual Retrieval (fetched Oct 2026)"
---

## The problem

Retrieval-augmented systems are only as good as the knowledge they index, and that knowledge lives in dozens of systems, changes constantly and carries permissions. Each team writing its own scraper-and-embed script yields stale, ungoverned and inconsistent data. A **RAG ingestion platform** is shared infrastructure that connects to sources, keeps a trustworthy, permission-aware, fresh copy of the knowledge, and makes it available to many applications.

## Step 1: Requirements

- **Breadth:** connectors for files, wikis, drives, email, chat, tickets, CRM, databases, web.
- **Freshness:** changes reflected in minutes; deletions and permission changes faster.
- **Fidelity:** good parsing of PDFs, slides, tables, images, code.
- **Permissions:** ACLs preserved end to end.
- **Configurability:** per-source and per-application chunking, embedding and filtering policies.
- **Governance:** lineage, quality checks, auditability, retention and deletion.
- **Scale (example):** 500 million documents, 2,000 changes per second, 50 sources.

## Step 2: Pipeline architecture

1. **Source connectors:** authenticate, enumerate, fetch content and metadata, and subscribe to change events.
2. **Change stream:** a durable log of document events (create, update, delete, permission change).
3. **Content extraction:** parse files into structured text with layout; OCR for scans; transcribe audio and video; extract tables and images.
4. **Enrichment and cleaning:** language detection, deduplication, boilerplate removal, metadata extraction, PII detection, classification.
5. **Chunking:** split by structure into retrievable units with context (title, headings).
6. **Embedding:** compute vectors with the configured model, batched on GPUs.
7. **Indexing:** upsert chunks, vectors, keyword fields and ACLs into target indexes.
8. **Verification and monitoring:** sampling checks, lag and error tracking, quality evaluation.

Process asynchronously with queues between stages so each scales independently and failures retry in isolation.

## Step 3: Connectors and change capture

Prefer **incremental sync** using each source's change feed or modified-since tokens, with periodic full reconciliation to catch missed events. Handle rate limits with backoff and per-tenant budgets, large files with streaming, and transient failures with retries. A connector framework provides common concerns: credentials management (OAuth, service accounts), checkpointing, health reporting, schema mapping and a test harness. Support **crawl, push (webhook) and federated** modes.

## Step 4: Idempotent, versioned processing

Every document has a stable id and a **content hash**; if unchanged, skip re-processing and re-embedding (saves large cost). Pipeline stages are idempotent, so retries are safe. Store **versions** and process updates as replace operations that remove old chunks atomically, avoiding a state where old and new chunks coexist. Handle deletes explicitly: tombstone events remove chunks and vectors, caches and downstream copies, with verification.

## Step 5: Parsing and chunking quality

This stage decides retrieval quality. Use layout-aware parsers for PDFs and slides, keep tables as structured units, preserve headings as hierarchy, and extract image captions or OCR text where relevant. Chunk by **document structure** (sections, paragraphs, rows) within token limits, attach title and heading path, and optionally index multiple granularities (sentence and paragraph). Allow per-application chunking policies, and re-chunk from stored parsed artifacts without re-fetching sources. Evaluate chunking with retrieval metrics, not by eye.

## Step 6: Permissions and governance

Capture ACLs at ingestion (users, groups, link sharing) and keep them current via change events; permission-only changes update metadata without re-embedding. Tag content with sensitivity classification and region; route and index according to policy (some content never leaves a region, some is excluded). Detect and redact or exclude sensitive data where required. Keep **lineage**: from each chunk to its source document, version, parser and embedding model. Support legal holds, retention schedules and deletion requests.

## Step 7: Embedding management

Embedding models change, and re-embedding hundreds of millions of chunks is a major operation. Version collections by model; run **blue-green re-indexing**: build a new index with the new model alongside the old, evaluate, then switch aliases. Batch embedding efficiently, deduplicate identical chunks, cache embeddings by content hash and model, and throttle bulk backfills so they do not starve incremental updates.

## Step 8: Observability and quality

Track per-source: sync lag, documents processed, failure rates by stage, parse failures by file type, empty-text rate, duplicate rate, and permission-sync delays. Run **data quality checks**: sample documents and verify the indexed text matches the source, canary documents travel the whole pipeline, and retrieval tests confirm known questions still find their sources. Alert on lag and stalled connectors. Provide a console for owners to see their sources' health and reindex.

## A worked example

**Scenario:** a wiki page is edited and a document is shared with a new group.

1. The wiki connector receives a change webhook; the event enters the log with the page id and new revision.
2. The pipeline fetches the page, computes the content hash (changed), parses the HTML, splits by headings into 12 chunks and prepends the title and heading path to each.
3. Only the 3 chunks whose text changed are re-embedded (chunk-level hashes match for the rest); the index replaces the old chunks atomically.
4. Separately, the drive connector reports a permission-only change: a new group gained access. The ACL metadata for the document's chunks is updated in the index in seconds, with no re-embedding.
5. A canary document with a unique phrase is edited every hour; a monitor searches for the phrase and alerts if the update takes longer than five minutes to appear.

## Enterprise practice (verified October 2026)

**Basics.** Connect, fetch, parse, chunk, embed, upsert, and keep in sync (steps above).

**Current chunking and parsing guidance (secondary, 2026).** Common strategies are fixed-size, recursive, sentence, semantic, document-structure-aware, **parent-child** (retrieve small, return the larger parent) and **late chunking** (embed the whole document first so each chunk's vector carries long-range context; Jina reported nDCG@10 gains such as 64.2 to 66.1 on SciFact, growing with document length). **Contextual retrieval** (prepend model-written context to each chunk) is the other high-value upgrade; Anthropic reported a 35 to 67% reduction in top-20 retrieval failures depending on combination with BM25 and reranking. Parsers in common use include Docling, Unstructured, LlamaParse and cloud document services; layout-aware parsing for tables and headings usually beats raw text extraction.

**Platform requirements that bite in production.**

- **Incremental sync:** hash content at ingestion and re-index only changed documents; use source change feeds or webhooks where available, with a periodic full reconciliation.
- **Deletion and access revocation must propagate** to the index and caches within a stated SLA; this is a compliance requirement (erasure requests, revoked access), not an optimisation.
- **Lineage:** store source id, version, parser version, chunker version, embedding model and ACL snapshot per chunk so you can re-run or roll back a stage.
- **Backpressure and quotas:** respect source API rate limits, queue with retries and dead-letter handling, and expose per-connector freshness and failure dashboards.
- **Evaluate ingestion changes** by replaying a retrieval test set against old and new indexes before cutover.

## Common mistakes

- **Full re-crawls instead of incremental sync.**
- **Re-embedding unchanged content.**
- **Dropping ACLs** during normalisation.
- **No delete handling**, leaving removed content searchable.
- **Fixed chunking for every source and application** with no evaluation.
