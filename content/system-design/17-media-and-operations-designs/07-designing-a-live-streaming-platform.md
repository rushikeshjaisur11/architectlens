---
title: "Designing a Live-Streaming Platform"
short_title: "Live-Streaming Platform"
tags: ["live-streaming", "video", "latency", "cdn", "fan-out"]
sources:
  - "RFC 8216 (HLS) and ISO/IEC 23009-1 (MPEG-DASH), including low-latency extensions"
  - "Public engineering articles on live ingest, transcoding and low-latency delivery at large streaming platforms"
  - "RTMP, SRT and WebRTC protocol documentation"
---

## How live differs from video on demand

A video-on-demand (VOD) service can transcode a file at leisure and cache it forever. A live platform has **no finished file**: video arrives continuously, must be processed in real time, and is watched seconds later by an audience that can number in the millions simultaneously. Latency, not just throughput, becomes a design goal, and every stage has a hard real-time deadline.

## The pipeline

1. **Capture and ingest.** The broadcaster's encoder (OBS, a phone app) sends a stream to an ingest endpoint using a protocol like **RTMP** (long-standing, widely supported), **SRT** (resilient over lossy networks) or **WebRTC** (very low latency). Ingest servers are placed in many regions so the broadcaster connects to a nearby one.
2. **Transcoding.** A single incoming stream is converted into multiple renditions (1080p, 720p, 480p, 240p) so viewers on different networks can adapt. This is CPU or GPU intensive and must keep pace with real time. If transcoding falls behind, the stream stutters.
3. **Packaging.** The renditions are cut into short **segments** (or partial chunks) and described by a manifest, in HLS or DASH format.
4. **Origin and CDN distribution.** Segments are written to an origin and distributed through a CDN, so viewers fetch from nearby edges rather than the origin.
5. **Playback.** The player downloads the manifest, fetches segments, and adapts bitrate based on conditions.

## Where the delay comes from

Glass-to-glass latency is the sum of capture, encoding, ingest, transcoding, packaging, CDN propagation, **player buffering**, and decoding. With classic HLS using 6-second segments and a player that buffers three of them, delay is easily 20 to 30 seconds. Ways to cut it:

- **Shorter segments**, at the cost of more requests.
- **Low-latency HLS / DASH** with partial segments and chunked transfer, so the player can start consuming a segment before it is complete. This reaches roughly 2 to 5 seconds.
- **WebRTC** for sub-second delivery, used for auctions, betting, or interactive streams. It does not benefit from CDN caching in the same way and costs more per viewer, so it suits smaller or more interactive audiences.

The choice is a trade-off. Lower latency means less buffer and thus a higher risk of stalls, more infrastructure cost, and weaker caching. Sports and chat-driven streams value low latency; a concert broadcast may prefer smooth playback with 15 seconds of delay.

## Scaling the audience

The asymmetry is extreme: one stream in, a million streams out. Segments are identical for every viewer, which is what makes CDNs work. Details that matter:

- **Manifest freshness.** The live manifest changes every segment, so it has a very short cache lifetime. Millions of players polling it can overwhelm the origin if every request misses cache. **Request collapsing** at the edge (one fetch to origin shared among all waiting requests) is essential.
- **Tiered caching.** Edge caches pull from regional caches, which pull from the origin, reducing origin load for hot streams.
- **Thundering herd on popular streams.** A famous creator going live triggers instant demand. Pre-warm capacity or route their stream through dedicated infrastructure.

## Reliability

- **Redundant ingest.** Broadcasters can send to a primary and backup ingest. If the primary fails, the system switches.
- **Transcoder failover.** Run hot standbys or be able to restart a transcode job from the last segment boundary quickly.
- **Graceful degradation.** Under overload, drop the highest rendition first rather than failing the stream.
- **Disconnect handling.** When a broadcaster drops, keep the stream session open for a grace period so a reconnect continues seamlessly.

## Chat and interactivity

Live chat is its own scale problem: millions of viewers, a firehose of messages. A design uses WebSocket gateways, a pub/sub backbone partitioned by stream, and **sampling or rate limiting** so a viewer sees a readable subset instead of every message. Moderation runs in the pipeline.

## Recording and replay

Segments written to the origin can double as the **DVR window** (rewind during a live show) and be stitched into a VOD asset afterward. Store them in object storage, and run a post-processing job to produce an optimized VOD version.

## A worked example

**Scenario:** a game tournament with 400,000 concurrent viewers and a 4-second latency goal.

- The broadcaster sends 1080p60 over SRT to the nearest of several regional ingest points, with a backup stream to a second region.
- The ingest node hands the stream to a GPU transcoder that outputs five renditions with aligned 2-second keyframe intervals, packaged as low-latency HLS with 1-second partial segments.
- The origin writes segments to storage and the CDN serves them, collapsing the 400,000 manifest requests per second at the edge into a trickle toward origin.
- Players buffer about 2 seconds and adapt downward if a segment arrives late. The chat gateway shows a sampled subset of messages, and a DVR window of 30 minutes allows rewind.

## Common mistakes

- **Origin serving viewers directly** instead of through a CDN with request collapsing.
- **Misaligned keyframes across renditions**, which breaks smooth switching.
- **A single ingest region or no backup path.**
- **Choosing WebRTC for a huge passive audience**, where cacheable segment delivery is far cheaper.
- **Ignoring player buffer settings**, then blaming the pipeline for latency.
- **Treating chat as an afterthought**, when it can be a larger fan-out than the video.
