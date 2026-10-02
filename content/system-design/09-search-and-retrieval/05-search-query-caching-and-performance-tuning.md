---
title: "Search Query Caching and Performance Tuning"
short_title: "Query Caching & Tuning"
tags: ["search", "caching", "performance", "elasticsearch", "lucene"]
sources:
  - "Elasticsearch Reference: Shard request cache, Node query cache, Field data"
  - "Apache Solr Reference Guide: Query Settings in SolrConfig (caches)"
  - "Lucene FAQ and IndexSearcher documentation (Apache Lucene)"
---

## Where caching happens in a search stack

Search engines cache at multiple layers because different parts of a query have very different costs to recompute. In Elasticsearch and Solr (both built on **Apache Lucene**), the main caches are the **filter/query cache**, the **request/result cache**, and **field data / doc values caches** for sorting and aggregations — each targeting a distinct bottleneck rather than one generic "cache the response" layer.

## Filter cache (node query cache)

Filters — clauses that are binary yes/no (`term`, `range`, `exists`) rather than relevance-scored — are cheap to cache because their result is just a bitset of matching document IDs, independent of query context like scoring or boosting. Elasticsearch's **node query cache** stores these bitsets per (segment, filter) pair using an LRU eviction policy, and only caches filters that are used frequently enough on segments with enough documents to be worth the memory (small segments or rarely-hit filters aren't cached, since the overhead isn't justified). Because filters don't need scoring, caching them is a much bigger win per byte of cache than caching full scored queries: reusing a filter bitset across many different search requests (e.g., a `status: published` clause shared by a whole class of queries) is common, while two full scored queries are rarely byte-identical.

## Shard request cache

Elasticsearch's **shard-level request cache** caches the entire local result of a search request on a per-shard basis, keyed by the exact request body — but by default only for requests where `size: 0` (aggregations, counts) since caching full hit lists is riskier (pagination, scoring context, and freshness expectations vary more). This cache is automatically invalidated when the shard's underlying data changes (on refresh), which bounds staleness to the refresh interval rather than requiring manual invalidation logic. Solr's analogous **queryResultCache** caches ordered document ID lists per query signature and is a well-known target for warming via `firstSearcher`/`newSearcher` event listeners in `solrconfig.xml`, so a newly opened searcher isn't cold on the queries users hit most.

## Field data and doc values

Sorting, aggregating, or scripting on a field requires the engine to load per-document values into memory in a column-oriented (field-major) layout, which is expensive if rebuilt per query. Historically Elasticsearch built this lazily in an uncapped **fielddata** structure that was a frequent cause of node OOMs (a high-cardinality text field being sorted on could blow the heap). The fix, now the default for non-analyzed fields (`keyword`, numeric, date), is **doc values**: a column-oriented on-disk structure built at index time rather than query time, so the "cache" cost is paid once during indexing instead of unpredictably during the first sort/aggregation query. This is the single highest-leverage performance change in the ecosystem's history for aggregation-heavy workloads — moving cost from unbounded query-time memory to bounded, predictable disk-backed structures.

## Practical tuning levers

- **Query design**: prefer `filter` context over `must` (query context) for exact-match clauses, since filter-context calculations are both cacheable and skip scoring entirely — a `bool` query with `filter: [{term: ...}]` is materially cheaper than the same clause under `must`.
- **Warm caches deliberately** after a deploy or index reopen, since cold caches mean the first wave of real users pays full computation cost; Solr's listener hooks exist exactly for this.
- **Pagination via `search_after` instead of deep `from/size`**, because deep pagination forces Lucene to compute and discard all preceding hits on every shard, an O(from + size) cost per shard that gets worse the deeper you page.
- **Cache sizing is a memory trade-off, not a free win** — every cache above competes with the OS page cache and the JVM heap for the same RAM, so oversizing one starves the others.

## Common mistakes

- **Caching full scored queries expecting cheap reuse.** Scored (non-filter) queries rarely repeat verbatim across users, so the hit rate is low relative to the memory spent; filters are the better caching target.
- **Sorting or aggregating on `text` fields.** Analyzed text fields don't have stable per-document values suited to doc values; sorting/aggregating requires a `keyword` sub-field or explicit fielddata, and doing it accidentally on analyzed text is a classic source of unexpectedly high memory use.
- **Ignoring refresh interval as a caching lever.** A high-write index with a short (default 1s) refresh interval invalidates shard request caches constantly, killing their hit rate; increasing the refresh interval on write-heavy, read-tolerant indices can meaningfully improve cache effectiveness.
- **Deep pagination in production APIs.** Allowing `from` to grow unbounded (e.g., page 500 of results) causes each shard to sort and hold `from + size` results in memory before truncating, which scales badly and is why `search_after`/scroll APIs exist.
