---
title: "Video Streaming Protocols: HLS, DASH and Adaptive Bitrate"
short_title: "HLS, DASH and Adaptive Bitrate"
tags: ["video", "streaming", "hls", "dash", "cdn", "abr"]
sources:
  - "RFC 8216, HTTP Live Streaming (HLS)"
  - "ISO/IEC 23009-1, MPEG-DASH"
  - "Public documentation from major video platforms on adaptive bitrate ladders and segment durations"
banner:
  layout: line
  nodes:
    - [doc, "segments"]
    - [doc, "HLS/DASH"]
    - [cdn, "CDN"]
    - [client, "ABR player"]
---

## Streaming over plain HTTP

Modern video streaming does not use a special streaming server holding a long connection. It cuts the video into **short segments** (commonly 2 to 10 seconds each), serves them as ordinary files over HTTP, and lets the player fetch them one after another. This is what makes video cacheable by CDNs and scalable: a segment is just a static object that millions of viewers can request.

Two formats dominate:

- **HLS (HTTP Live Streaming)** — originated at Apple, uses `.m3u8` playlist files that list segments. Universally supported on Apple devices and widely elsewhere.
- **MPEG-DASH** — an open standard using an XML manifest (an MPD). Common on Android, smart TVs and browsers.

Both work on the same idea; the practical difference is manifest format and device support. Many services produce both, often sharing the same underlying media segments (CMAF packaging) to avoid storing everything twice.

## What the manifest describes

A **master manifest** lists the available *renditions* — the same video encoded at several resolutions and bitrates, sometimes called the **bitrate ladder**:

| Rendition | Resolution | Typical bitrate |
|---|---|---|
| Low | 426x240 | ~400 kbps |
| Medium | 854x480 | ~1.2 Mbps |
| High | 1280x720 | ~3 Mbps |
| Full HD | 1920x1080 | ~6 Mbps |

Each rendition has its own playlist enumerating its segments. Segment boundaries are aligned across renditions so the player can switch at any boundary without a visual glitch.

## Adaptive bitrate (ABR)

The player, not the server, decides which rendition to fetch next. It measures how quickly recent segments downloaded and how much video it has buffered, then chooses:

- **Throughput-based:** pick the highest bitrate below the measured bandwidth, with a safety margin.
- **Buffer-based:** pick based on how full the playback buffer is — step up when it is comfortably full, step down when it is draining.
- **Hybrid:** most real players combine both.

The goal is to avoid the worst experience, **rebuffering** (the spinner), while keeping quality as high as the network allows. A well-tuned player prefers starting a little low and climbing, and avoids oscillating between renditions every few seconds.

## Trade-offs in the design

- **Segment duration.** Short segments (2 s) let the player adapt faster and cut startup and live latency, but increase request count, manifest size and per-segment overhead. Long segments (10 s) are more efficient and less responsive. Many VOD systems use 4 to 6 seconds.
- **Ladder design.** Too few rungs means abrupt quality jumps; too many multiplies encoding and storage cost. Per-title encoding tunes the ladder to content complexity, since an animated show needs far fewer bits than a sports match for the same quality.
- **Codec choice.** Newer codecs (HEVC, AV1) save bandwidth but cost more to encode and need device support, so services keep an older codec as fallback.
- **Latency for live.** Standard HLS/DASH adds many seconds of delay because the player buffers several segments. Low-latency variants use partial segments and chunked transfer to get this down to a few seconds.

## Where the CDN fits

Because segments are plain HTTP objects, a CDN caches them like any file. Popular content is served from edge caches; unpopular content falls back to origin. Manifests for live streams change constantly and have very short cache lifetimes, while old VOD segments can be cached for a long time. Cache hit ratio on segments is the main lever on origin load and cost.

## A worked example

**Scenario:** a viewer on a train starts a movie on a phone with variable mobile bandwidth.

1. The player downloads the master manifest and starts conservatively at the 480p rendition to begin playing quickly.
2. The first few segments download fast, so the buffer grows and the player steps up to 720p.
3. The train enters a tunnel and throughput collapses. The buffer drains from 20 seconds toward 8, and the player drops to 240p so each segment downloads faster than it plays.
4. When the signal returns, the buffer refills and the player climbs again, one rung at a time.

The viewer sees reduced sharpness for a minute but no spinner. The server did nothing special; it served static files.

## Common mistakes

- **Treating streaming as a stateful connection problem.** It is a static-file problem, and that is why it scales.
- **Misaligned segment boundaries across renditions**, which causes visible glitches when switching.
- **A ladder with huge gaps** or a top rung above what most devices can play, wasting storage.
- **Caching live manifests too long**, leaving viewers stuck on stale playlists.
- **Ignoring startup time.** Beginning at the highest rendition makes the first frame slow; start lower and ramp.
