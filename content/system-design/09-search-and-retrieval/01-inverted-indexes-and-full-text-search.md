---
title: "Inverted Indexes and Full-Text Search"
short_title: "Inverted Indexes and Search"
tags: ["search", "indexing", "full-text-search"]
sources:
  - "Elasticsearch / Lucene documentation on inverted index internals"
  - "Manning, Raghavan & Schütze, 'Introduction to Information Retrieval' (2008), chapter on index construction"
---

## Why a database index doesn't solve full-text search

A regular database B-Tree index (see this track's storage engines lesson) speeds up exact-match and range lookups on a column — great for `WHERE user_id = 123`, useless for `WHERE description CONTAINS 'fast reliable database'` matched against millions of free-text documents. Full-text search needs a fundamentally different structure, because the query isn't "find this exact value" — it's "find documents containing these words, ranked by relevance," which a B-Tree has no concept of.

## The inverted index: the core data structure

A forward index maps documents to the words they contain (document → words) — the natural way you'd store text. An **inverted index** flips this: it maps each word to the list of documents containing it (word → documents), which is exactly the direction a search query needs. Searching for "database" becomes a direct lookup: find "database" in the index, get back the list of every document containing it, instantly — no scanning every document's text.

For a query with multiple terms ("fast reliable database"), the engine looks up each term's document list and intersects or unions them (intersects for AND-style "all these words," unions for OR-style "any of these words"), then ranks the results.

## Tokenization: turning text into searchable terms

Before building the index, raw text is broken into searchable tokens — and the choices made here materially affect what a search can and can't find:

- **Lowercasing** so "Database" and "database" match the same index entry.
- **Stemming/lemmatization** — reducing words to a root form ("running," "runs," "ran" → "run") so a search for one form matches documents using another. Improves recall (finding more relevant documents) at some risk of imprecision (an overly aggressive stemmer can conflate unrelated words that happen to share a root).
- **Stop-word removal** — dropping extremely common, low-information words ("the," "a," "is") from the index, since they'd otherwise match nearly every document and add index size without adding discriminating power. Some search use cases (exact phrase matching) need to keep stop words, so this isn't a universal default.
- **N-gram / partial tokenization** — indexing substrings or character sequences instead of (or alongside) whole words, enabling partial-match and typo-tolerant search at the cost of a larger index.

## Ranking: from "does it match" to "how relevant is it"

Once candidate documents are found, they need ranking — a naive index tells you which documents contain a term, not which ones are most relevant. **TF-IDF** (Term Frequency-Inverse Document Frequency) is the classical foundation: a term's importance to a document scales with how often it appears in that document (term frequency), but is discounted by how common that term is across all documents (inverse document frequency) — so a rare, distinctive term appearing several times in a document is a much stronger relevance signal than a common word appearing the same number of times. **BM25**, a refinement of TF-IDF widely used in modern search engines (including Elasticsearch's default), improves on this with better handling of document length and diminishing returns for very high term frequency.

Semantic/vector search (covered in this track's AI-systems counterpart) is a fundamentally different ranking approach — matching by meaning rather than exact term overlap — and modern search systems increasingly combine both (**hybrid search**): keyword/BM25 matching for precision on exact terms and names, vector matching for capturing semantic similarity a keyword match would miss, merged into a single ranked result.

## A worked example

**Scenario:** building search for a documentation site with 50,000 pages, where users search both for exact API names ("createUser") and general concepts ("how to authenticate users").

- **Tokenization choices**: stemming helps for concept-style queries ("authenticate" matching "authentication," "authenticating"), but exact API names need special handling — `createUser` should also be searchable as `create user` (split on camelCase) without losing the ability to match the exact identifier, which is a tokenization decision made deliberately rather than left to a generic default.
- **Inverted index** handles the term-lookup and ranking (BM25) for both cases reasonably well on its own for keyword-style queries.
- **Hybrid search** is added specifically because a user asking "how do I log a user in" won't necessarily use the words "authenticate" or "createUser" at all — a pure keyword index would miss the relevant page entirely, while a vector-embedding-based semantic search catches the conceptual match, so the two are combined and their results merged and re-ranked together.

## Common mistakes

- **Using a database `LIKE '%term%'` query as a substitute for real full-text search.** This scans every row's text on every query, has no ranking, and gets untenably slow as data grows — it's fundamentally not the same operation as an indexed inverted-index lookup, even though both can technically "find matching text."
- **Over-aggressive stemming or stop-word removal for a domain where exact terms matter** (e.g., a legal or medical search product, where "acute" and "chronic" need to remain distinct, not get conflated by an overzealous stemmer tuned for general text).
- **Treating keyword search and semantic/vector search as competing choices rather than complementary ones.** Most production search systems that only pick one end up with a systematic blind spot — exact-term precision without conceptual recall, or vice versa — that hybrid search exists specifically to close.
