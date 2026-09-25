---
title: "Geospatial Indexing: Finding Nearby Things Fast"
short_title: "Geospatial Indexing"
tags: ["geospatial", "indexing", "geohashing", "matching"]
sources:
  - "Uber Engineering blog, posts on H3 hexagonal hierarchical spatial index"
  - "Google S2 Geometry Library documentation"
---

## Why "find nearby" is a harder query than it looks

"Find all drivers within 2km of this rider" seems like it should be a simple range query, but latitude and longitude don't behave like normal sortable numbers for this purpose — two points can be geographically close while having very different longitude values (near the international date line, or near the poles, where longitude lines converge), and a naive B-Tree index on latitude and longitude columns separately can't efficiently answer a genuinely two-dimensional "within this radius" query. Geospatial indexing exists to make proximity queries — nearest neighbors, radius search, bounding-box search — efficient at scale.

## Geohashing: encoding 2D location as a sortable string

**Geohash** encodes a latitude/longitude pair into a single string by recursively subdividing the world into a grid: each additional character in the geohash narrows the location to a smaller cell. The key property that makes this useful for indexing: geohashes that share a longer common prefix are (usually) geographically closer together, which means a standard B-Tree or sorted index on the geohash string can answer many proximity queries — "find all points whose geohash starts with `9q8yy`" retrieves everything in that grid cell using an ordinary string-prefix range scan, no special spatial index structure required.

The important caveat: this "shared prefix means nearby" property isn't perfectly reliable — two points can be geographically adjacent but fall on opposite sides of a grid cell boundary, ending up with very different geohash prefixes despite being close together. Real implementations typically compensate by also checking the geohash's neighboring cells, not just an exact prefix match, when doing a proximity search.

## Quadtrees and grid-based approaches

A **quadtree** recursively divides a 2D space into four quadrants, subdividing further only where point density requires more precision — dense urban areas get finer subdivision, sparse rural areas stay coarse. This adapts naturally to real-world data distribution (which is rarely uniform — most location data clusters heavily in populated areas), unlike a fixed-resolution grid which wastes index granularity on empty regions and may be too coarse in dense ones.

## H3 and S2: hexagonal and hierarchical alternatives

Square-grid systems (like basic geohashing) have a subtle problem: a square cell's neighbors aren't all equidistant from its center — diagonal neighbors are farther away than adjacent ones, which distorts "nearest neighbor" reasoning near cell boundaries. **H3** (developed at Uber) uses hexagonal cells instead, where all six neighbors are equidistant from the center, giving more uniform and intuitive proximity behavior — a meaningful property for a ride-hailing system where "which drivers are in nearby cells" needs to behave consistently regardless of direction. **S2** (from Google) takes a different approach, projecting the sphere onto a cube and subdividing each face hierarchically, handling the whole globe (including poles and the date line) without the distortion that a flat lat/long grid introduces near those edge cases.

## A worked example

**Scenario:** a ride-hailing app needs to find available drivers within a few kilometers of a rider requesting a ride, updating driver locations continuously as they move.

- **Indexing choice**: each driver's current location is mapped to an H3 cell at an appropriate resolution (small enough that a cell roughly corresponds to a short driving distance, large enough that the number of cells stays manageable) and stored in a fast lookup structure (often an in-memory store like Redis, since driver locations update every few seconds and need low-latency writes) keyed by cell ID, with each cell holding the set of drivers currently in it.
- **Matching a ride request**: the rider's location is mapped to the same H3 resolution, and the system checks that cell plus its immediate ring of neighboring cells for available drivers — a small, bounded set of cell lookups instead of a full scan or naive distance calculation against every driver in the city.
- **Why hexagonal cells specifically matter here**: with a square grid, a driver just across a cell boundary in a diagonal direction could be missed by a naive "check this cell only" search, or a distance ranking could be subtly skewed depending on which direction a driver is relative to the rider — H3's uniform neighbor distances reduce this asymmetry, which matters for a product where "who's actually closest" directly affects match quality and rider wait time.

## Common mistakes

- **Treating latitude and longitude as independently sortable/indexable columns** for proximity queries — a standard two-column B-Tree index doesn't efficiently answer "within X km," since proximity in real space doesn't map cleanly onto either coordinate sorted independently.
- **Using geohash prefix-matching alone without checking neighboring cells**, and missing genuinely nearby points that happen to fall just across a grid cell's boundary — a known limitation of naive geohash-based search that needs an explicit neighbor-check step to correct for.
- **Picking a grid/cell resolution mismatched to the actual query radius.** Too coarse a resolution returns too many irrelevant candidates to filter through; too fine a resolution means a small query radius spans many cells, each requiring a separate lookup — the right resolution is tuned against the typical query radius the product actually needs, not chosen arbitrarily.
