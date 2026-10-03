---
title: "Designing a Collaborative Document Editor"
short_title: "Collaborative Document Editor"
tags: ["collaboration", "ot", "crdt", "websockets", "presence", "design"]
sources:
  - "Ellis and Gibbs, 'Concurrency control in groupware systems' (SIGMOD 1989), operational transformation"
  - "Shapiro et al., 'Conflict-free Replicated Data Types' (2011); Yjs and Automerge documentation"
  - "Figma engineering blog, 'How Figma's multiplayer technology works' (2019)"
predict:
  question: "Bob types offline for two minutes, then reconnects with 90 buffered operations while Alice edited the same paragraph. What happens?"
  options: ["The server keeps whichever paragraph version arrived last and discards the other edits", "Bob's client discards its buffer and reloads the latest snapshot from the server", "The server integrates his operations and returns what he missed, so both edits merge"]
  answer: 2
  why: "Buffered operations are integrated on reconnect and Alice's concurrent edits merge without loss."
check:
  - q: "Why might a team choose CRDTs over OT for a collaborative editor?"
    options: ["CRDTs carry no per-character metadata, so they are smaller than OT operations", "CRDT operations commute, so they work offline and peer-to-peer with a simple relay server", "CRDTs rely on a central server to transform operations, which is easier to get right"]
    answer: 1
    why: "Commuting operations remove transformation logic and need only a relay, at the cost of id and tombstone overhead."
  - q: "Why assign each document to a single collaboration server at a time?"
    options: ["Ordering and merging happen in one place, avoiding distributed coordination for that document", "It guarantees no document is ever lost, so an operation log is unnecessary", "It lets every server apply edits independently and reconcile them later"]
    answer: 0
    why: "One owner per document avoids coordination, while the persisted log and snapshots still handle failover."
  - q: "Why broadcast cursor positions without persisting them, at a throttled rate?"
    options: ["Persisting cursors would break convergence because the log must order them", "Cursors are ephemeral, so storing them adds write load for no value", "Persisted cursors would leak positions to users without edit permission"]
    answer: 1
    why: "Presence data is ephemeral, so it is broadcast at roughly 10 to 20 updates a second and never stored."
---

## The problem

Several people edit one document at the same time and see each other's changes within a fraction of a second, cursors and selections included, even on flaky connections. No keystroke may be lost, every replica must end with the same text, and the result should respect what each user *meant*. Google Docs, Figma and Notion are well-known examples.

## Requirements

- **Latency**: a local edit appears instantly (optimistic); remote edits appear within about 100 to 300 ms.
- **Convergence**: all clients end with identical content.
- **Intention preservation**: if Alice inserts a word and Bob deletes a nearby sentence, both intentions survive.
- **Offline and reconnection**: edits made offline merge cleanly.
- **Scale (example)**: 10 million documents, 100,000 concurrent editing sessions, up to 100 collaborators in one document.
- **Durability, history and permissions**: version history, comments, access control.

## The core difficulty

Suppose the text is "AB". Alice inserts "X" at position 1 ("AXB") while Bob concurrently deletes the character at position 1 ("A"). Applying each operation to the other's result naively gives different outcomes. The system must transform or structure operations so that all replicas converge.

## Approach 1: operational transformation (OT)

A central server receives operations, imposes a total order, and **transforms** each incoming operation against operations it did not know about, so it applies correctly to the current state. Clients keep a buffer of unacknowledged local operations and transform incoming server operations against them. OT is the lineage of Google Docs. Strengths: compact operations, no per-character ids, well understood for linear text with a central server. Weaknesses: transformation functions are hard to get right (many published algorithms had bugs), and it relies on a central ordering server.

## Approach 2: CRDTs

Give each character (or object) a unique, ordered identifier so that concurrent inserts and deletes **commute**: any replica applying the same set of operations, in any order, reaches the same state (see the CRDT lesson). Libraries such as Yjs and Automerge implement text and structured data CRDTs. Strengths: works peer-to-peer and offline, no transformation logic, simple server (a relay and a store). Weaknesses: metadata overhead (ids, tombstones) and the need to compact history.

Figma describes a hybrid in its multiplayer system: a **server-authoritative** model that borrows CRDT ideas for properties, where the server decides the final order and last-writer-wins applies per property, which suits design objects better than text.

## Architecture

1. **Clients** keep a local copy, apply edits optimistically, and send operations over a **WebSocket**.
2. **Collaboration servers** (stateful): each document is assigned to one server at a time (consistent hashing on document id), which holds the live in-memory state, orders or merges operations and broadcasts them to connected clients. Assigning one owner per document avoids distributed coordination for that document.
3. **Persistence**: append operations to a log (and periodically snapshot the document), so a crashed server's documents can be loaded by another from snapshot plus log tail.
4. **Presence service**: cursors and selections are ephemeral; broadcast them without persisting, throttled to about 10 to 20 updates a second.
5. **Version history**: keep snapshots at intervals and the operation log to reconstruct any point in time.
6. **Permissions and sharing**: enforce on connect and on every operation; revoke connections when access changes.
7. **Search, comments, notifications** run asynchronously from the log.

## Failure and scale details

- **Reconnect**: the client sends its last acknowledged version; the server replays missing operations or sends a fresh snapshot if the gap is large.
- **Server failover**: the lease on a document moves to another server; clients reconnect and resync from the persisted log.
- **Hot documents**: a document with thousands of viewers separates a few editors from many read-only subscribers served from a broadcast tier.
- **Large documents**: split into blocks or pages so operations touch small structures and clients load lazily.
- **Compaction**: periodically merge the log into a snapshot and garbage-collect CRDT tombstones once all clients have caught up.

## A worked example

Three users edit a 20-page document.

1. Each keystroke becomes an operation sent over a WebSocket; the local screen updates at once.
2. The server owning the document broadcasts operations to the other two clients within about 40 ms of arrival.
3. Bob's train enters a tunnel; he keeps typing for two minutes. On reconnect he sends 90 buffered operations; the server integrates them and returns what he missed. Alice's concurrent edits to the same paragraph merge without loss.
4. The server snapshots the document every 500 operations and appends all operations to a log; a 20-page document stays near 100 KB per snapshot.
5. When the collaboration server restarts, a peer loads the last snapshot plus the log tail and takes over within seconds.

## Common mistakes

- **Locking paragraphs or documents**, which defeats collaboration.
- **Last-writer-wins on whole documents.**
- **Sending the whole document on every change.**
- **Persisting cursor positions** like content.
- **Ignoring history growth** until loading slows.
