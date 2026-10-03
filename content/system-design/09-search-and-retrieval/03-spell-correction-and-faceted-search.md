---
title: "Spell Correction and Faceted Search"
short_title: "Spell Correction and Faceted Search"
tags: ["search", "spell-correction", "faceted-search"]
sources:
  - "Peter Norvig, 'How to Write a Spelling Corrector' (norvig.com)"
  - "Elasticsearch documentation on aggregations and faceted navigation"
banner:
  layout: line
  nodes:
    - [user, "query"]
    - [server, "spell fix"]
    - [db, "facet counts"]
    - [doc, "filtered"]
predict:
  question: "An observed query word is one edit away from both a very common brand name and a rare word. How does a Norvig-style corrector choose?"
  options: ["It treats them as equally likely, because the edit distance is the same", "It prefers the common brand, since the word's own prior breaks the tie", "It prefers the rare word, since rare terms are more informative"]
  answer: 1
  why: "The model weighs how common the intended word is as well as how plausible the edit is. Equal edit distance does not make candidates equally plausible."
check:
  - q: "Why compute facet counts with the engine's native aggregations instead of one follow-up query per facet?"
    options: ["Aggregations reuse the same index scan that produces the ranked results", "Application-level queries cannot filter by brand, price or rating", "Native aggregations return counts that never change after indexing"]
    answer: 0
    why: "The engine can compute counts as part of the scan already happening for the results. Separate queries repeat that work against the same data and add latency."
  - q: "Why train the spelling model on the platform's own query logs instead of a generic dictionary?"
    options: ["Generic dictionaries are too large to load into a search engine's memory", "Logs show which terms are common in this domain, such as \"iphone\"", "Query logs make edit distance unnecessary for choosing corrections"]
    answer: 1
    why: "Domain terms like brand names may be absent from a general dictionary yet extremely common in real queries. The log reflects the distribution being corrected."
  - q: "Why should facet counts change as the user applies filters?"
    options: ["Static counts take more storage than counts recomputed per query", "Filters are applied only after counts are shown, so they must be reset", "Static counts misstate how many results remain for each further option"]
    answer: 2
    why: "Users expect counts to describe the currently filtered result set. Unfiltered counts misrepresent what narrowing is actually available and undermine trust."
---

## Why "did you mean" is a genuinely different problem than fuzzy matching

This track's search-relevance-and-autocomplete lesson covered edit-distance-based fuzzy matching, allowing a slightly misspelled query to still match the intended term during retrieval. Full spell correction ("did you mean X") is a related but distinct problem: rather than (or in addition to) silently tolerating a typo during matching, it explicitly identifies the most likely intended correction and can surface it to the user, or automatically substitute it — a step that requires actual language-model-style reasoning about what correction is most plausible, not just measuring edit distance to nearby dictionary terms.

## The classical approach: a probabilistic spelling model

A foundational approach (popularized in Peter Norvig's widely-referenced spelling corrector) frames correction as: given an observed (possibly misspelled) query, what's the most probable *intended* word, considering both how common that intended word is in general usage (its prior probability) and how likely the specific observed typo is to result from that word (the probability of that specific edit occurring)? This is a direct application of Bayesian reasoning: a rare word requiring an implausible number of edits to reach the observed query is a worse correction candidate than a common word requiring just one plausible edit, even if both are within the same edit distance from the literal observed text — plausibility of the *word itself*, not just edit-distance proximity, is what makes a correction feel right rather than arbitrary.

## Why search-specific spell correction differs from general spell-checking

A general-purpose spell checker (like one built into a word processor) draws its notion of "common words" from general language usage. Search-specific spell correction benefits from using the *search system's own query and content logs* as the source of what's common — a product search engine's spelling model should know that "iphone" is an extremely common, valid query term even though it might not appear in a general dictionary, and that a rare product-specific misspelling pattern in that catalog's actual query logs is more relevant signal than general English spelling statistics. This connects to this track's search-relevance lesson's broader point about tuning against real usage data rather than generic defaults — spell correction specifically benefits from being trained on the actual query distribution it will be correcting, not a generic external language model alone.

## Faceted search: letting users narrow results along multiple independent dimensions

**Faceted search** presents users with a set of filterable categories (facets) alongside search results — a product search showing filters for brand, price range, and category simultaneously, each filter narrowing the result set independently and in combination with the others, with each facet's available options and counts updating live to reflect the current filtered result set. This requires the search system to compute, for the current query-plus-filter-state, how many results exist for each possible value of every other facet — a genuinely different computation than simple text-relevance ranking (per this track's search-and-retrieval-fundamentals lesson), closer to a real-time aggregation query than a pure text-matching one.

## Why faceted search's aggregation cost needs deliberate handling at scale

Computing accurate per-facet counts across potentially millions of matching documents, for every facet, on every query (since the counts need to reflect the current search-plus-filter state, not a static precomputed value) is a genuinely expensive operation if done naively — this is why production faceted search typically relies on the search engine's own built-in aggregation capabilities (Elasticsearch's aggregations framework, for instance) rather than computing facet counts via separate application-level queries, since the search engine can compute these aggregations efficiently as part of the same underlying index scan that's already happening to produce the ranked results, rather than as entirely separate, redundant queries against the same data.

## A worked example

**Scenario:** an e-commerce search needs both spell correction (many users misspell brand and product names) and faceted filtering (brand, price range, category, customer rating) that updates live as filters are applied.

- **Spell correction is trained on the platform's own search query logs**, not a generic dictionary — capturing that a common misspelling of a specific, popular brand name is a far more probable correction target than an edit-distance-equivalent but rarely-searched-for alternative, exactly the kind of domain-specific signal a generic spelling model wouldn't have access to.
- **Faceted counts are computed via the search engine's native aggregation capability**, computed as part of the same query that retrieves the ranked results, rather than as separate follow-up queries per facet — keeping the total latency for a filtered search page load reasonable even though it's conceptually combining a text search with several simultaneous count aggregations.
- **Facet counts update live as filters are applied**: selecting a brand filter recomputes the available price-range and rating facet counts to reflect only products matching that brand, giving users an accurate, current view of what further narrowing is actually available — rather than showing static counts that don't reflect the already-applied filters, which would misrepresent how many results actually remain for each further option.

## Common mistakes

- **Using a generic, non-domain-specific spelling correction model for a specialized search domain** (product names, technical terminology, brand names), missing corrections that a model trained on the platform's actual query and content data would catch, and potentially suggesting implausible corrections that a domain-aware model wouldn't propose.
- **Computing faceted counts via separate application-level queries per facet instead of the search engine's native aggregation support**, incurring unnecessary redundant computation against the same underlying data and adding avoidable latency to filtered search pages.
- **Showing static, unfiltered facet counts regardless of currently-applied filters.** Users expect facet counts to reflect the current filtered state (how many *remaining* results exist for each further option), and showing stale or unfiltered counts is a subtle but noticeable correctness issue that undermines trust in the faceted navigation.
