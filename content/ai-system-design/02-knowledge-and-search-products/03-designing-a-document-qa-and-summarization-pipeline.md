---
title: "Designing a Document Q&A and Summarization Pipeline"
short_title: "Document Q&A and Summarization"
tags: ["documents", "summarization", "map-reduce", "ocr", "design"]
sources:
  - "Liu et al., 'Lost in the Middle: How Language Models Use Long Contexts' (2023)"
  - "LangChain and LlamaIndex documentation on map-reduce and refine summarization patterns"
  - "Public documentation of document-parsing and OCR services"
  - "Long-context versus RAG evaluations, 2026 (secondary: rdp.in, bigdataboutique.com); Liu et al., 'Lost in the Middle' (2023); U-NIAH (arXiv 2503.00353)"
  - "Anthropic pricing documentation (1M-token context at standard price, fetched Oct 2026)"
banner:
  layout: line
  nodes:
    - [doc, "PDFs"]
    - [server, "parse+chunk"]
    - [db, "index"]
    - [model, "answer"]
---

## The problem

Users upload long documents (contracts, reports, papers, scanned forms) and want a summary, or answers to specific questions, with proof of where each statement came from. The challenge is length and mess: documents exceed what a model reads well in one pass, layouts are complicated, and users distrust claims they cannot verify.

## Step 1: Requirements

- **Functional:** upload PDFs, Word and scans; summary at several lengths; question answering; every claim linked to the page and passage.
- **Quality:** no invented facts, numbers copied exactly, tables read correctly.
- **Latency:** a first useful result in seconds, the full summary within a minute for a few hundred pages.
- **Scale (example):** 10,000 documents per day, median 40 pages, tail of 800 pages.

## Step 2: Pipeline overview

1. **Ingest and store** the original file in object storage with a document id.
2. **Parse and normalize** to structured text with page numbers, headings and tables.
3. **Index** chunks for question answering, and/or **summarize** hierarchically.
4. **Serve** results with citations, and cache them keyed by document version and request.

Processing is **asynchronous**: upload returns immediately, a queue drives workers, and the UI shows progress and streams partial results.

## Step 3: Parsing is the foundation

- Digital PDFs: extract text with layout; keep reading order, headings, footnotes.
- Scans: run OCR, and attach a **confidence** to each region. Low-confidence text should be flagged so the model and the user know a number may be misread.
- **Tables** become structured text (rows and headers) rather than flattened lines; otherwise "Q3 revenue 4.2" is detached from its column.
- Store a mapping from every extracted span to its **page and bounding box**, so citations can highlight the exact place.

## Step 4: Summarizing long documents

A single call over 500 pages is expensive and the model attends poorly to the middle. Use hierarchical patterns:

- **Map-reduce:** summarize each section independently (parallel, fast), then summarize those summaries. Cheap and scalable, but cross-section connections can be lost.
- **Refine:** walk the document in order, carrying a running summary that each section updates. Preserves narrative, but is sequential and slower.
- **Hybrid:** map-reduce for sections, then one final pass with the section summaries plus the key passages the user cares about.

Always produce summaries **with source references**: each bullet carries the section or page it came from. Prefer extractive anchors for facts and numbers: quote them from the source rather than paraphrasing.

## Step 5: Question answering

For specific questions, retrieval beats summarization. Chunk by structure, retrieve the best chunks for the question, and answer with citations as in the enterprise RAG design. For questions that span the document ("what are the main risks?") use the section summaries as the retrieval unit, since no single passage answers it.

## Step 6: Trust and verification

- **Citation check:** each cited span must exist in the document and support the claim; verify automatically.
- **Number check:** extract every figure in the answer and confirm it appears in the cited passage.
- **Abstention:** "not stated in this document" is a valid, useful answer.
- Show the original page beside the answer so users can verify in one click.

## Step 7: Operations

Cost is dominated by tokens, so cache per document version, skip re-summarizing unchanged documents, and use a smaller model for the map step with a stronger one for the final pass. Large documents are rate-limited and queued by size so one 800-page upload cannot starve small ones. Monitor extraction failures, OCR confidence, and user "this is wrong" reports by document type.

## A worked example

**Scenario:** a 300-page contract is uploaded and the user asks "What is the termination notice period and what are the penalties?"

1. The parser produces 300 pages of structured text; page 212's table of fees is preserved as rows.
2. Retrieval finds the termination clause on page 87 and the penalty schedule on page 212.
3. The model answers: "90 days written notice (p. 87). Early termination fee is 25% of remaining fees (p. 212 table, row 3)."
4. The number check confirms "90" and "25%" appear verbatim in the cited passages; both citations link to highlighted regions.
5. A separate "executive summary" job, run in the background by map-reduce, appears later without blocking the question.

## Enterprise practice (verified October 2026)

**Basics.** Parse, chunk, retrieve or summarise in stages (map-reduce), answer with citations (steps above).

**Long context changed the economics, not the physics.** Several frontier models now offer **1M-token contexts**, and Anthropic's documentation states its 4.6 and later models bill the full window at the **standard per-token rate** (no long-context surcharge). Even so, evaluation work and practitioner roundups report that filling a window costs far more per query than retrieving a small relevant slice, and that **recall degrades before the advertised limit**, with facts buried mid-prompt recovered less reliably (the "lost in the middle" effect; multi-fact recall around 60% in some reports). Benchmarks such as U-NIAH compare retrieval with long-context needle-in-a-haystack tests and generally find retrieval helps smaller models most. The 2026 consensus pattern is a **router**: stuff the whole document when it is short and the question is global (summarise, compare), retrieve when the corpus is large or questions are narrow, and use hierarchical summaries for very long single documents.

**Enterprise pattern.** Decide per task by measuring accuracy, latency and cost on your documents. Keep citations as page and paragraph references that the UI can open, extract structured fields with schema validation, handle scanned pages with a layout-aware parser, apply the same access control as the source, and for long summaries check coverage (did the summary include the key clauses) and faithfulness (no claims absent from the source) with automated checks plus sampled human review.

## Common mistakes

- **Pushing the whole document into one prompt** and trusting the middle of it.
- **Flattening tables and ignoring OCR confidence**, then presenting wrong numbers confidently.
- **Summaries without citations**, which users cannot trust or check.
- **Synchronous processing** of large files, causing timeouts.
- **No caching by document version**, paying again for every view.
