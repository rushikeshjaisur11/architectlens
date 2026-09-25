---
title: "NoSQL Data Models: Document, Columnar, and Graph"
short_title: "NoSQL Data Models"
tags: ["nosql", "databases", "data-modeling"]
sources:
  - "MongoDB, Cassandra, and Neo4j documentation on data modeling patterns"
  - "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017), chapter on data models"
---

## NoSQL isn't one thing — it's several different tradeoffs

"NoSQL" groups together databases that reject the single relational model, but the databases within that grouping make genuinely different tradeoffs from each other, not just from relational databases. Picking "a NoSQL database" without specifying which data model is meaningless in the same way picking "a vehicle" doesn't tell you if you got a bicycle or a truck — the right choice depends entirely on the shape of your data and your access patterns, and the three major NoSQL data models below solve different problems.

## Document databases: flexible, nested, per-entity data

Document databases (MongoDB, Couchbase) store data as self-contained documents (typically JSON-like), where related data that would require a join in a relational schema can instead be nested directly inside one document. A blog post with its comments, or a user profile with its addresses, can live as a single document rather than being split across normalized tables.

**Strength:** reading a full entity (the post with its comments) is a single document fetch — no join required, which is fast and simple for the common "get this whole thing" access pattern. Schema flexibility also means different documents in the same collection can have different fields, useful when the data genuinely varies in shape between records.

**Weakness:** the same nesting that makes single-entity reads fast makes cross-entity queries harder — "find all comments by user X across all posts" requires either a query cutting across many documents' nested structure, or a data-modeling decision to store comments separately after all, re-introducing something closer to a join. Document databases handle "read this whole aggregate" access patterns well and cross-cutting relational queries poorly, which is a design tradeoff, not a flaw — the schema should be modeled around how the data is actually queried, per this track's normalization lesson's broader point about denormalizing deliberately for known read paths.

## Columnar (wide-column) databases: optimized for write-heavy, query-by-key workloads

Columnar databases (Cassandra, HBase, Bigtable) organize data by column families rather than rows, and are built around the LSM-Tree storage engine covered in this track's storage engines lesson — meaning they're optimized specifically for high write throughput and fast lookups by a known partition key, at the cost of flexible ad-hoc querying.

**Strength:** exceptional write throughput and horizontal scalability, since the LSM-Tree append-only write pattern (per the storage engines lesson) and consistent-hashing-based partitioning (per this track's sharding lesson) are both native to this model's design. Queries by the partition key are fast and predictable.

**Weakness:** queries that don't go through the partition key are expensive or simply unsupported without extra infrastructure (a secondary index, or a separate search system) — unlike a relational database, you generally can't run an arbitrary ad-hoc query across arbitrary columns efficiently. The schema (and specifically, the choice of partition key) has to be designed around the known query patterns up front, which is a meaningfully different design process than a relational schema that can support new query patterns more flexibly after the fact.

## Graph databases: relationships as first-class data

Graph databases (Neo4j, Amazon Neptune) model data as nodes and edges, where relationships between entities are stored directly and efficiently traversable, rather than reconstructed via joins at query time. This matters specifically for data where the relationships *are* the interesting part of the query — "find all of this person's friends-of-friends who work at company X" is a natural graph traversal (follow edges outward a few hops, filtering along the way), but the same query in a relational database means a multi-way self-join that gets progressively more expensive as the number of hops (degrees of separation) increases.

**Strength:** traversal-heavy queries (social graphs, recommendation paths, fraud-detection ring analysis, dependency graphs) that would require expensive multi-way joins in a relational model are often significantly faster in a graph database, since the relationships are stored as direct pointers rather than needing to be resolved via a join on every query.

**Weakness:** graph databases are a poor fit for workloads that aren't actually relationship-traversal-heavy — using one for simple key-based lookups or tabular reporting gives up the simplicity and tooling maturity of a relational or document database for no corresponding benefit.

## A worked example

**Scenario:** a social platform needs (1) user profiles with their posts and settings, (2) a high-volume activity log (every like, comment, view event), and (3) a "people you may know" feature based on mutual connections.

- **User profiles → document database.** A profile with its settings and recent posts is naturally a single aggregate, fetched together far more often than queried piecemeal — document storage's "get the whole entity in one read" strength matches this access pattern directly.
- **Activity log → columnar database.** Extremely high write volume (every interaction event), queried almost exclusively by a known key (user ID, or event type + time range) — exactly the write-optimized, key-based-query profile columnar databases are built for, and a poor fit for a document or graph model that isn't optimized for this write pattern.
- **"People you may know" → graph database.** This is fundamentally a multi-hop relationship traversal (friends of friends, filtered by mutual-connection count) — the kind of query that gets progressively more expensive in a relational or document model as the hop count grows, but is a natural, efficient traversal in a graph model built specifically for this access pattern.

Using one database for all three would force at least two of the three workloads into a data model that doesn't match their actual access pattern — this is why large-scale systems commonly run multiple different databases side by side (**polyglot persistence**), rather than treating "pick one database" as the right question in the first place.

## Common mistakes

- **Choosing a NoSQL database by reputation or trend rather than by matching its data model to the actual query pattern.** "NoSQL scales better" isn't a coherent reason on its own — a columnar database's scalability comes specifically from a write pattern and key-based query model that may not match your workload at all.
- **Forcing relationship-heavy data into a document or columnar model** and discovering that the "find connected things" queries the product actually needs are slow or awkward to express — a sign the underlying data model doesn't match the real access pattern, not a database performance problem to be tuned away.
- **Designing a columnar database's partition key without first knowing the actual query patterns.** Unlike a relational schema, a columnar database's partition key is a foundational, hard-to-change decision — getting it wrong (per this track's sharding lesson's point about query pattern mismatch) means expensive queries or a costly re-modeling effort later.
