---
title: "Designing a Video Upload and Transcoding Pipeline"
short_title: "Video Upload and Transcoding"
tags: ["media", "video", "operations", "case-study"]
sources:
  - "Netflix Technology Blog, posts on video encoding and pipeline architecture"
  - "YouTube engineering talks on video processing infrastructure (public conference presentations)"
---

## Why video upload isn't just a file-upload problem

Storing an uploaded file is the easy part. The actual system that makes a video watchable across every device and network condition needs to solve a chain of problems a plain file upload doesn't touch: large file sizes needing resumable, chunked upload; producing multiple quality/format versions from one source (transcoding); and doing all of this without making the uploader wait for the entire pipeline to finish before their upload "completes." This lesson walks through the shape of that pipeline, drawing on the CDN and async-processing patterns covered elsewhere in this track.

## Step 1: Upload — chunked and resumable

Video files can be gigabytes in size, and a single unbroken HTTP upload over a real-world (possibly mobile, possibly unreliable) network is fragile — a connection drop partway through means restarting the entire upload from scratch. Production video platforms instead split the upload into chunks (a few megabytes each), uploaded independently, with the client tracking which chunks have succeeded and only re-sending failed ones on retry. This also enables pausing and resuming an upload across sessions, since the server can report which chunks it already has.

Uploaded chunks typically land directly in object storage (like S3) rather than passing through the application server's own disk — application servers handling large binary uploads directly becomes a scaling bottleneck, so a common pattern is generating a pre-signed upload URL that lets the client upload chunks directly to object storage, with the application server only involved in coordinating metadata (which chunks exist, when the upload is complete), not the actual bytes.

## Step 2: Decoupling upload completion from processing

Once all chunks are received and reassembled, the raw video needs transcoding into multiple resolutions and formats (per this track's CDN lesson's adaptive-bitrate-streaming point) before it's watchable efficiently across different devices and network conditions. This is genuinely slow — potentially minutes for a long video — and making the uploader wait for the full pipeline before their upload is acknowledged as "done" would be a poor experience and an unnecessarily long-held connection.

The standard fix: upload completion triggers an event (published to a message queue, connecting to this track's async-work lesson) and returns success to the uploader immediately, with the video shown in a "processing" state. A separate pool of transcoding workers consumes from that queue asynchronously, and once transcoding completes, the video's status updates to "ready" — decoupling the fast, synchronous "did the upload succeed" concern from the slow, asynchronous "is the video ready to watch" concern.

## Step 3: Transcoding — producing multiple renditions

A single uploaded source file needs to become several output files: different resolutions (240p through 4K, depending on the platform's target device range) and, per the CDN lesson's adaptive bitrate point, split into short segments for HLS/DASH streaming. This is computationally expensive — real transcoding work benefits from parallelization, and one common approach is splitting the source video into segments *before* transcoding, distributing segment-level transcoding jobs across a worker fleet, then reassembling the transcoded segments — rather than transcoding the entire video serially on one worker, which would make a long video take proportionally longer with no way to speed it up by adding more workers.

## Step 4: Storage and delivery

Once transcoded, the multiple renditions are stored in object storage and fronted by a CDN (per this track's CDN lesson) for actual delivery to viewers — the transcoding pipeline's output is exactly the input the CDN and adaptive-bitrate-streaming layer expect. The original uploaded source file is often retained separately (for re-transcoding if a new format or quality tier is added later) but isn't what's served to viewers directly.

## Step 5: Handling partial failures in a multi-stage pipeline

A pipeline with several stages (chunked upload → reassembly → transcoding → multiple renditions → CDN publish) has several places a failure can happen, and each needs a defined recovery behavior rather than leaving the video stuck in an ambiguous state:

- A failed transcoding job for one specific rendition (say, the 4K version fails while 1080p and below succeed) shouldn't block the video from becoming watchable at the qualities that did succeed — the video can go live with available renditions while the failed one retries independently.
- A stuck job (a transcoding worker that crashed mid-task) needs to be detected and retried, not left silently unprocessed forever — this connects to this track's message-queue lesson's point about dead-letter handling and delivery guarantees, since the transcoding queue faces exactly the same at-least-once-delivery and idempotency considerations covered there.

## Common mistakes

- **Making the uploader wait synchronously for transcoding to complete.** This ties a fast operation (upload) to a slow one (transcoding) unnecessarily, and connects directly to why the async decoupling in Step 2 matters — a design that skips this ends up with unacceptably long upload-request durations and a worse user experience for no benefit.
- **Transcoding the entire video serially on a single worker** instead of parallelizing at the segment level, leaving processing time scaling linearly with video length regardless of how much worker capacity is available.
- **Not planning for partial pipeline failure.** A design that only considers the happy path (every stage succeeds) doesn't account for the very real cases of one rendition failing, a worker crashing mid-job, or a corrupt uploaded chunk — each of these needs an explicit, tested recovery path, not an assumption that failures won't happen at meaningful scale.
