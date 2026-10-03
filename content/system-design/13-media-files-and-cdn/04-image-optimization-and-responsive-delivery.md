---
title: "Image Optimization and Responsive Delivery"
short_title: "Image Optimization and Responsive Delivery"
tags: ["media", "images", "cdn", "performance"]
sources:
  - "web.dev documentation on responsive images and image optimization"
  - "Cloudinary and imgix documentation on on-the-fly image transformation"
---

## Why serving one fixed image file to every device is wasteful

An image uploaded once at high resolution, served identically to every requesting device, wastes bandwidth and load time for the (common) case of a mobile device with a smaller screen and often a slower connection than a desktop — that device downloads far more image data than it can actually display at full resolution, directly hurting page load performance for no visual benefit. This connects to this track's CDN lesson's broader point about serving content efficiently to varied network conditions, applied specifically to image delivery, where the "right" version of an asset genuinely differs by requesting device rather than being a single universal best version.

## Responsive images: serving the right resolution for the actual display

The `srcset` and `sizes` HTML attributes let a page specify multiple resolution variants of the same image, with the browser itself choosing which variant to actually download based on the requesting device's screen size and pixel density — the server doesn't need to guess the right resolution; the browser makes an informed choice from the offered options. This requires the image to actually exist in multiple pre-generated resolutions ahead of time (or generated on demand, per the on-the-fly transformation pattern below), and choosing a reasonable, not excessive, set of resolution breakpoints — too few breakpoints means some devices still download meaningfully more data than needed; too many means unnecessary storage and cache-fragmentation overhead for marginal additional precision.

## Modern image formats: better compression for the same visual quality

Beyond serving the right resolution, the image *format* itself matters: newer formats (WebP, AVIF) generally achieve meaningfully smaller file sizes than older formats (JPEG, PNG) at equivalent visual quality, through more modern compression techniques. Since browser support for the newest formats isn't universal across all clients, serving the optimal format per-client typically uses the `<picture>` element's ability to offer multiple format options with the browser selecting whichever it supports, falling back to a more universally-supported format (JPEG) for older clients that don't support the newer ones — directly analogous in spirit to the graceful-degradation reasoning from this track's reliability lesson, but applied to format support rather than service availability.

## On-the-fly image transformation: generating variants at request time instead of pre-generating everything

Pre-generating every combination of resolution and format for every uploaded image ahead of time doesn't scale well — the combinatorial explosion of (resolutions) × (formats) × (crop variants) for every single uploaded image adds substantial storage overhead, much of which may never actually be requested. **On-the-fly image transformation services** (Cloudinary, imgix, or a self-hosted equivalent) instead store one high-quality source image, and generate the specific requested variant (a specific resolution, format, and crop) at request time, based on parameters encoded in the request URL — caching the generated variant (via the CDN layer, per this track's CDN lesson) after its first request so subsequent requests for that same specific variant are served from cache rather than re-transforming on every request.

This is a direct application of the lazy/on-demand computation pattern that recurs across several of this track's lessons — similar to cache-aside's "populate on first request, not preemptively" reasoning (per the caching-strategies lesson), applied here to image variant generation rather than data caching, avoiding the storage waste of generating every possible variant preemptively when only a subset will actually ever be requested in practice.

## The real cost tradeoff: compute at request time vs. storage ahead of time

On-the-fly transformation trades upfront storage cost for request-time compute cost (the first request for any specific variant pays a real transformation-compute cost before that variant is cached), while pre-generating fixed variants trades the opposite way (paying storage cost for every variant upfront, but every request is served from pre-existing storage with no transformation compute needed). The right choice depends on the actual variant-request distribution: a site with highly predictable, limited variant needs (say, exactly 3 standard thumbnail sizes used everywhere) may reasonably pre-generate those specific fixed variants, while a site with highly variable, hard-to-predict resolution/crop needs across many different contexts benefits more from on-the-fly generation's flexibility, accepting the request-time compute cost in exchange for not needing to anticipate every possible variant combination in advance.

## A worked example

**Scenario:** a content platform serves user-uploaded photos across many different contexts (thumbnails in a feed, full-size in a detail view, various crop ratios for different UI placements) across web and mobile clients with varying screen sizes.

- **On-the-fly transformation is chosen** over pre-generating fixed variants, specifically because the actual set of needed resolution/crop combinations is large and evolves as new UI surfaces are added — pre-generating every combination upfront would mean either constantly regenerating variants as new UI needs emerge, or accumulating storage for variants that may never actually be requested.
- **Responsive `srcset`/`sizes` markup** is used on every image placement, letting each client's browser select the appropriately-sized variant from the on-the-fly service's available resolution parameters, rather than the server needing to guess a single "best" resolution to serve universally.
- **Modern format negotiation via `<picture>`** serves AVIF or WebP to clients that support them, falling back to JPEG for older clients — the CDN caches each distinct (resolution, format, crop) combination independently after its first request, so the compute cost of generating any specific variant is paid once, not on every subsequent request for that same variant.

## Common mistakes

- **Serving a single fixed-resolution image to every device**, wasting bandwidth and load time for smaller-screen and slower-connection devices that download far more data than they can actually use, directly hurting the page-load-performance metrics that matter most for exactly the devices least able to afford the cost.
- **Pre-generating every possible variant combination without checking actual request patterns**, accumulating substantial unused storage for variants that are rarely or never actually requested in practice, when on-the-fly generation with caching would have served the same actual usage at a fraction of the storage cost.
- **Not falling back gracefully for clients that don't support modern image formats.** Serving only AVIF or WebP without a JPEG/PNG fallback breaks the experience for the (shrinking but still real) population of clients lacking modern-format support — the `<picture>` element's fallback mechanism exists specifically to avoid this, and skipping it trades a real compatibility gap for an incremental compression improvement that doesn't need to come at that cost.
