---
title: "Designing a Feature and Embedding Store"
short_title: "Feature and Embedding Store"
tags: ["feature-store", "embeddings", "mlops", "online-serving", "consistency", "platform", "design"]
sources:
  - "Public documentation of open-source and managed feature store systems"
  - "Sculley et al., 'Hidden Technical Debt in Machine Learning Systems' (NIPS 2015), on training-serving skew"
  - "Public documentation on vector databases and embedding versioning"
  - "pgvector documentation (dimension limits, iterative scans) and embedding model roundups, 2026 (secondary)"
---

## The problem

Machine learning and AI features need data prepared as **features** (a user's purchase count in the last 30 days, a document embedding) in two places: offline for training and evaluation, and online for low-latency serving. Computing them separately in each place causes **training-serving skew**, duplicated work and inconsistent definitions across teams. A feature and embedding store is the shared system that defines features once, computes them reliably, serves them fast and tracks their lineage, including the embeddings that LLM applications increasingly depend on.

## Step 1: Requirements

- **Single definition** of each feature used for both training and serving.
- **Offline store:** historical values at scale for training sets, with point-in-time correctness.
- **Online store:** single-digit-millisecond reads by entity key for live inference.
- **Freshness:** batch, streaming and on-demand computation as needed.
- **Embeddings:** versioned vectors with similarity search and metadata.
- **Governance:** ownership, documentation, access control, lineage, quality monitoring.
- **Scale (example):** 500 million entities, 10,000 feature reads per second, p99 under 15 ms.

## Step 2: Core concepts

- **Entity:** the thing features describe (user, product, document), with a key.
- **Feature:** a named, typed value computed from raw data, with a definition and owner.
- **Feature view:** a group of features sharing an entity and a computation.
- **Offline store:** a data warehouse or lake holding full history.
- **Online store:** a low-latency key-value store holding the **latest** values.
- **Materialisation:** moving computed features from offline to online.
- **Registry:** metadata catalogue of entities, features, versions, lineage and consumers.

## Step 3: Computation patterns

- **Batch features:** computed on a schedule from warehouse data (daily aggregates), written to both stores.
- **Streaming features:** computed continuously from event streams (clicks in the last 10 minutes) with windowed aggregations, updating the online store in near real time and appending to the offline history.
- **On-demand features:** computed at request time from the request payload (the length of this query), defined with the same code path used in training.

Using **the same transformation code** for training and serving, or a framework that guarantees equivalence, is the point of the store.

## Step 4: Point-in-time correctness

Training sets must reflect what was known **at the time of each example**, or labels leak future information and models look better offline than they are. The offline store keeps timestamped feature values, and the training-set builder joins each labelled event to the feature values as of its timestamp (an as-of join), never the latest. Verify with tests that detect leakage, and keep event time and processing time distinct.

## Step 5: Online serving

The online store is a key-value database (in-memory or SSD-backed) partitioned by entity key, replicated for availability, holding the latest feature vector per entity. Serving reads multiple feature views in one batched call. Design for: tight latency, hot-key protection, TTLs for stale entities, regional replication, and graceful handling of **missing features** (defaults and null flags the model was trained to expect). Cache aggressively at the application layer when freshness allows.

## Step 6: Embeddings as first-class features

Embeddings are features with extra needs:

- **Versioning:** every vector is tied to the model and version that produced it; vectors from different versions must not be mixed in one similarity search.
- **Generation pipelines:** batch backfills and incremental updates when source content changes, deduplicated by content hash.
- **Storage and search:** a vector index (approximate nearest neighbours) alongside the key-value lookup, with metadata filters.
- **Lifecycle:** reindexing on model upgrades using blue-green collections, evaluation before cutover, and retention of the old index for rollback.
- **Reuse:** one embedding of a catalogue, used by search, recommendations and RAG, instead of each team embedding separately.

## Step 7: Quality, monitoring and governance

Monitor feature **freshness** (age of last update), **completeness** (null rates), **distribution drift** against training data, and **online-offline consistency** (sample entities and compare served values with recomputed ones). Alert on pipeline lag and schema changes. Enforce access control per feature (sensitive attributes), document ownership and expected use, track which models consume which features so changes can be assessed for impact, and support deprecation with notice. For privacy, honour deletion by entity across both stores.

## Step 8: Build or buy

Managed and open-source feature stores exist; choose based on your batch and streaming stack, latency needs and team size. A minimal viable version is a registry plus shared transformation code, a warehouse for offline history and a key-value store for online serving. Add streaming and embeddings as demand grows. Avoid building a platform before several teams share features.

## A worked example

**Scenario:** a marketplace uses features for ranking and an embedding of each listing for recommendations.

1. The `user_activity` feature view defines `views_last_7d` (batch, daily), `clicks_last_10m` (streaming) and `query_length` (on-demand), owned by the ranking team.
2. Training builds a dataset of past impressions, joining each to feature values **as of the impression time**; an automated test confirms no feature value is dated after its label.
3. Online, the ranking service fetches the three feature views for the user and 50 candidate listings in one batched call in 6 ms, with defaults for new users.
4. Listing embeddings are produced by an embedding model v2 whenever a listing changes, stored with the model version, and indexed in a vector collection; the "similar listings" service searches only version-2 vectors.
5. A weekly consistency check samples 10,000 entities and compares online values to recomputed offline ones; it detects a 3 percent mismatch in one feature caused by a timezone bug in the streaming job, which is fixed before it degrades the model.

## Enterprise practice (verified October 2026)

**Basics.** Compute features and embeddings once, store them with versions, serve at low latency, and keep training and serving consistent (steps above).

**Facts that shape the design (2026, secondary sources).** Embedding models now differ by dimension, multimodality and licence, and providers retire or replace models, so **a vector is only meaningful with its model id and version**. Index limits are real: pgvector HNSW handles up to about 2,000 dimensions for full vectors (4,000 for half-precision), and approximate indexes need filter-aware scans (iterative scans from pgvector 0.8). LLM-derived features (summaries, tags, intent labels) are cheap to regenerate but drift when the generator changes.

**Enterprise pattern.**

- **Version everything:** feature definition, embedding model, prompt that generated an LLM feature, and the source data snapshot; make the version part of the key.
- **Point-in-time correctness:** training sets join features as they were at event time, never as of today, otherwise offline metrics leak the future.
- **Dual-write migration for embedding changes:** build the new index in parallel, shadow-query both, compare recall and business metrics, then switch and retire; budget the re-embedding cost (tokens times corpus size) up front.
- **Freshness and TTL SLOs** per feature, backfill and replay tooling, access control and lineage so a deleted or revoked source disappears from derived features, and monitoring for null rates and distribution drift.

## Common mistakes

- **Separate code paths** for training and serving, causing skew.
- **Joining latest feature values to historical labels**, leaking the future.
- **Mixing embedding versions** in one index.
- **No freshness or drift monitoring.**
- **Building a feature platform** before there are shared features to serve.
