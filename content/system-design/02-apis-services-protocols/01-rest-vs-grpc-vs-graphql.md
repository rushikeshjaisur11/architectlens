---
title: "REST vs. gRPC vs. GraphQL: Choosing an API Style"
short_title: "REST vs gRPC vs GraphQL"
tags: ["apis", "protocols", "rest", "grpc", "graphql"]
sources:
  - "gRPC official documentation (grpc.io)"
  - "GraphQL specification (spec.graphql.org)"
  - "Roy Fielding, 'Architectural Styles and the Design of Network-based Software Architectures' (2000 dissertation, REST chapter)"
---

## Three answers to the same question

All three solve "how does one service ask another for data or an action" — they just make different tradeoffs about flexibility, performance, and tooling.

- **REST** — resources exposed as URLs, manipulated with HTTP verbs (GET/POST/PUT/DELETE), payloads usually JSON. The web's default style; every HTTP client speaks it.
- **gRPC** — a binary RPC framework over HTTP/2, using Protocol Buffers for schema and serialization. Built for service-to-service calls where performance and strict typing matter more than human readability.
- **GraphQL** — a single endpoint where the client specifies exactly which fields it wants, across potentially many underlying resources, in one query.

## REST: simple, cacheable, over-fetches

REST's strength is that it maps directly onto HTTP semantics that already exist everywhere — caching (`Cache-Control`, ETags), load balancers, browsers, debugging tools (curl, browser devtools) all understand it natively.

Its weakness shows up at scale: a mobile client that only needs a user's name and avatar still gets the full user object back from `GET /users/123` unless the API grows bespoke partial-response params. And a screen needing data from three resources (user, posts, comments) means three round trips, or a custom aggregation endpoint that only exists for that one screen.

## gRPC: fast, typed, harder to debug by hand

gRPC's Protocol Buffer schema (a `.proto` file) is the contract — client and server generate strongly-typed stubs from it, so a field rename or type change is caught at compile time, not at runtime with a malformed JSON blob. Binary serialization is smaller and faster to parse than JSON, and HTTP/2 multiplexing lets many calls share one connection without head-of-line blocking.

The cost: you can't just curl a gRPC endpoint and read the response — you need the `.proto` file and tooling (`grpcurl`, or a generated client) to make sense of it. Browsers also can't call gRPC directly without a proxy layer (gRPC-Web), so it's most common for internal service-to-service traffic, not public-facing APIs.

## GraphQL: client-driven shape, server-side complexity

GraphQL flips REST's model: instead of the server defining fixed response shapes per endpoint, the client sends a query describing exactly the fields it needs, and the server resolves each field — possibly from different underlying services — into one response. This kills over-fetching and under-fetching in one move: a mobile client asks for `{ user { name avatar } }` and gets exactly that, nothing more.

The complexity moves server-side. Every field needs a resolver, and a naive implementation can trigger the "N+1 query problem" — fetching a list of 50 posts, then issuing 50 separate database queries for each post's author, when the list's shape didn't make that obvious. Tools like Dataloader batch and cache those resolver calls to avoid it. Caching is also harder than REST's URL-based caching, since every query can be shaped differently — most GraphQL setups cache at the object level (by ID) rather than the response level.

## A worked example: choosing for a product

**Scenario:** you're building a ride-sharing app's backend, with (1) public-facing mobile clients, and (2) internal services (pricing, matching, notifications) that talk to each other constantly.

- **Public mobile API**: GraphQL or REST. If screens vary a lot (rider view vs. driver view vs. admin dashboard) and you want to avoid endpoint sprawl, GraphQL's client-driven shape earns its complexity. If the screens are few and stable, REST is simpler to build, cache, and debug — don't reach for GraphQL by default.
- **Internal pricing-to-matching calls**: gRPC. These are high-frequency, latency-sensitive, and both ends are services you control — so the tooling overhead of `.proto` files is a non-issue, and you get typed contracts and binary speed where it actually matters.

Most real systems at this scale end up polyglot: gRPC internally, REST or GraphQL at the public edge. Picking one style for everything is usually a sign of following a trend rather than matching the actual traffic pattern.

## Common mistakes

- **Choosing GraphQL to "future-proof" an API with two screens and no aggregation problem.** The N+1 and caching complexity isn't worth it until over/under-fetching is an actual measured pain point.
- **Using gRPC for a public API with browser clients**, forgetting it needs a proxy (gRPC-Web) or a REST/JSON gateway to reach the browser directly — this adds a translation layer that erodes the performance advantage you picked gRPC for.
- **Treating REST as "no schema."** OpenAPI/Swagger specs give REST the same contract benefits gRPC gets from `.proto` — skipping them just because REST doesn't force one is a self-inflicted wound, not a property of REST itself.
