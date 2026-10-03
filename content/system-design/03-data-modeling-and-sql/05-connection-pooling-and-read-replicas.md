---
title: "Connection Pooling and Read Replicas"
short_title: "Pooling & Read Replicas"
tags: ["sql", "connection-pooling", "read-replicas", "scalability", "postgres"]
sources:
  - "PgBouncer Documentation (pgbouncer.org)"
  - "PostgreSQL Documentation: High Availability, Load Balancing, and Replication (postgresql.org/docs)"
banner:
  layout: line
  nodes:
    - [server, "app"]
    - [lb, "pooler"]
    - [db, "primary"]
    - [db, "replica"]
predict:
  question: "A user saves their profile, and the app immediately reads it back from a read replica that is a few hundred milliseconds behind. What does the user see?"
  options: ["The old profile data, because the replica has not caught up", "The new profile data, because replicas replicate synchronously", "An error, because replicas reject reads right after a write"]
  answer: 0
  why: "Replicas are eventually consistent, so a read-your-writes violation can show stale data."
check:
  - q: "Fifty app pods each run their own pool of 20 connections to Postgres. What is the risk?"
    options: ["Pools reuse connections, so the database sees only 20 in total", "Pods multiply connections to 1000, which can exceed the database limit", "Application pools cannot be used alongside an external pooler"]
    answer: 1
    why: "Per-instance pools multiply, so an external pooler like PgBouncer is often needed on top."
  - q: "Why is transaction-mode pooling risky for code that relies on session state?"
    options: ["Connections swap per transaction, so SET or prepared statements vanish", "It holds one connection per client for the whole session, wasting idle slots", "It forces every statement onto the primary database, ignoring replicas"]
    answer: 0
    why: "Transaction pooling returns the connection after each transaction, which breaks session-scoped features."
  - q: "Adding read replicas to a write-saturated primary will do what?"
    options: ["Raise write throughput, since replicas also accept writes", "Fix write load because replicas share the transaction log", "Not help writes, since all writes still go through the primary"]
    answer: 2
    why: "Replicas scale reads only; every write still goes through the primary and replicates outward."
---

## Why connections are expensive

Each database connection consumes real resources on the server — in PostgreSQL, every connection spawns a dedicated backend process with its own memory footprint, and the default configuration tops out in the low hundreds of connections before performance degrades. An application server that opens a new connection per request (or worse, per query) pays a real cost: TCP handshake, authentication, backend process fork, and eventually connection exhaustion under load — the database starts rejecting new connections while existing ones sit mostly idle between queries.

**Connection pooling** solves this by maintaining a fixed set of long-lived connections that application threads borrow and return, rather than opening and closing connections per request. Application-side pools (HikariCP for JVM, SQLAlchemy's pool, Go's `database/sql` pool) live inside the application process. External poolers like **PgBouncer** sit as a proxy between many application connections and a small set of real database connections, which matters when you have many application instances (e.g., a fleet of serverless functions or horizontally scaled pods) each wanting their own pool — without a shared external pooler, N app instances × M connections each can still exceed the database's connection limit.

## Pooling modes

PgBouncer's three modes trade isolation for efficiency:

- **Session pooling**: a client holds a server connection for its entire session. Safest — full compatibility with session-level features (prepared statements, advisory locks, `SET` commands) — but the least efficient, since idle sessions still hold a real connection.
- **Transaction pooling**: a server connection is assigned only for the duration of a transaction, then returned to the pool. Much higher connection reuse, but breaks anything that depends on session state persisting across transactions (session-level temp tables, `SET` outside a transaction, some prepared statement caching).
- **Statement pooling**: connection is returned after each statement. Rarely used — breaks multi-statement transactions entirely.

Most high-throughput production setups use transaction pooling and adjust application code to avoid session-scoped features, since it delivers the best ratio of application connections to real database connections.

## Read replicas

A **read replica** is a copy of the primary database kept in sync via streaming (physical) or logical replication, serving read-only queries so the primary isn't the bottleneck for every request. This is a horizontal scaling strategy specifically for read-heavy workloads — it does nothing for write throughput, since all writes still go through the primary and replicate outward.

The critical consequence is **replication lag**: replicas are eventually consistent with the primary, not synchronously consistent (unless configured for synchronous replication, which adds write latency). A write committed on the primary may not be visible on a replica for milliseconds to seconds, depending on load and network. This creates real correctness hazards:

- **Read-your-writes violations.** A user updates their profile, then immediately reads it back from a replica that hasn't caught up yet, and sees stale data. Common fixes: route the immediate post-write read to the primary, use session-level "read your own writes" routing, or accept the staleness for non-critical paths.
- **Routing logic.** Applications need explicit read/write splitting — either in application code (route writes and read-after-write queries to the primary, everything else to replicas) or via a proxy/driver that understands the topology.

## Common mistakes

- **Pooling in the application AND assuming the database sees only a few connections.** With multiple app instances each running their own pool, connections multiply; an external pooler (or a shared pool per host) is often needed on top of application-level pooling, not instead of it.
- **Using transaction-mode pooling with session-dependent code.** Prepared statements bound to a session, or `SET search_path` expected to persist, silently break or behave inconsistently under transaction pooling — a frequent source of "works locally, flaky in production" bugs.
- **Treating replicas as universally safe for reads.** Analytics and dashboards tolerate seconds of staleness fine; a checkout flow reading its own just-written order does not. The routing decision needs to be made per query path, not globally.
