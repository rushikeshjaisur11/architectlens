---
title: "CDNs and Content Delivery: Serving Media Close to the User"
short_title: "CDNs and Content Delivery"
tags: ["cdn", "media", "caching", "performance"]
sources:
  - "Cloudflare Learning Center documentation on CDN architecture"
  - "Netflix Technology Blog, posts on Open Connect CDN architecture"
---

## Why serving media directly from your origin server doesn't scale

A video, image, or large file served directly from an application's origin servers has two compounding problems: physical distance (a user in Singapore fetching a file from a US-based server pays real network latency — light itself takes time to cross that distance, independent of how fast the server is) and origin load (every single request for a popular file hits the same origin infrastructure, even though the file's content is identical for every requester). A **Content Delivery Network (CDN)** solves both by caching content on servers distributed geographically close to users (edge locations, or points of presence), so a user's request is served from a nearby cache instead of round-tripping to a distant origin.

## How a CDN request actually flows

1. A user requests a file; DNS or anycast routing directs the request to the geographically nearest CDN edge location, not directly to the origin.
2. If that edge location already has the file cached (a **cache hit**), it's served immediately, with no origin involved at all.
3. If not (a **cache miss**), the edge location fetches the file from the origin once, serves it to the requesting user, and caches it locally so subsequent requests for the same file from nearby users are hits.

This means the origin server only needs to serve each piece of content once per edge location (not once per end user), and popular content becomes cheaper to serve, not more expensive, as it gets more popular — the opposite of what happens when every request hits the origin directly.

## Push vs. pull CDN models

- **Pull CDN** — the CDN fetches and caches content from the origin on-demand, the first time it's requested at a given edge location (as described above). Simple to set up (no separate upload step), and naturally caches only what's actually being requested — but the very first request for any piece of content at a new edge location is a slower cache miss.
- **Push CDN** — content is proactively uploaded to CDN edge locations ahead of time, before any user requests it. Useful for content known in advance to need wide availability immediately (a major video release, for instance), avoiding the cold cache-miss penalty entirely for the first request, at the cost of needing an explicit upload/publish step and potentially caching content at locations that never actually request it.

## Cache invalidation for a CDN: the same hard problem, at a different layer

CDN caching runs into the same fundamental challenge as application-level caching (covered in this track's caching lesson): how does an edge location know when its cached copy is stale? Common approaches:

- **TTL-based expiration**, set via cache headers on the origin response — simple, bounds staleness, but a mismatch between how often content actually changes and the configured TTL either serves stale content too long or forces unnecessarily frequent re-fetches.
- **Cache-busting via versioned URLs** — instead of invalidating a cached file, publish content updates under a new URL (e.g., appending a content hash or version number to the filename), so old cached copies simply become unreferenced rather than needing active invalidation. This is the dominant pattern for static assets (JS/CSS bundles, images) in modern web deployment, since it sidesteps invalidation-timing races entirely.
- **Explicit purge/invalidation APIs** — most CDN providers offer an API to explicitly evict a specific URL (or a whole path pattern) from all edge caches immediately, used when content genuinely needs updating at the same URL (a live-updated document, for instance) and versioned URLs aren't practical.

## Video-specific delivery: adaptive bitrate streaming

Video adds a layer CDNs for static files don't need to handle: network conditions vary per user and even per moment for the same user, so a single fixed-quality video file is either too large for a slow connection (causing buffering) or unnecessarily low-quality for a fast one. **Adaptive bitrate streaming** (HLS and DASH are the dominant protocols) solves this by encoding the same video at multiple quality levels, split into short segments (a few seconds each); the client continuously measures its actual download speed and requests whichever quality-level segment fits current network conditions, switching up or down as conditions change — mid-playback, without a restart. CDNs cache these segments the same way they'd cache any other file, but the adaptive-quality logic itself lives in the video player, not the CDN.

## A worked example

**Scenario:** a video streaming platform needs to serve both (1) a catalog of pre-existing video content to a global audience, and (2) live sports events to viewers watching in real time.

- **Catalog content → pull CDN with long TTLs and versioned segment URLs.** Content is stable once encoded, so a pull model (caching on first request per region) works fine, and adaptive-bitrate segments are cached aggressively since they never change once published — no invalidation complexity needed for this path.
- **Live events → different handling entirely.** Live video can't be pre-cached (it doesn't exist yet), so the CDN here is really relaying near-real-time segments as they're produced, with very short cache TTLs (seconds, matching segment duration) rather than the long TTLs appropriate for stable catalog content — the caching strategy has to match the actual freshness requirement of the content, not be applied uniformly across very different content types.
- **Geographic distribution**: both cases benefit from edge locations close to viewers, but live events concentrate load in a short, sharp burst around the event's actual airtime, while catalog content has a steadier, more spread-out access pattern — a detail that matters for capacity planning even though both ultimately use the same underlying CDN infrastructure.

## Common mistakes

- **Applying a single caching TTL strategy uniformly across very different content types** (static assets, user-generated content, live data) instead of matching cache behavior to how often each type actually changes.
- **Relying purely on TTL-based invalidation for content that needs to update immediately** (breaking news, a corrected document) — a versioned-URL or explicit-purge approach is needed when staleness genuinely isn't acceptable, since TTL expiration alone means waiting out the full TTL window before an update becomes visible.
- **Underestimating that a CDN doesn't eliminate the origin's importance.** Every cache miss (which includes every piece of content's first request in a given region, and every TTL expiration) still hits the origin — origin capacity and reliability still matter, just at reduced volume, not zero.
