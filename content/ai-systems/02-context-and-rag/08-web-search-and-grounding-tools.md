---
title: "Web Search and Grounding Tools: Answers From Live Sources"
short_title: "Web Search and Grounding Tools"
tags: ["web-search", "grounding", "citations", "tools", "rag"]
sources:
  - "Anthropic documentation, 'Web search tool', platform.claude.com/docs (fetched October 2026)"
  - "Google Gemini API pricing, grounding with Google Search (fetched October 2026)"
  - "Tow Center for Digital Journalism, study of citation accuracy in AI search engines (March 2025), via Nieman Lab"
---

## When the model's knowledge is not enough

A model's training data has a cutoff, and much of what users ask depends on things that change: prices, versions, news, policies, schedules. **Grounding** means supplying the model with current external evidence at answer time. Two sources dominate: your own documents (retrieval-augmented generation) and the open web. This lesson covers the second, which most providers now offer as a built-in tool.

## How a search tool works

With a provider-hosted search tool you declare it in the request; you do not run the search yourself. The loop is:

1. The model decides, from the prompt, whether the question depends on current or unfamiliar information. Anthropic's documentation lists examples that trigger search (recent events, current prices and statistics, specific organisations that may have changed) and cases that do not (established facts, maths, coding concepts, analysis of content already in the conversation).
2. The provider runs one or more searches and returns results to the model.
3. The model reads them, may search again, and writes an answer **with citations** to the sources it used.

The response includes the queries issued, the sources with title, URL and page age, and cited spans. Citations are tied to specific sentences, so an interface can show "claim, source, quoted text".

## Controls you should use

- **Limit the number of searches** per request (a `max_uses` setting). Simple lookups need one to three searches; comparative research can use ten or more, and each search is billed.
- **Allow-list or block-list domains.** For a legal or medical product, restricting to authoritative domains is a quality and safety control; use one list or the other, not both.
- **Localise** with an approximate location when results should be regional.
- **Filter results before they enter context.** Newer tool versions let the model run code to filter results first, so only relevant content consumes tokens.
- **Organisation-level switches.** Administrators can disable web search or restrict domains centrally.

## Cost

Web search is charged **per search in addition to tokens**: Anthropic lists $10 per 1,000 searches, and Google lists 5,000 free grounded requests a month then $14 per 1,000 for Gemini 3 models. Results become input tokens on that turn and every later turn that keeps them, so a research session with fifteen searches can cost more in tokens than in search fees. Cap searches and trim results.

## The risks, in order of seriousness

1. **Prompt injection from web pages.** A page can contain text addressed to the model ("ignore your instructions and..."). Treat all search results as untrusted data; do not give a search-enabled agent powerful write tools without confirmation steps.
2. **Wrong or unsupported citations.** A 2025 Tow Center study of eight AI search engines found they failed to identify the correct source more than 60% of the time on a news-attribution test (the best was wrong 37% of the time). A citation is a claim to verify, not proof.
3. **Low-quality or manipulated sources.** SEO spam and content farms rank well.
4. **Data leakage.** The search query itself can contain sensitive text from the conversation; queries go to a third party.
5. **Retention and licensing.** Check data-retention terms for the tool, and display citations to the original source as the provider's terms require.

## A worked example

A procurement assistant answers "What is the current list price and licence terms of Product X?"

1. Without search, the model quotes a price from training data, 14 months out of date.
2. With search restricted to the vendor's domains and `max_uses` of 3, it finds the current pricing page and the licence page and cites both with quoted text.
3. A verifier step checks that each number in the answer appears in a cited passage; one claim, about a regional discount, does not, and is removed.
4. The product shows the answer, the two sources and the retrieval date. Cost: two searches ($0.02) plus about 9,000 input tokens.

## Practical rules

- Show citations and retrieval time; never present search-derived answers as certain.
- Combine with your own retrieval for internal facts; do not send internal documents to a public search.
- Log queries and sources for audit; redact personal data from queries.
- Evaluate on questions whose answers changed recently.

## Common mistakes

- **Unlimited searches**, so one prompt triggers dozens of paid calls.
- **No domain controls** in regulated domains.
- **Believing the citation** without checking it supports the sentence.
- **Searching for things the model already knows**, adding cost and latency.
- **Letting search results trigger actions** without a confirmation step.
