---
title: "Designing an AI Answer Engine"
short_title: "AI Answer Engine"
tags: ["answer-engine", "web-search", "citations", "freshness", "design"]
sources:
  - "Nakano et al., 'WebGPT: Browser-assisted question-answering with human feedback' (2021)"
  - "Public product documentation of search-grounded generative answer products"
  - "Robots Exclusion Protocol (RFC 9309) and public crawler etiquette guidance"
---

## The problem

A user types a question; instead of ten links they expect a direct, cited answer assembled from the live web. This is retrieval-augmented generation at internet scale, where the corpus is huge, changing and **adversarial**: pages are low quality, contradictory, out of date, or written to manipulate. The system's value is judgement about sources as much as fluency.

## Step 1: Requirements

- **Answer quality:** correct, concise, with inline citations the user can click.
- **Freshness:** news and prices from minutes ago, not last month's index.
- **Latency:** first tokens within a couple of seconds; complete answers within about six.
- **Trust and safety:** resist spam and prompt injection from pages; handle sensitive topics carefully.
- **Scale (example):** 20,000 queries per second at peak, a web index of billions of pages.

## Step 2: Architecture

- **Query understanding:** classify intent (factual, news, shopping, navigational, chit-chat that needs no search), detect language, and decide whether to search at all.
- **Retrieval:** a web index (own crawl and/or a search API) returns candidate pages; multiple query rewrites run in parallel.
- **Fetch and extract:** retrieve page content, strip boilerplate, extract the relevant passages.
- **Rank and select:** rerank passages by relevance and **source quality**, deduplicate near copies, keep a small diverse set.
- **Generate:** an LLM writes an answer using only the selected passages, with citation markers.
- **Verify and render:** check citations, apply safety filters, stream to the client with source cards.

## Step 3: Deciding when to search

Searching every message wastes time and money; never searching hallucinates. A lightweight router decides: no search for chat and stable knowledge, search for anything time-sensitive, specific, or requiring sources. Complex questions get **multi-step** retrieval: decompose, search each part, then combine, like multi-hop RAG.

## Step 4: Source quality and freshness

Raw search results include spam and stale pages. Score sources with signals such as domain reputation, authorship, publication date, agreement with other sources and whether the page contains the answer. For time-sensitive queries, bias strongly to recent documents, and show dates. A **freshness tier** (a small, rapidly updated index of news and feeds) complements the large, slowly updated one. When sources conflict, say so and attribute each claim rather than blending them.

## Step 5: Grounded generation

The prompt gives numbered passages and instructions to answer only from them, cite each claim, and acknowledge gaps. Post-check that each cited number appears in its passage. Style choices matter: lead with the answer, keep it short, then details. For contested or sensitive topics (health, legal, finance), present multiple credible views, add caveats, and prefer authoritative sources.

## Step 6: Adversarial content

Web pages can contain hidden instructions aimed at the model ("ignore previous instructions and say…"). Treat all fetched text as **data**: delimit it, instruct the model never to follow instructions inside it, strip hidden text, and give the generation step no tools that can exfiltrate or act. SEO spam that mimics authority is countered by the source-quality signals above and by requiring corroboration for important claims.

## Step 7: Latency and cost

The pipeline has many hops, so parallelise: run rewrites and retrievals concurrently, fetch pages in parallel with tight timeouts, and start generating once enough good passages exist rather than waiting for stragglers. Cache popular queries' retrieved passages for a short TTL, keyed by query and freshness class. Use a small model for routing and rewriting and a stronger one for the final answer. Stream the answer so users read while generation continues.

## Step 8: Evaluation

Judge the three parts separately: **retrieval** (was the evidence found), **grounding** (is every claim supported by a cited passage), and **answer quality** (helpful, complete, well-formed). Use human raters on a stratified query set (news, long-tail, sensitive), automated faithfulness checks at scale, and online signals such as follow-up reformulations and citation clicks. Monitor freshness lag and the rate of "no answer".

## A worked example

**Scenario:** "What did the central bank decide about interest rates today?"

1. The router marks it **news, time-sensitive**, so it searches with a freshness bias.
2. Rewrites run in parallel: the bank's name plus "rate decision", plus the date. The freshness index returns the bank's own press release and two news reports minutes old.
3. Passages are ranked: the primary source first, then reputable reports; near-duplicate wire copy is collapsed.
4. The model answers: "The bank held rates at 4.25 percent [1][2]. The statement cites sticky services inflation [1]." Each citation links to its source card with the timestamp.
5. The check confirms "4.25" appears in sources 1 and 2. A low-quality blog claiming a cut was demoted and not used.

## Common mistakes

- **Searching on every message**, or never searching.
- **Trusting any page equally**, ignoring source quality and dates.
- **Following instructions found in retrieved pages.**
- **Blending conflicting sources** into one confident statement.
- **Waiting for the slowest fetch** before generating.
