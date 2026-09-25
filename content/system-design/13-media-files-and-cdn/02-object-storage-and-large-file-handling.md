---
title: "Object Storage and Large File Handling"
short_title: "Object Storage and Large Files"
tags: ["object-storage", "media", "files"]
sources:
  - "AWS S3 documentation on storage classes and multipart upload"
  - "MinIO documentation on object storage architecture"
---

## Why object storage, not a filesystem, is the default for large-scale file storage

A traditional filesystem (even a networked one) organizes files in a hierarchical directory structure, with strong consistency and POSIX-style semantics (file locking, partial writes, directory listings) that are expensive to provide at massive, horizontally-distributed scale. **Object storage** (S3 and similar systems) takes a deliberately simpler model: files (objects) are stored flat, addressed by a unique key, with metadata attached but no real directory hierarchy (a key like `videos/2026/report.mp4` looks hierarchical but is really just a flat string key with slashes in it, not an actual nested directory structure the storage system needs to traverse). This simpler model is what allows object storage to scale horizontally to effectively unlimited capacity and very high aggregate throughput, at the cost of giving up filesystem semantics like partial in-place file edits or atomic directory operations that a real filesystem provides.

## The API shape reflects the simplified model

Object storage APIs are deliberately minimal: put an object (given a key and content), get an object (given a key), delete an object, list objects (often only efficiently by key prefix, not arbitrary query). There's generally no "open this file and modify bytes 100-200 in place" operation the way a traditional filesystem supports — updating an object typically means replacing it entirely (uploading a new full version under the same key), not an in-place partial edit. This constraint is a direct consequence of the scalability tradeoff: supporting efficient partial in-place mutation across a massively distributed, horizontally-scaled storage system is a much harder problem than supporting whole-object replacement, and object storage systems generally don't attempt it.

## Multipart upload: handling files too large for a single request

A single HTTP PUT request has practical limits on size and is fragile for very large files (a multi-gigabyte video, per this track's video-upload-pipeline lesson) — a connection failure partway through means restarting the entire upload. **Multipart upload** splits a large file into independently-uploaded parts (each a reasonable size, often tens of megabytes), uploaded separately (potentially in parallel, for faster total upload time), with the storage system assembling them into the final object once all parts are confirmed received. This directly enables the resumable, chunked upload pattern covered in the video pipeline lesson — a failed part can be retried individually without restarting the whole upload, and parts can upload concurrently rather than strictly sequentially, reducing total upload time for large files on connections capable of meaningful parallel throughput.

## Storage classes: trading retrieval speed and cost against storage cost

Not all stored data needs the same access characteristics. Object storage systems typically offer multiple **storage classes** with different cost/performance tradeoffs:

- **Standard/hot storage** — optimized for frequent, low-latency access, at the highest storage cost per gigabyte.
- **Infrequent access / cool storage** — lower storage cost, with a higher retrieval cost or slightly higher retrieval latency, appropriate for data accessed occasionally but not routinely (backups accessed only during recovery, older content past its peak popularity window).
- **Archive/cold storage** — the lowest storage cost, but with retrieval times that can range from minutes to hours (data may need to be "restored" from a genuinely offline or near-offline medium before it's accessible), appropriate only for data that's rarely if ever accessed but needs to be retained (compliance-driven long-term retention, deep backups).

Choosing the right storage class for each category of data — rather than defaulting everything to hot storage — is a direct, often substantial cost lever at scale, since storage cost differences between classes can be an order of magnitude or more, and most real datasets have a long tail of rarely-accessed older data that doesn't need hot-storage performance.

## Lifecycle policies: automating the storage-class transition

Manually managing which objects should move to a cheaper storage class as they age doesn't scale operationally. **Lifecycle policies** let a storage system automatically transition objects between storage classes (or delete them entirely) based on age or other rules — e.g., "move objects to infrequent-access storage after 30 days, archive storage after 180 days, delete after 3 years" — applied automatically without ongoing manual intervention, directly connecting to the CDN lesson's point about content generally becoming less frequently accessed over time as it ages out of active relevance.

## A worked example

**Scenario:** the video platform from this track's video-upload-pipeline lesson needs to decide how to store both the original uploaded source files and the transcoded output renditions, across content ranging from just-uploaded to years old.

- **Original source files** (kept for potential future re-transcoding, per the video pipeline lesson) are accessed rarely once transcoding completes — a lifecycle policy moves them to infrequent-access storage shortly after successful transcoding, and to archive storage after an extended period, since they're a retention/re-processing safety net rather than something actively served.
- **Transcoded renditions actively being served** (fronted by the CDN, per this track's CDN lesson) stay in hot storage for actively popular content, but a lifecycle policy transitions older, less-frequently-viewed content's renditions to infrequent-access storage once view rates drop below a threshold — directly reducing storage cost for the platform's long tail of older, rarely-rewatched content without needing manual per-file management.
- **Multipart upload** handles the initial large-file ingestion (per the video pipeline lesson's chunked upload step), landing directly in object storage rather than passing through application servers.

## Common mistakes

- **Storing all data in hot storage regardless of actual access frequency**, missing a substantial, largely automatable cost optimization that lifecycle policies exist specifically to capture without ongoing manual effort.
- **Assuming object storage supports efficient in-place partial file modification** the way a traditional filesystem does — building a system around this assumption runs into real friction once actual usage patterns require it, since object storage's whole-object-replacement model is a deliberate scalability tradeoff, not an incidental limitation.
- **Not using multipart upload for genuinely large files**, resulting in fragile, slow, non-resumable uploads for exactly the file sizes where resumability and parallelism matter most.
