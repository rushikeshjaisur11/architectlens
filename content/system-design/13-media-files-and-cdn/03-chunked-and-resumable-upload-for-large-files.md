---
title: "Chunked and Resumable Upload for Large Files"
short_title: "Chunked and Resumable Upload"
tags: ["uploads", "object-storage", "reliability", "large-files"]
sources:
  - "Amazon S3 documentation on multipart upload"
  - "tus.io open protocol for resumable file uploads"
  - "Google Cloud Storage documentation on resumable uploads"
banner:
  layout: line
  nodes:
    - [client, "chunks"]
    - [server, "upload API"]
    - [db, "chunk store"]
    - [doc, "assemble"]
---

## Why one big request fails

Uploading a 5 GB file as a single HTTP request has several problems:

- **Any interruption restarts everything.** A dropped connection at 4.9 GB means resending 4.9 GB.
- **Servers and proxies impose limits**: request size caps, idle timeouts, memory pressure from buffering.
- **No parallelism.** One TCP stream rarely fills a fast link.
- **No progress you can trust or resume from.**

The fix is to split the file into **chunks** (also called parts), upload them independently, and assemble them at the end.

## The chunked upload flow

A typical design has three phases:

1. **Initiate.** The client tells the server it wants to upload a file of a given size and name. The server creates an upload session and returns an **upload ID**. Nothing is stored yet.
2. **Upload parts.** The client splits the file into fixed-size chunks (commonly 5 to 100 MB), numbers them, and sends each as a separate request carrying the upload ID and part number. The server stores each part and returns a receipt, usually a checksum (ETag).
3. **Complete.** The client sends the list of part numbers and receipts. The server verifies them, stitches the parts into one object, and makes it visible atomically.

An **abort** call discards the session and frees the stored parts.

## Resumability

Resumability falls out of the design: the server remembers which parts it has. After a failure the client asks "which parts do you have for this upload ID?", then sends only the missing ones. With the tus protocol the same idea is expressed as an offset: the client asks the server for the current byte offset and continues from there.

Resumability needs **durable session state**. If the upload ID and part list live only in one server's memory, a restart loses them. Store session metadata in a shared database and the parts in object storage.

## Chunk size trade-offs

- **Small chunks** (1 to 5 MB): cheap to retry, finer progress, better on flaky mobile networks. But many more requests, more metadata, and object stores cap the number of parts (S3 allows up to 10,000 parts per upload, so a 5 GB file needs chunks of at least about 0.5 MB, and larger files need larger chunks).
- **Large chunks** (50 to 100 MB): fewer requests and less overhead, but a failure wastes more work.

A sensible default is 8 to 16 MB, increased automatically for very large files so the part count stays within limits.

## Parallelism and integrity

Parts are independent, so the client can upload several at once (for example four to eight in parallel) to saturate the connection. Order does not matter because each part carries its number.

For integrity:

- Compute a **checksum per chunk** and send it with the request. The server rejects a chunk whose bytes do not match.
- Verify a final **whole-object checksum** after assembly to catch assembly mistakes.
- Make part uploads **idempotent**: re-sending part 7 overwrites part 7 safely, so retries never corrupt state.

## Going direct to storage

Routing all bytes through your application servers wastes their bandwidth and CPU. A common pattern is for the API server to authorize the upload and issue **pre-signed URLs**, one per part. The client then uploads straight to object storage, and only the small initiate and complete calls hit your service. This moves the heavy traffic off your fleet and lets the storage layer scale.

## Cleaning up

Abandoned uploads leave orphaned parts that cost money. Set a **lifecycle rule** that aborts incomplete sessions after a period (for example seven days), and have the session store expire stale entries.

## A worked example

**Scenario:** a mobile app uploads a 2 GB video over unreliable network.

- The client requests an upload and receives an ID plus a plan of 128 parts of 16 MB, each with a pre-signed URL.
- It uploads four parts in parallel, recording each returned ETag locally. At part 61 the phone loses signal and the app is killed.
- On relaunch the app asks for the session's completed parts. The server reports parts 1 to 60. The app resumes at 61, finishing without resending 960 MB.
- The client sends the final complete call with 128 part numbers and ETags. The object appears atomically, and a processing job (transcoding, virus scan) is triggered by the completion event.

## Common mistakes

- **Keeping session state in one app server's memory**, which defeats resumability.
- **Proxying all bytes through the application tier** when pre-signed direct upload would work.
- **Not validating checksums**, letting silent corruption through.
- **Fixed chunk size ignoring part-count limits** for very large files.
- **No cleanup policy**, leaving terabytes of orphaned parts.
- **Making the file visible before completion**, exposing half-uploaded objects.
