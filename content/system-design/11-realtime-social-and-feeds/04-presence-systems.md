---
title: "Presence Systems: Online, Offline, and Typing Indicators at Scale"
short_title: "Presence Systems"
tags: ["presence", "real-time", "websockets", "system-design"]
sources:
  - "Slack Engineering — \"How Slack Built Shared Channels\" and presence-related blog posts (slack.engineering)"
  - "Discord Engineering — \"How Discord Stores Trillions of Messages\" and presence scaling posts (discord.com/blog)"
  - "Figma Engineering blog on multiplayer presence (figma.com/blog)"
---

## What presence actually means

**Presence** is a distributed system's best guess at whether a user is currently reachable — online, away, or offline — and, for finer-grained cases, whether they're actively doing something like typing. It's fundamentally a guess because there's no way to know a client is truly "there" without asking it, and the answer can go stale the instant the network drops. Every presence system is really an approximation built on top of **heartbeats** and **timeouts**, not ground truth.

The core primitive is a connection-tracking table: which users have an open real-time connection (WebSocket, in most modern systems), on which server, since when. Presence state is derived from that table, not stored as an independent fact — a client is "online" because it holds a live connection, not because a flag says so.

## The heartbeat and timeout pattern

Clients send periodic **heartbeats** (small pings) over their WebSocket connection to signal "I'm still here." The server tracks the last-heartbeat timestamp per connection. If no heartbeat arrives within a timeout window (commonly 30-60 seconds), the server marks the user offline and broadcasts that change.

This design trades accuracy for simplicity: a user who closes their laptop lid without a clean disconnect stays "online" until the timeout expires — a **false positive** window that's unavoidable without the timeout being uncomfortably short (which would cause false negatives during brief network blips, like a phone switching from WiFi to cellular). Slack and Discord both tune this window as a direct trade-off between "looks stale" and "flickers constantly."

## Fanning out presence changes

Presence differs from a normal feed fanout because the audience isn't followers — it's whoever currently has that user's profile, DM, or shared channel open. A naive design broadcasts every presence change to every contact, which becomes O(n²) in a large group (a 10,000-member channel where everyone's status change reaches everyone else). Real systems narrow the broadcast in two ways:

- **Subscription-based fanout**: clients explicitly subscribe to the presence of users currently visible in their UI (open DMs, visible member list), and unsubscribe when that UI closes. This keeps the fanout proportional to what's on-screen, not to the full social graph.
- **Batching and coalescing**: rapid flapping (online → offline → online within seconds, common on mobile) gets debounced server-side so subscribers see one settled state change instead of a flood of updates.

Discord's approach groups presence by guild (server) and only pushes updates to guild members currently connected to that guild's gateway shard, which keeps fanout bounded by shard membership rather than global user count.

## Typing indicators: a different consistency bar

**Typing indicators** ("X is typing...") are presence's higher-frequency, lower-stakes cousin. They tolerate being wrong far more than online/offline status — showing a stale "typing" for two extra seconds costs nothing, so systems intentionally use weaker guarantees:

- No heartbeat/timeout bookkeeping on the server; the client just sends a "typing" event on each keystroke (throttled, e.g., at most once every few seconds) and the server relays it with a short client-side expiry (if no follow-up event arrives within ~5 seconds, the UI clears the indicator itself).
- Typing events are **fire-and-forget** — not persisted, not retried, not part of the durable message log. Losing one is invisible to the user.

This is the general pattern for ephemeral real-time signals: don't pay durability or consistency costs for information that expires in seconds anyway.

## Common mistakes

- **Storing presence as durable state in the primary database.** Presence changes far too often and matters too briefly to belong in the same store as messages or user profiles; it belongs in an in-memory store (Redis, or an in-process connection table) keyed by connection, not by a persisted "status" column.
- **Broadcasting presence to the full social graph.** Without subscription-scoped fanout, presence updates become the single most expensive event type in the system purely from fanout volume, even though each individual update is tiny.
- **Using the same reliability guarantees for typing indicators as for messages.** Typing events don't need acknowledgment, retry, or ordering guarantees — treating them like durable events adds cost for a signal designed to be thrown away.
