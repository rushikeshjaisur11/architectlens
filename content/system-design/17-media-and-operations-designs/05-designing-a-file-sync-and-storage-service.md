---
title: "Designing a File Sync and Storage Service (Dropbox-style)"
short_title: "File Sync and Storage Service"
tags: ["file-sync", "storage", "chunking", "deduplication", "design", "metadata"]
sources:
  - "Dropbox Tech Blog, 'Rewriting the heart of our sync engine' (Nucleus, 2020) and 'Inside the Magic Pocket' (2016)"
  - "Muthitacharoen, Chen and Mazieres, 'A Low-bandwidth Network File System' (SOSP 2001), content-defined chunking"
---

## The problem

A user edits a file on a laptop and the change appears on their phone and on a colleague's machine moments later, even if some devices were offline. The service stores billions of files, saves bandwidth by sending only what changed, handles conflicts, and never silently loses data.

## Requirements

- **Sync correctness**: eventually every device converges; no lost updates.
- **Efficiency**: upload and download only changed parts of large files.
- **Durability**: very high (data survives disk, server and data-centre failures).
- **Sharing and permissions**; version history and undelete.
- **Scale (example)**: 500 million users, 1 billion files per day touched, average file 1 MB but some many GB.
- **Latency**: small changes visible on other devices in seconds.

## Separate metadata from content

The key architectural split:

- **Block storage** holds file contents as immutable, content-addressed **blocks**.
- **Metadata service** holds the namespace (folders, file names, permissions) and, for each file version, the **ordered list of block hashes** that make it up.

A file is just a list of block references. Metadata is small and needs strong consistency and transactions; blocks are huge and need cheap, durable storage.

## Chunking and deduplication

Split each file into chunks (commonly around 4 MB), hash each chunk (SHA-256), and store a chunk by its hash. If the hash already exists anywhere in the system, **skip the upload**: this is **deduplication**, which saves storage and bandwidth when many users store the same files or when an edit leaves most chunks unchanged. For edits that insert or delete in the middle of a large file, fixed-size chunks all shift; **content-defined chunking** (a rolling hash picks boundaries from the content itself, as in the LBFS paper) keeps unchanged regions as identical chunks, so an insert changes only one or two.

Security note: cross-user deduplication can leak whether someone else has a file (a side channel); services mitigate with per-user checks, proofs of ownership and limits.

## The sync protocol

Each client runs a **sync engine** with a local database of what it believes the server has:

1. A file watcher detects a change; the engine chunks and hashes the file.
2. It asks the server which block hashes are missing, uploads only those, then commits a **new file version** in the metadata service referencing the new hash list. The commit is atomic and carries the **base version** the edit was made against.
3. Other devices learn of changes through a **long-poll or push channel** (a notification service that says "your namespace changed at cursor N"), then fetch the metadata delta since their last cursor and download missing blocks.

Correctness comes from a **per-namespace, strictly ordered journal** of changes: each commit gets a monotonically increasing id, devices remember their last cursor, and replaying the journal from any cursor yields the same state. Dropbox's account of rewriting its engine (Nucleus) emphasises designing so that invalid states are unrepresentable and testing with randomised simulation of concurrent events.

## Conflicts

If two devices edit the same file from the same base version, the second commit finds a newer version and **cannot overwrite**. The standard resolution is to keep both: the loser is saved as a **conflicted copy** ("report (Alice's conflicted copy).docx"). Silent last-writer-wins would lose data; automatic merging is only safe for formats the service understands.

## Storage layer

- **Blocks** are written to a distributed object store with erasure coding or replication across failure domains; very large providers build their own storage for cost (Dropbox described its "Magic Pocket" system).
- **Hot and cold tiers**: recently used blocks on faster storage, old versions on cheaper cold storage.
- **Garbage collection**: a block can be deleted only when no file version and no retention policy references it; reference counting or periodic mark-and-sweep with safety delays avoids deleting live data.
- **Encryption** at rest, per-user or per-team keys for enterprise customers.

## Scaling the metadata

Shard metadata by **namespace (user or team folder)**, so one namespace's operations stay on one shard and can use transactions. Heavily shared team folders are the hot spots; give large namespaces dedicated capacity. Cache metadata aggressively, and keep the journal compact with snapshots.

## A worked example

Alice edits a 400 MB video project file, changing 3% of it.

1. Content-defined chunking produces about 100 chunks of roughly 4 MB; only 3 differ from the previous version.
2. The client asks for missing hashes: 3 chunks (12 MB) upload instead of 400 MB; the commit succeeds as version 8, referencing the base version 7.
3. Her laptop (offline since morning) reconnects, sees its cursor is behind, pulls the journal and downloads the 3 new chunks.
4. At the same time, Bob edited version 7 of the same file offline. His commit arrives with base version 7; the server rejects it as stale and the client saves "conflicted copy" next to the file, with both versions retained.

## Common mistakes

- **Uploading whole files** after small edits.
- **Mixing metadata and blocks** in one store.
- **Overwriting on conflict.**
- **Deleting blocks without proving they are unreferenced.**
- **No ordered journal**, so devices cannot tell what they missed.
