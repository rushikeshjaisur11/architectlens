---
title: "Case Study: Uber's Schemaless and DOSA Data Platform"
short_title: "Uber Schemaless and DOSA"
tags: ["case-study", "uber", "datastore", "mysql", "schemaless"]
sources:
  - "Uber Engineering blog, 'Designing Schemaless, Uber Engineering's Scalable Datastore Using MySQL' (2016)"
  - "Uber Engineering blog and open-source repository for DOSA (Declarative Object Store Abstraction)"
  - "Chang et al., 'Bigtable: A Distributed Storage System for Structured Data' (Google, OSDI 2006), for the data model Schemaless resembles"
  - "Uber Engineering, 'Evolving Schemaless into a Distributed SQL Database' (Docstore, 23 February 2021), uber.com/us/en/blog/schemaless-sql-database (fetched October 2026)"
  - "Uber Engineering, 'MySQL to MyRocks Migration in Uber's Distributed Datastores' (2022), uber.com (via search results, October 2026)"
---

*Provenance note (October 2026): the cell model (row key, column name, ref key, JSON body), append-only immutability, the 2014 move off a single PostgreSQL instance, triggers and secondary indexes were checked against Uber's Schemaless post, and Docstore against Uber's 2021 post. Hash-based shard placement, the fixed shard count and the DOSA and Cassandra details come from recall and were not re-fetched.*

## The problem Uber faced

Uber's early trip data lived in a single PostgreSQL database. As the business grew explosively, several limits appeared at once: write volume outgrew one machine, scaling vertically was running out of road, and **schema changes on huge tables were painful** in a company that shipped features constantly. They needed a datastore that scaled horizontally, was operationally predictable, and let product teams evolve data shape quickly, without throwing away the reliability of a database the team knew how to run.

## Schemaless: a key-value-like store on MySQL

The design choice that makes this study interesting is what Uber did **not** do: they did not adopt a brand-new database engine. They built a layer on top of sharded **MySQL**, whose behavior their engineers already understood deeply (replication, backups, failure modes).

The data model resembles a sparse, versioned map, similar in spirit to Bigtable:

- A record is a **cell** identified by a **row key** (a UUID), a **column name**, and a **reference key** (a version number).
- The cell's body is an opaque JSON blob. The store does not enforce a schema on the inside, which is the "schemaless" part: product teams can add fields without a database migration.
- Cells are **append-only and immutable.** An update writes a new cell with a higher reference key; it never overwrites. Old versions remain, which gives history and makes concurrent writers easier to reason about.

## Sharding and layout

Data is split across many MySQL clusters called **shards**, chosen by hashing the row key, so all cells for one row live together. Each shard is a primary with replicas; failover promotes a replica. Because the number of shards is fixed ahead of time (many more logical shards than physical servers), shards can later be moved between servers to rebalance, without re-hashing keys.

Why append-only and immutable? It simplifies replication and failure handling: writes are inserts, readers never see torn updates, and recovering from a primary failure does not involve reconciling overwritten values.

## Secondary indexes and triggers

A key-value model alone cannot answer "all trips for this driver". Schemaless supports **secondary indexes** defined on fields within the JSON, maintained in separate index tables, which may live on different shards than the data. This makes index updates **eventually consistent**: a new write is visible by key immediately, while the index entry follows shortly after.

Schemaless also offered **triggers**: because every write is an append in an ordered log per shard, downstream consumers can follow new cells in order and react. This was used to drive workflows and asynchronous processing, such as billing steps, from the datastore's own change stream rather than via dual writes to a separate queue.

## DOSA: a higher-level abstraction

Raw blob storage gave teams flexibility but too little structure: no declared types, no enforced fields, harder discovery and no easy way to evolve data safely. **DOSA (Declarative Object Store Abstraction)** was Uber's answer at the developer layer: services **declare entities** (typed schemas with partition and clustering keys) in code, and the library handles creating and altering tables and mapping objects to storage.

The notable design point is that DOSA presented a **uniform interface across different backends**, with Cassandra as one underlying store for some workloads, so application code did not depend on which storage engine a team used. The platform team could change or scale the backend without rewriting every service. This is the classic **abstraction layer** trade-off: developer ergonomics and portability, in exchange for a narrower feature set than a raw database offers.

## Trade-offs and lessons

- **Build on what you can operate.** Layering on MySQL meant known tooling, known failure modes and a deep talent pool, which mattered more than the elegance of a new engine.
- **Schema flexibility has a cost.** Opaque JSON speeds iteration but pushes validation and discoverability to application code; DOSA later reintroduced declared structure for exactly this reason.
- **Append-only simplifies concurrency**, at the price of storage growth and the need for garbage collection and read logic that picks the latest version.
- **Eventually consistent indexes** scale well but force applications to tolerate brief gaps between a write and its appearance in queries.
- **Pre-sharding into many logical shards** makes later rebalancing feasible.
- **Evolving a platform is part of the design.** Uber continued to move toward more structured, more strongly consistent offerings as needs matured.

## A worked example

**Scenario:** storing a trip record.

- The trip service writes a cell with row key = trip UUID, column = `BASE`, reference key = 1, body = the JSON of the initial trip. The row key hashes to shard 217.
- When the trip ends, a second cell is appended for column `STATUS` with reference key 2 (completed fare, end time). Readers asking for the trip fetch the latest version of each column.
- A secondary index keyed by driver ID and date lets the driver app list recent trips; it updates asynchronously, so a trip may appear in the list a moment after completing.
- A trigger on the trip data stream feeds the billing pipeline, processing cells in order without the trip service needing to publish a separate event.

## Current practice (verified October 2026)

Schemaless evolved into **Docstore**, a general-purpose multi-model database Uber describes as offering strict serializability per partition. Its layers are a stateless query engine, a distributed storage engine and a control plane. Storage is still MySQL, now on **MyRocks** (an LSM-tree engine on RocksDB), and **Raft** replicates each partition across 3 to 5 nodes, with a MySQL transaction as the replication unit. Uber reported moving all Schemaless and some Docstore instances to MyRocks since 2019, because disk space was the bottleneck at tens of petabytes. The lesson for builders is the same as above in a stronger form: a sharded relational engine plus a consensus layer for replication can grow into a distributed SQL-style database, but only a platform team operating at this scale should build one; most teams should buy a managed distributed database. The primary posts date from 2021 and 2022, so check for newer Uber engineering writing.

## Common mistakes when borrowing this idea

- **Assuming schemaless means no schema**; the schema just moves into your code, and you still need versioning discipline.
- **Overwriting in place** in an append-oriented design, losing the benefits.
- **Expecting strongly consistent secondary indexes** when they are asynchronous.
- **Choosing too few shards** up front, making later growth hard.
- **Skipping the abstraction layer**, letting every team couple directly to the storage engine.
