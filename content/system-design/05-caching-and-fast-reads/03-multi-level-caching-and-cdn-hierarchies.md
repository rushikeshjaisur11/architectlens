---
title: "Multi-Level Caching and CDN Hierarchies"
short_title: "Multi-Level Caching"
tags: ["caching", "cdn", "performance"]
sources:
  - "Cloudflare Learning Center documentation on tiered caching"
  - "Varnish and Fastly documentation on multi-layer cache architecture"
---

## Why a single cache layer isn't always the full picture

This track's caching-strategies lesson covered where a single cache sits (client, CDN, application, database). Real large-scale systems frequently stack multiple cache layers on the same request path, each serving a different purpose and operating at a different scope — understanding how they interact, and where a request actually gets served from, matters for both performance and correctness (particularly around invalidation, which gets genuinely harder across multiple layers).

## The typical layered structure

- **Browser/client cache** — closest to the user, governed by `Cache-Control` headers, zero network cost on a hit but entirely local to that one user's device.
- **CDN edge cache** — per this track's CDN lesson, geographically distributed, shared across all users hitting that specific edge location.
- **CDN regional/shield cache** — a middle tier some CDN providers offer (Cloudflare's "tiered caching," Fastly's "shielding"): a smaller number of regional caches sitting between many edge locations and the origin, so that a cache miss at an edge location checks the regional cache before going all the way back to origin — reducing origin load further by absorbing misses that would otherwise all independently hit origin from many different edge locations.
- **Application-level cache** (Redis, per the caching-strategies lesson) — sits in front of the database, shared across all requests reaching the application tier, regardless of which CDN edge or region they came through.
- **Database buffer cache** — the database's own internal memory cache, the last line of defense before an actual disk read.

Each layer narrows the population of requests that reach the next one — the browser cache absorbs a single user's repeat requests, the edge cache absorbs a region's worth of users' requests for the same content, the shield/regional cache absorbs cache misses across many edge locations for the same content, and so on down to the database.

## Why a shield/regional tier specifically helps at real scale

Without a shield tier, a piece of content going viral could see cache misses from hundreds of independent edge locations worldwide all hitting the origin simultaneously on first request at each location — origin load scales with the *number of edge locations*, not just overall traffic. A shield tier means only the shield cache's own miss (a single event, the first time any edge location anywhere requests that content) reaches the origin; every edge location's miss after that is satisfied by the shield tier instead, so origin load scales with distinct content, not with edge location count — directly connecting to this track's caching lesson's thundering-herd concern, but addressing a variant of it that's specific to having many independent cache tiers rather than one shared cache experiencing concurrent misses.

## Invalidation gets genuinely harder across multiple layers

This track's caching-strategies lesson covered invalidation for a single cache layer. With multiple layers, an invalidation (or a TTL expiration) needs to actually propagate through every layer that might be holding a stale copy — purging content from the origin's application cache doesn't automatically purge it from CDN edge caches that already cached a response before the purge, and a CDN purge doesn't reach browser caches that already stored a copy locally with their own TTL. This is why versioned URLs (per the CDN lesson) are often preferred over active purging for content that needs guaranteed-fresh delivery across every layer simultaneously — a new URL simply isn't in any layer's cache yet, sidestepping the multi-layer purge-propagation problem entirely, rather than needing to actively and correctly purge every layer for the same logical content.

## A worked example

**Scenario:** a news site serves both frequently-changing breaking-news content and rarely-changing static assets (images, stylesheets), globally distributed, with a CDN provider offering both edge and shield caching tiers.

- **Static assets** use long browser-cache TTLs and versioned URLs (a content hash in the filename), cached aggressively at every layer (browser, edge, shield) since they never need active invalidation — a new version simply gets a new URL, and old cached copies at any layer become irrelevant rather than needing to be purged.
- **Breaking news content** uses short TTLs at the edge layer specifically, and the shield tier is configured to keep a slightly longer TTL than the edge layer — this means a burst of edge-cache expirations across many edge locations worldwide (as the short edge TTL repeatedly expires) mostly get absorbed by the still-valid shield cache rather than each edge's expiration independently reaching origin, directly using the shield tier's origin-load-reduction benefit described above for exactly the volatile-content case where it matters most.
- **An urgent correction to a published article** uses active purge APIs at both the edge and shield tiers (since versioned URLs aren't practical for content reached via a stable, shared article URL), with the team aware that browser caches holding the pre-correction version won't be reached by this purge and will only refresh once their own local TTL expires — an accepted, bounded staleness window for that specific layer, rather than an unaddressed gap nobody accounted for.

## Common mistakes

- **Assuming a single "purge the cache" action clears staleness everywhere.** As shown above, each layer needs its own invalidation handled (or avoided via versioned URLs), and forgetting a layer (commonly the browser cache, since it's the least visible to the team operating the system) leaves a real, if bounded, staleness gap that wasn't accounted for.
- **Not using a shield/regional tier for content likely to see bursty, geographically-distributed demand**, missing a meaningful origin-load reduction that's specifically valuable for exactly this traffic pattern (a viral piece of content hit from many regions in a short window).
- **Setting inconsistent TTLs across layers without considering how they interact.** A shorter TTL at a lower layer (closer to origin) than at a higher layer (closer to users) can mean the lower layer refreshes and serves updated content while a higher layer keeps serving a now-outdated cached copy for longer — the relative TTL ordering across layers is itself a design decision, not something that can be set independently per layer without considering the whole chain.
