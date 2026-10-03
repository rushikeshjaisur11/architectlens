---
title: "Schema Migration Strategies at Scale: Online Migrations and Dual Writes"
short_title: "Schema Migrations at Scale"
tags: ["sql", "schema-migration", "online-migration", "dual-writes", "postgres", "mysql"]
sources:
  - "gh-ost Documentation (github.com/github/gh-ost)"
  - "Percona Toolkit: pt-online-schema-change Documentation (percona.com)"
banner:
  layout: line
  nodes:
    - [doc, "add column"]
    - [server, "backfill"]
    - [server, "dual-write"]
    - [doc, "drop old"]
predict:
  question: "During a dual-write migration, the app crashes between writing the old table and writing the new one. What state results?"
  options: ["Both tables roll back atomically, so they stay identical", "The two locations are inconsistent until reconciliation catches it", "The old table is deleted since the new write failed"]
  answer: 1
  why: "Dual writes are not atomic, which is why a verification and reconciliation step exists."
check:
  - q: "Why does gh-ost tail the binary log instead of using triggers like pt-online-schema-change?"
    options: ["Binary logs are faster than triggers at copying existing rows", "Triggers cannot capture writes made during the batch copy", "Triggers add write overhead and can conflict with other triggers"]
    answer: 2
    why: "gh-ost avoids triggers because of their write overhead and conflicts with existing triggers."
  - q: "A team enables dual writes and declares the migration complete without a backfill. What is wrong?"
    options: ["Dual writes only cover new data, so historical rows are missing", "Dual writes copy history automatically but too slowly", "The old table must be dropped before dual writes begin"]
    answer: 0
    why: "Dual-writing covers only future writes, so history needs an explicit, verified backfill."
  - q: "Why keep writing to both structures after cutting reads over to the new one?"
    options: ["To double write throughput on the new structure", "As a safety net until reads have proven the new path", "Because the old structure can never be removed safely"]
    answer: 1
    why: "The old path stays as a fallback until the new path has run long enough to build confidence, and is then removed."
---

## Why naive migrations don't scale

A `ALTER TABLE ... ADD COLUMN` on a small table is instant. On a table with hundreds of millions of rows, the same statement can take a table-level lock for the duration of a full table rewrite — minutes to hours — during which every read and write against that table blocks. In a system that can't tolerate downtime, that's not an option. **Online schema migration** is the practice of changing a live table's structure without blocking production traffic, and it's a distinct engineering problem from just writing correct DDL.

Some changes are genuinely cheap even at scale (adding a nullable column with no default in modern Postgres, adding an index `CONCURRENTLY`); others — adding a `NOT NULL` column with a default, changing a column type, adding a unique constraint — historically required a full table rewrite and are exactly where online migration tooling earns its keep.

## The shadow-table pattern

Tools like **gh-ost** (GitHub) and **pt-online-schema-change** (Percona Toolkit) for MySQL, and equivalent patterns for Postgres, share a common approach:

1. Create an empty **shadow table** with the new schema.
2. Copy existing rows from the original table to the shadow table in batches, throttled to avoid overwhelming production I/O and replication lag.
3. Capture ongoing writes to the original table during the copy — via triggers (pt-online-schema-change) or by tailing the binary replication log (gh-ost, which avoids triggers because they add write overhead and can conflict with other triggers) — and apply them to the shadow table too, keeping it in sync.
4. Once the shadow table is caught up, perform an atomic rename/cutover swapping the shadow table in for the original, typically taking a brief metadata-only lock measured in milliseconds rather than the full rewrite duration.

`CREATE INDEX CONCURRENTLY` in Postgres solves the narrower index-creation case natively, building the index without holding a blocking lock, at the cost of taking roughly twice as long and requiring a cleanup pass if it fails partway.

## Dual writes for larger structural changes

Some migrations aren't expressible as a single DDL statement — splitting one table into two, moving a column to a different service's database, or changing a column's semantic meaning. The **dual-write** pattern handles this in stages:

1. **Add the new structure** (new column, new table, new service) without removing the old one.
2. **Write to both** old and new locations on every write path, so the new structure stays populated going forward while the old one remains authoritative.
3. **Backfill** historical data from old to new in batches, matching the same batching/throttling discipline as shadow-table copies.
4. **Verify** the two are consistent — a reconciliation job comparing old vs. new for discrepancies before trusting the new path.
5. **Cut reads over** to the new structure, still writing to both as a safety net.
6. **Stop writing to the old structure** and remove it, only once reads have run against the new path long enough to build confidence.

The core risk in dual writes is that the two writes aren't atomic — a crash or partial failure between writing to the old and new location leaves them inconsistent, which is exactly what the reconciliation/backfill step exists to catch and repair. This is why each stage ships independently and stays live long enough to observe before advancing — rushing the sequence (skipping verification, or removing the old path before reads have proven the new one out) is what turns an online migration into an incident.

## Common mistakes

- **Running a blocking ALTER TABLE against a large production table** without checking whether the specific change requires a full rewrite. Not all ALTERs are equal — know which ones are metadata-only versus rewrite-triggering for the database in use.
- **Skipping the backfill verification step in dual writes.** Assuming the new table is complete because the write path is dual-writing overlooks that dual writes only cover new data going forward; historical data needs an explicit, checked backfill.
- **Cutting over reads before the shadow table or new structure is fully caught up.** Reading from a not-yet-consistent shadow table or replica-in-progress reintroduces the exact correctness problem the migration was designed to avoid.
- **Leaving the old structure in place indefinitely "just in case."** Every extra day of dual writes is extra write latency and complexity; the migration isn't done until the old path is removed, not just when the new path works.
