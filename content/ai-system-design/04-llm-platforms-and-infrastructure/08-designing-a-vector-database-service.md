---
title: "Designing a Vector Database Service"
short_title: "Vector Database Service"
tags: ["vector-database", "ann", "sharding", "storage", "platform", "design"]
sources:
  - "Malkov and Yashunin, 'Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs' (2018)"
  - "Subramanya et al., 'DiskANN: Fast Accurate Billion-point Nearest Neighbor Search on a Single Node' (2019)"
  - "Public documentation of vector databases on collections, partitions, replication and filtering"
  - "pgvector 0.8.0 release notes and documentation (iterative index scans, HNSW dimension limits), via secondary summaries, 2026"
  - "Vector database comparisons and cost write-ups, 2026 (secondary: firecrawl.dev, dev.to, leanopstech.com)"
banner:
  layout: line
  nodes:
    - [doc, "vectors"]
    - [server, "shards"]
    - [db, "HNSW index"]
    - [user, "top-k"]
predict:
  question: "A tenant upserts 100,000 vectors and queries immediately with a category filter. Are the new vectors searched?"
  options: ["Yes, the mutable segment is brute-force scanned and includes them", "No, they appear only once the background index build finishes", "Yes, but only after compaction merges them into a sealed segment"]
  answer: 0
  why: "Queries search every segment, with the mutable one scanned by brute force, so fresh writes are visible before any ANN index exists for them."
check:
  - q: "Why does post-filtering fail for a very selective filter?"
    options: ["It forces a rebuild of the HNSW graph for every query", "The ANN search returns top-k first, so discarding non-matches leaves few results", "Metadata filters cannot be evaluated after vectors are scored"]
    answer: 1
    why: "Post-filtering throws away most results when the filter is selective, which is why production systems use filter-aware search."
  - q: "Why can adding more shards hurt query performance?"
    options: ["Fan-out to every shard raises cost and tail latency, offsetting smaller indexes", "Smaller shards force a full re-index each time a vector is deleted", "Shards must be scaled with replicas, which doubles total storage"]
    answer: 0
    why: "A query fans out to all shards and merges, so over-sharding makes fan-out the latency bottleneck."
  - q: "Why monitor recall by sampling exact search rather than watching latency alone?"
    options: ["Exact search is cheap enough to run on every query in production", "Latency percentiles cannot be computed once data is sharded", "Fast ANN answers can still miss true neighbours, and only exact results expose it"]
    answer: 2
    why: "Latency says nothing about quality; comparing sampled ANN output with exact search yields the recall figure (96 percent in the example)."
---

## The problem

Applications need to store billions of embeddings with metadata and retrieve nearest neighbours in milliseconds while the data keeps changing. A **vector database service** is a distributed storage and search system: it must combine an approximate nearest neighbour (ANN) index with durable storage, filtering, updates, replication and multi-tenancy, which are hard to get together because ANN indexes dislike being modified.

## Step 1: Requirements

- **API:** create collections, upsert and delete vectors with metadata, query by vector with filters, batch operations.
- **Performance:** p99 query latency under 50 ms at high recall (95 percent or better), thousands of queries per second.
- **Freshness:** writes searchable within seconds.
- **Durability and availability:** no data loss, survive node failures.
- **Scale (example):** 2 billion vectors of 768 dimensions across tenants, 5,000 QPS.
- **Cost:** memory is the main cost driver.

## Step 2: Storage and index architecture

A common layout is an **LSM-like structure** adapted to vectors:

- **Write path:** writes land in a write-ahead log for durability and in an in-memory **mutable segment** that supports brute-force or small-graph search.
- **Sealing and indexing:** when a segment fills it is sealed and an ANN index (HNSW or an IVF variant) is built in the background, producing an immutable indexed segment.
- **Compaction:** small segments merge into larger ones, rebuilding the index and applying deletes.
- **Query path:** a query searches every segment (the mutable one by brute force, indexed ones by ANN), then merges the top results.

Immutable segments are easy to replicate, cache and snapshot to object storage; the mutable segment gives freshness; compaction restores efficiency.

## Step 3: Choosing the index per workload

- **HNSW:** best recall and speed, memory hungry, costly to update and delete in place.
- **IVF with product quantization:** compact and fast to build, lower recall, good when memory dominates.
- **Disk-based graph indexes:** keep the graph and full vectors on SSD with compressed vectors in memory, trading latency for much lower cost at billion scale.

Expose index type and parameters (graph connectivity, search effort, quantization) as collection settings, since the right trade-off is workload-specific. Offer **tunable search effort per query** to trade recall for latency.

## Step 4: Distribution

- **Sharding:** split a collection across nodes by vector id hash; a query fans out to all shards and merges. More shards cut per-shard index size and latency but increase fan-out cost and tail latency.
- **Replication:** each shard has replicas for availability and read throughput; leaderless or leader-based replication with the write-ahead log shipping changes.
- **Tiering:** hot segments in memory, warm on SSD, cold in object storage, moved by access patterns.
- **Separation of storage and compute:** segments live in object storage and query nodes load and cache them, allowing elastic scaling of compute without data copies.

## Step 5: Filtering

Metadata filters are the hardest part. Post-filtering throws away most results for selective filters; pre-filtering by brute force is slow. Production systems use **filter-aware search**: build inverted indexes over metadata, estimate filter selectivity, and choose a strategy per query: brute force over the small filtered set when very selective, filtered graph traversal when moderate, plain ANN with post-filter when the filter is loose. Partition by tenant to make the common filter a cheap partition selection.

## Step 6: Updates, deletes and consistency

Deletes and updates are handled with **tombstones** applied at query time and cleaned up at compaction. Consistency is usually tunable: strong consistency waits for the write to be visible on all replicas, **bounded staleness** allows reads to lag by a time window, eventual is cheapest. For RAG, bounded staleness of a few seconds is normally enough; make it a per-request option.

## Step 7: Operations

Monitor recall (via periodic exact-search sampling), latency by percentile, segment counts and compaction backlog, memory per shard and replication lag. Support **rebalancing** shards without downtime, backup and restore from snapshots, and zero-downtime **re-indexing** when embeddings or parameters change, using blue-green collections. Multi-tenant limits (vectors, QPS, memory) protect shared clusters.

## A worked example

**Scenario:** a tenant upserts 100,000 new vectors and immediately queries with a category filter.

1. Upserts append to the write-ahead log and the mutable segment; the call returns once the log is replicated.
2. The query fans out to 16 shards. On each, the planner sees the category filter matches 2 percent of data and picks filtered traversal; the mutable segment is scanned by brute force and includes the new vectors.
3. Shards return their local top 10 with scores; the coordinator merges the lists and returns the global top 10 in 22 ms.
4. In the background the sealed segment is indexed and later compacted with older ones, dropping tombstoned vectors.
5. A sampled exact search compares results with the ANN output: recall of 96 percent is logged, with an alert if it falls below the target.

## Enterprise practice (verified October 2026)

**Basics.** Store embeddings with metadata, build an ANN index (HNSW or IVF), filter, return top-k, scale by sharding and replication (steps above).

**Facts to design with (October 2026, secondary sources).**

- **Filtered search is the enterprise failure mode.** Before pgvector 0.8.0, filters were applied *after* the ANN scan, so selective filters returned fewer results than requested. **pgvector 0.8.0 adds iterative index scans** (`hnsw.iterative_scan = relaxed_order | strict_order`), continuing the scan until enough filtered rows are found or `hnsw.max_scan_tuples` (default 20,000) is reached. Test recall under your real tenant and ACL filters, not on unfiltered benchmarks.
- **Limits.** HNSW in pgvector indexes up to about **2,000 dimensions** for `vector`, 4,000 for `halfvec`, 64,000 for `bit`; pick the embedding dimension and quantisation with this in mind. **pgvectorscale** (a separate Timescale extension) adds a disk-based StreamingDiskANN index to extend beyond RAM.
- **Cost shape.** Practitioner write-ups put pgvector as the cheapest option up to a few million vectors on an existing Postgres, managed Qdrant in the low hundreds of dollars per month at about 10M vectors of 1,536 dimensions, and serverless Pinecone-style pricing higher at that size. Numbers vary with query volume and are vendor-sensitive: model yours.

**Enterprise pattern.** Start in Postgres if you already run it and have under a few million vectors, with a clear exit criterion (recall, p99, index build time, memory). Move to a purpose-built store when you need very large indexes, high write throughput or advanced filtering. In every case: version indexes with the embedding model, isolate tenants (separate collections or enforced filters), plan re-embedding as a migration, and benchmark recall at the filter selectivity you actually have.

## Common mistakes

- **Treating ANN indexes as freely updatable**, with no write buffer or compaction design.
- **Post-filtering selective filters**, destroying recall.
- **Over-sharding**, making fan-out the latency bottleneck.
- **Never measuring recall**, only latency.
- **Changing embedding models in place** instead of building a new collection.
