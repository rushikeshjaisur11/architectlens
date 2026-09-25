---
title: "WebSockets, Long Polling, and Server-Sent Events"
short_title: "WebSockets vs Long Polling vs SSE"
tags: ["realtime", "websockets", "protocols"]
sources:
  - "MDN Web Docs on WebSockets and Server-Sent Events"
  - "RFC 6455 (The WebSocket Protocol)"
---

## The core problem: HTTP wasn't built for the server to speak first

Plain HTTP is fundamentally request-response: a client asks, a server answers, and the connection's purpose is fulfilled. This is a poor fit for anything requiring the server to push new information to a client without the client asking again — a chat message arriving, a live notification, a stock price update. Several techniques exist to work around this mismatch, each with different tradeoffs in complexity, latency, and resource cost.

## Polling: the simplest, least efficient baseline

The client simply asks the server "anything new?" on a fixed interval (every few seconds, say). Trivially simple to implement, using nothing beyond standard request-response HTTP, but wasteful — most polling requests return "nothing new," and the interval creates an inherent latency floor (a message can wait up to the full poll interval before being delivered), and a short interval to reduce that latency multiplies the wasted-request problem correspondingly.

## Long polling: reducing waste, keeping standard HTTP semantics

**Long polling** improves on plain polling by having the server hold the request open — instead of responding immediately with "nothing new," the server waits (up to some timeout) until new data is actually available, then responds, at which point the client immediately opens a new long-polling request. This eliminates most of the wasted "nothing new" round trips that plain polling generates, while still using standard, simple HTTP request-response semantics that work through any standard HTTP infrastructure without special support — a meaningful practical advantage, since it doesn't require anything beyond what any web server and client already speak.

The remaining cost: each long-poll cycle still has connection setup/teardown overhead (a new HTTP request each cycle), and it's fundamentally still request-response under the hood, so it can't efficiently support the server sending multiple updates without the client re-requesting — it approximates real-time push but isn't genuinely bidirectional or continuously connected.

## Server-Sent Events (SSE): one-way server push over a single persistent connection

**SSE** establishes a single long-lived HTTP connection over which the server can push a stream of events to the client at any time, without the client needing to re-request after each message — a genuine improvement over long polling's repeated request cycle for the specific case of server-to-client push. It's built on standard HTTP (using the `text/event-stream` content type), so it works through standard HTTP infrastructure without special protocol support the way WebSockets sometimes need, and browsers provide a simple native `EventSource` API for consuming it.

The key limitation: SSE is strictly one-directional (server to client only) — if the client needs to send data back to the server as part of the same interaction, that still requires a separate, ordinary HTTP request, not part of the SSE connection itself. This makes SSE a clean fit for use cases that are genuinely one-directional from the server's side (live notifications, a live-updating feed, streaming an LLM response token by token — a common, current use of SSE) and a poor fit for anything needing low-latency bidirectional communication.

## WebSockets: full bidirectional, persistent connection

**WebSockets** establish a single persistent connection supporting genuine two-way communication — either side can send a message at any time, without the request-response pattern underlying HTTP (even though the connection is initiated via an HTTP handshake before upgrading to the WebSocket protocol). This is the right fit for use cases needing low-latency communication in both directions — a chat application, a multiplayer game, a collaborative editing tool — where long polling's request-response overhead or SSE's one-directional limitation would be a genuine constraint on the actual interaction pattern.

The cost: WebSockets are a genuinely different protocol from HTTP (after the initial upgrade handshake), which means some infrastructure (certain proxies, older load balancers) needs explicit WebSocket support to handle them correctly, and maintaining many persistent WebSocket connections has real server-side resource implications (each open connection holds some server memory and, depending on architecture, potentially a dedicated thread or event-loop slot) that need to be accounted for in capacity planning differently than stateless HTTP request handling.

## A worked example

**Scenario:** a live sports app needs (1) a live-updating score ticker visible to all viewers of a game, and (2) a chat feature where viewers can send and receive messages in real time during the game.

- **Score ticker → SSE.** This is a genuinely one-directional push (server broadcasts score updates; no client-to-server communication is part of this specific feature), so SSE's simpler, standard-HTTP-compatible model is a good fit without paying for WebSockets' bidirectional capability that this feature doesn't actually need.
- **Chat → WebSockets.** Genuinely bidirectional, low-latency communication is the core requirement — a viewer sending a message needs to reach other viewers with minimal delay, and WebSockets' persistent, full-duplex connection is the natural fit, where SSE's one-directional limitation would force an awkward workaround (SSE for receiving messages, separate HTTP POST requests for sending them) that's more complex than just using WebSockets for the whole interaction.
- **Why not WebSockets for everything, given they're strictly more capable**: the score ticker doesn't need bidirectional capability, and using WebSockets for it anyway would mean holding an unnecessarily more resource-intensive connection type for a use case SSE handles adequately and more simply — matching the protocol to the actual interaction pattern, not defaulting to the most capable option everywhere regardless of need.

## Common mistakes

- **Defaulting to WebSockets for every real-time-feeling feature**, even ones that are genuinely one-directional, taking on WebSockets' infrastructure and resource considerations for a use case SSE or even long polling could handle more simply.
- **Using plain short-interval polling for a feature with real-time expectations**, generating unnecessary load and still not achieving the low latency a genuinely real-time solution (SSE or WebSockets) would provide directly.
- **Not accounting for persistent-connection resource cost at scale when choosing WebSockets or SSE.** A design that works fine in testing with a handful of connections can hit real server-side resource limits at production scale, if connection count and per-connection resource cost weren't factored into capacity planning up front.
