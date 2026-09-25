---
title: "Choosing and Evaluating Embedding Models"
short_title: "Choosing Embedding Models"
tags: ["embeddings", "retrieval", "evaluation"]
sources:
  - "MTEB (Massive Text Embedding Benchmark) leaderboard and documentation"
  - "OpenAI and Cohere documentation on embedding model selection"
---

## Why the embedding model choice is a foundational, hard-to-change decision

Every downstream retrieval component in a RAG system (covered in this track's RAG fundamentals lesson) depends on the embedding model producing vectors that meaningfully capture semantic similarity for your specific content and queries. Unlike many configuration choices, changing embedding models later isn't a simple swap — every existing vector in the index was produced by the old model, and a new model's vectors aren't comparable to the old ones, so switching means fully re-embedding and re-indexing the entire corpus. This makes the initial choice worth deliberate evaluation, not a default pick made without checking it against your actual data.

## What varies between embedding models

- **Dimensionality** — the length of the output vector (common values range from a few hundred to a few thousand dimensions). Higher dimensionality can capture more nuance but costs more storage and compute per vector, and past a point offers diminishing returns for a given model architecture and training data.
- **Domain specialization** — a general-purpose embedding model trained broadly on web text performs reasonably across many domains, but a model fine-tuned or trained specifically on a target domain (legal text, code, biomedical literature) often meaningfully outperforms a general model on that domain's specific vocabulary and semantic structure, since general-purpose training data underrepresents specialized terminology and its actual usage patterns.
- **Multilingual support** — some embedding models are trained primarily on English; others are explicitly multilingual, mapping semantically similar text in different languages to nearby points in the same vector space. This matters directly for any application needing cross-lingual retrieval (a query in one language matching documents in another) — a model without genuine multilingual training won't reliably support this, regardless of how well it performs within a single language.
- **Context length** — the maximum input length the embedding model can process in one call, which interacts directly with the chunking strategy from the RAG fundamentals lesson: a short embedding-model context limit forces smaller chunks regardless of what chunk size would otherwise be ideal for the content.

## Why a generic benchmark score isn't enough

The MTEB leaderboard and similar public benchmarks rank embedding models across many standardized tasks and datasets, and are a reasonable starting point for narrowing candidates — but a model's aggregate benchmark rank doesn't guarantee it's the best fit for your specific domain and query patterns. A model that ranks highly on average across broad benchmark tasks can still underperform a lower-ranked but domain-specialized model on your particular content, especially for specialized vocabularies (medical, legal, internal company jargon) that general benchmarks don't specifically test. This mirrors the broader point from this track's evaluation lesson: a benchmark is a useful proxy, not a substitute for evaluating against your actual use case.

## Building a retrieval eval set to actually compare models

The reliable way to choose between embedding model candidates is a retrieval-specific eval set: a collection of representative queries paired with the documents/chunks that should be retrieved for each (labeled by a domain expert, or bootstrapped from real user queries and manually verified). Standard information-retrieval metrics apply directly:

- **Recall@k** — of the truly relevant documents for a query, what fraction appear in the top k retrieved results. Directly measures whether the right information is even being surfaced at all.
- **Mean Reciprocal Rank (MRR)** — for queries with one clearly correct answer, how high up the ranking that correct answer appears on average (a correct answer ranked first scores higher than one ranked fifth) — useful when getting the best answer near the top matters more than a broad recall count.
- **NDCG (Normalized Discounted Cumulative Gain)** — accounts for graded relevance (some results are more relevant than others, not just relevant/irrelevant) and rewards ranking more relevant results higher, useful when relevance isn't strictly binary.

Running each embedding model candidate through the same eval set and comparing these metrics gives a grounded, domain-specific answer to "which model actually retrieves better for us" — a materially more reliable signal than a generic leaderboard rank alone.

## A worked example

**Scenario:** a company building RAG over internal engineering documentation (heavy on internal jargon, code snippets, and acronyms specific to their systems) needs to choose an embedding model.

- **Starting candidates** are narrowed from the MTEB leaderboard to a handful of top-ranked general-purpose models, plus any code-aware or technical-domain models worth testing given the content includes code snippets — this initial narrowing uses the public benchmark as a reasonable first filter, not a final answer.
- **A retrieval eval set** is built from ~100 real internal search queries (pulled from existing internal search logs) paired with the documents an engineer confirms are actually relevant for each — deliberately using real queries rather than synthetic ones, since real internal jargon and phrasing patterns are exactly what a generic benchmark wouldn't capture.
- **Each candidate model** embeds the same document corpus and is evaluated on Recall@10 and MRR against the eval set; the model chosen is whichever performs best on *this* eval set, even if it wasn't the top-ranked model on the general MTEB leaderboard — the domain-specific eval result is trusted over the generic benchmark rank, per the reasoning above.
- **The decision is documented and the eval set retained**, since any future embedding model change (a newer model release, a cost-driven switch) needs to be re-validated against the same eval set before committing to a costly full re-index.

## Common mistakes

- **Picking the top MTEB-ranked model without validating it against domain-specific data.** As covered above, a generic benchmark's aggregate rank doesn't guarantee the best fit for specialized vocabulary or query patterns your actual application will face.
- **Switching embedding models without accounting for the full re-indexing cost.** Because old and new vectors aren't comparable, a switch means re-embedding and re-indexing the entire corpus — a decision that should be made deliberately and infrequently, not treated as a low-cost configuration change.
- **Evaluating retrieval quality only qualitatively ("these results look reasonable")** instead of building a real eval set with recall/MRR metrics. This misses systematic gaps that only show up in aggregate across many queries, not in a handful of manually-inspected examples.
