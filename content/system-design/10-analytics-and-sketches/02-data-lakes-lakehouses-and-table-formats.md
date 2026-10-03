---
title: "Data Lakes, Lakehouses and Table Formats (Iceberg, Delta, Hudi)"
short_title: "Lakehouses and Table Formats"
tags: ["lakehouse", "iceberg", "delta-lake", "parquet", "data-lake", "analytics"]
sources:
  - "Apache Iceberg specification (v1 to v3), iceberg.apache.org"
  - "Delta Lake protocol documentation, delta.io"
  - "Lakehouse table format comparisons, 2026 (secondary: bigdataboutique.com, amdatalakehouse.substack.com, databricks.com blog on Iceberg v3)"
  - "Armbrust et al., 'Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics' (CIDR 2021)"
banner:
  layout: line
  nodes:
    - [doc, "files"]
    - [db, "table format"]
    - [server, "catalog"]
    - [client, "engines"]
predict:
  question: "After a GDPR erasure rewrite physically removes a user's rows, snapshot expiry is never run. Is the user's old data gone from storage?"
  options: ["Yes, because the rewrite replaces every earlier copy of the files", "Yes, because deletion vectors are applied to all snapshots at once", "No, because older snapshots keep the old files alive until expired"]
  answer: 2
  why: "Old snapshots reference old data files, so those files remain until the snapshots are expired. That is why the example expires snapshots older than 7 days."
check:
  - q: "Several independent engines (Spark, Trino, Flink) must share the same tables. Why does the lesson point to Iceberg here?"
    options: ["Iceberg is engine-neutral, with an open REST catalog many engines implement", "Iceberg stores data in a proprietary format that only those engines read", "Delta Lake cannot support deletion vectors or time travel at all"]
    answer: 0
    why: "Iceberg was designed to be engine-neutral and its REST catalog spec is widely implemented. Delta is recommended when the platform centres on Databricks."
  - q: "Why commit streaming writes roughly every minute instead of every second?"
    options: ["Object storage rejects more than one write per minute to a table", "Each commit adds metadata and small files, so frequent commits cause churn", "Snapshots can only be created on minute boundaries for time travel"]
    answer: 1
    why: "Very frequent commits multiply snapshots, metadata and tiny files, which slow reads and need more compaction."
  - q: "Why do multiple writers need a shared catalog?"
    options: ["The catalog stores the data files themselves, so engines need one copy", "Without it, each engine would need its own Parquet schema for the table", "It arbitrates concurrent commits, so writers do not conflict"]
    answer: 2
    why: "The catalog maps a table name to its current metadata and arbitrates concurrent commits. Without one, concurrent writers can conflict."
---

## Three generations of analytics storage

1. **Data warehouse.** A managed database with a rigid schema, fast SQL, ACID transactions and governance, but storage coupled to compute, proprietary formats and a high price for raw volume.
2. **Data lake.** Raw files (Parquet, ORC, JSON, CSV) in cheap object storage such as S3, readable by many engines. Cheap and flexible, but just files: no transactions, no safe concurrent writes, no schema enforcement, slow listing of millions of files, and "data swamps" when nobody knows what is current.
3. **Lakehouse.** Keep the files in open formats on object storage, and add a **table format** layer that gives them warehouse-like behaviour: ACID transactions, schema evolution, time travel and efficient planning.

## What a table format does

Columnar files (see the columnar-storage lesson) hold the data. A table format adds **metadata** that records which files make up the table at each moment:

- **Atomic commits.** A write adds new data files, then atomically publishes a new table snapshot (a pointer swap). Readers see either the old snapshot or the new one, never a half-written state.
- **Snapshot isolation and time travel.** Each snapshot is immutable, so you can query "as of last Tuesday" or roll back a bad write.
- **Schema and partition evolution.** Add, drop or rename columns, or change partitioning, without rewriting the table.
- **Efficient planning.** Metadata stores per-file statistics (min and max per column), so engines skip files that cannot match a filter without listing the directory.
- **Row-level updates and deletes.** Small changes recorded as delete files or **deletion vectors** and merged at read time (merge-on-read), or by rewriting files (copy-on-write).

## The main formats

- **Apache Iceberg.** A tree of metadata (table metadata, manifest lists, manifests) over data files; engine-neutral by design, with an open **REST catalog** specification that many catalogs implement (for example Polaris, Nessie, AWS Glue, Unity Catalog). Version 3 of the spec (ratified in 2025, per secondary sources) adds deletion vectors, row lineage, a variant type for semi-structured data and geospatial types; version 4 is under development.
- **Delta Lake.** A transaction log of JSON commits with periodic Parquet checkpoints; originated at Databricks and widely used in that ecosystem; supports deletion vectors and time travel.
- **Apache Hudi.** Designed around upserts and incremental pulls, with copy-on-write and merge-on-read tables; common for streaming ingestion.
- Others (Paimon for streaming, newer designs) fill niches.

2026 summaries describe **convergence**: Iceberg v3 adopts features first popularised by Delta (deletion vectors, row lineage, variant), and guides recommend Iceberg when several independent engines (Spark, Trino, Flink, a warehouse) must share one set of tables, and Delta when the platform is centred on Databricks. Treat these as secondary opinions; test with your engines.

## Catalogs and governance

The **catalog** maps table names to the current metadata location and arbitrates concurrent commits. It is also where access control, lineage and discovery live. A shared REST catalog is how multiple engines see a consistent table; without one, concurrent writers can conflict.

## Operating a lakehouse

- **Small files problem**: streaming writes create many tiny files that slow reads; schedule **compaction** to merge them (and to apply delete files).
- **Snapshot expiry and orphan cleanup**: old snapshots keep old files alive; expire them on a retention policy or storage costs grow forever (and note that expiry limits time travel).
- **Partitioning**: choose partitioning for common filters but avoid over-partitioning (too many small partitions); modern formats support hidden partitioning and evolution.
- **Streaming ingestion**: commit every minute or so, not every second, to limit metadata churn.
- **Security**: object-store permissions alone are coarse; enforce table, column and row policies in the catalog or engine layer, and manage encryption keys.

## A worked example

An e-commerce company ingests 2 billion events a day.

1. Events stream from Kafka into an Iceberg table partitioned by day, committing every minute; compaction runs hourly to merge small files into 256 MB files.
2. Analysts query with Trino; data scientists use Spark; both use the same REST catalog and see the same snapshot.
3. A bug writes bad data at 14:05; the team rolls the table back to the 14:00 snapshot in seconds, then fixes and replays.
4. GDPR erasure: a delete for one user writes deletion vectors immediately; a weekly rewrite physically removes the rows, and snapshots older than 7 days are expired so the deleted data does not linger.
5. Cost: raw storage on object storage at a few cents per GB-month, with query compute scaled up only when needed.

## Common mistakes

- **Treating a lake of raw files as a database.**
- **Never compacting**, so queries degrade as files multiply.
- **Never expiring snapshots**, so storage and erasure obligations are not met.
- **Letting several engines write without a shared catalog.**
- **Choosing a format by hype** instead of the engines you must support.
