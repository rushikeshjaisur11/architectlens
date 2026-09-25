---
title: "Designing a Web Crawler, End to End"
short_title: "Designing a Web Crawler"
tags: ["product-design", "case-study", "crawler", "interview-practice"]
sources:
  - "System design interview practice materials (general pattern, synthesized from multiple public writeups)"
---

## Why a web crawler exercises a different set of concepts than the earlier product designs

This track's URL-shortener and chat-system lessons exercised estimation/caching and real-time delivery, respectively. A web crawler's core challenges are different again: politeness (not overwhelming any single website), avoiding infinite loops and redundant work at massive scale, and prioritization (deciding what to crawl first among a practically unbounded set of URLs) — pulling together this track's rate-limiting, deduplication (via probabilistic structures), and distributed-queue concepts into a genuinely different combination than either earlier case study.

## Step 1: Clarify requirements

- Functional: given a set of seed URLs, discover and fetch web pages, extract new URLs from each page's content, and continue crawling discovered URLs — building an ever-growing index of crawled content.
- Non-functional: **politeness** (not sending excessive concurrent requests to any single website, respecting `robots.txt` directives), avoiding re-crawling the same URL redundantly, handling the practically unbounded scale of the web (billions of pages), and prioritizing genuinely valuable content over low-value or infinite-generation content (calendar pages that generate infinite "next month" links, for instance).

## Step 2: The core crawl loop and its distributed queue

At the core, crawling is a graph traversal: fetch a page, extract its links, add newly-discovered URLs to a queue, repeat. At web scale, this queue needs to be a distributed system in its own right (per this track's message-queue lesson), with many crawler worker processes pulling URLs to fetch from a shared queue and pushing newly-discovered URLs back onto it — the queue's throughput and reliability directly determine the whole system's crawl rate, making it a genuinely central piece of the design, not an incidental implementation detail.

## Step 3: Politeness — rate limiting per domain, not globally

A global rate limit across the whole crawler doesn't prevent overwhelming any single website — thousands of crawler workers could each independently send a modest number of requests, but if they're all hitting the same domain simultaneously, that domain still receives an overwhelming aggregate load. This directly requires per-domain rate limiting (a direct application of this track's rate-limiter lesson, but keyed by target domain rather than by API client), typically implemented by routing all requests to a given domain through a queue specific to that domain, with a controlled request rate per domain queue — ensuring `robots.txt`-declared crawl-delay directives and reasonable politeness norms are respected per site, regardless of how many total crawler workers the system runs overall.

## Step 4: Deduplication — avoiding redundant crawling at massive scale

Two related deduplication problems: avoiding re-fetching a URL that's already been crawled recently, and avoiding adding a URL to the crawl queue that's already queued or completed. Given the scale (potentially billions of URLs), an exact-membership data structure (a full hash set of every seen URL) can become a genuinely large memory cost — this is a direct, practical application of this track's probabilistic-data-structures lesson: a **Bloom filter** tracking "URLs already seen" gives a fast, memory-efficient check that's either "definitely not seen" (safe to crawl) or "probably already seen" (skip, accepting the Bloom filter's small false-positive rate as a deliberate tradeoff — occasionally skipping a genuinely new URL that happens to collide with an already-seen one in the filter, judged acceptable given the massive memory savings versus an exact set at this scale).

## Step 5: URL prioritization — not all discovered URLs deserve equal crawl priority

A pure breadth-first or depth-first crawl order treats every discovered URL identically, but real crawling benefits from prioritizing pages likely to be valuable or frequently-changing (news sites, popular pages) over low-value or rarely-changing content, and from avoiding crawler traps (pages that generate effectively infinite new URLs, like a calendar with "next month" links extending indefinitely, or a faceted-search page — per this track's search-relevance lesson's faceted-search topic — generating a combinatorial explosion of filter-combination URLs). A priority queue (rather than a simple FIFO queue) ranks discovered URLs by an estimated value/freshness score, and explicit crawl-depth or URL-pattern heuristics detect and limit crawler-trap-like structures before they consume a disproportionate share of crawl budget on low-value, effectively-infinite content.

## Step 6: Content deduplication — the same content at different URLs

Beyond exact-URL deduplication, many URLs point to genuinely duplicate or near-duplicate content (mirrored pages, URL parameters that don't change actual content, syndicated articles republished across multiple sites) — crawling and indexing every such duplicate wastes crawl budget and pollutes the resulting index with redundant content. Content-based deduplication (hashing page content, or using a near-duplicate detection technique like SimHash for content that's similar but not byte-identical) catches this at a different layer than URL-based deduplication, addressing a genuinely different source of redundancy that URL deduplication alone can't catch.

## A worked example: end-to-end crawl of a single URL

**Scenario:** a crawler worker pulls a URL from the queue and needs to process it correctly.

1. Before fetching, the worker checks the URL against the seen-URLs Bloom filter (Step 4) — if likely already seen, it's skipped; otherwise processing continues.
2. The worker checks the target domain's `robots.txt` rules and current per-domain rate-limit queue status (Step 3) — if the domain's crawl-delay hasn't yet elapsed since the last request to it, the fetch is deferred rather than sent immediately, respecting politeness even under high overall system throughput.
3. The page is fetched, and its content is hashed and checked against a content-deduplication index (Step 6) — if it matches already-indexed content closely, it's recorded as a duplicate and not separately re-indexed.
4. New links are extracted from the page, filtered against basic crawler-trap heuristics (Step 5) and the seen-URLs Bloom filter, and the surviving, genuinely-new URLs are added to the priority queue for future crawling, along with an estimated value score informing their crawl priority.

## Common mistakes

- **Using a single global rate limit instead of a per-domain one**, allowing the aggregate load from many parallel crawler workers to overwhelm a single popular target domain even while the overall system-wide request rate looks reasonable.
- **Using an exact hash set for seen-URL tracking at genuinely massive scale**, incurring unnecessary memory cost when a Bloom filter's small, deliberate false-positive tradeoff would achieve nearly the same practical deduplication benefit at a fraction of the memory footprint.
- **No crawler-trap detection**, letting the crawler's budget get consumed disproportionately by a small number of pathological, effectively-infinite-URL-generating pages (calendars, faceted search combinations) at the expense of crawling genuinely valuable new content elsewhere on the web.
