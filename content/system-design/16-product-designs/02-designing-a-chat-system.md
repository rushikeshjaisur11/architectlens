---
title: "Designing a Chat System, End to End"
short_title: "Designing a Chat System"
tags: ["product-design", "case-study", "chat", "interview-practice"]
sources:
  - "System design interview practice materials (general pattern, synthesized from multiple public writeups)"
---

## Why a chat system pulls together a different set of concepts than the URL shortener

Where this track's URL shortener lesson exercised estimation, ID generation, and read-heavy caching, a chat system's core challenges are different: real-time bidirectional delivery, message ordering, and offline/online state — pulling directly from this track's realtime lessons (fanout strategies, WebSockets) and connecting them into one coherent product design.

## Step 1: Clarify requirements

- Functional: one-to-one messaging, message delivery status (sent/delivered/read), online presence indication, and message history persistence.
- Non-functional: low latency for message delivery (this is the core value proposition of a chat product), message ordering must be preserved within a conversation, and messages shouldn't be lost even if a recipient is temporarily offline.

## Step 2: Connection layer — WebSockets for active sessions

Per this track's WebSockets-vs-long-polling-vs-SSE lesson, chat is the textbook case for WebSockets: genuinely bidirectional, low-latency communication is the core requirement, not an enhancement. Each connected client maintains a persistent WebSocket connection to a chat server, and that server needs to track which user is connected to which specific server instance — since with multiple chat servers behind a load balancer, a message from user A to user B needs to be routed to whichever specific server instance currently holds B's active connection, not just any server in the fleet.

## Step 3: Routing messages between servers

Since sender and recipient may be connected to different server instances, a message can't just be handled entirely within one server process. A common pattern: each chat server, upon a client connecting, registers that user's connection in a shared, fast lookup store (Redis, mapping user ID to the specific server instance holding their connection). When server A receives a message from a connected user destined for a user connected to server B, it looks up B's current server in that shared store and forwards the message internally (via a message queue, per this track's async-work lesson, or a direct internal request) to server B, which then delivers it over B's actual WebSocket connection.

## Step 4: Handling offline recipients

If the recipient isn't currently connected to any server (offline), the message can't be delivered over a WebSocket that doesn't exist. Instead, it's persisted to a message store (a database, keyed by conversation and ordered by timestamp/sequence) and queued for delivery — when the recipient later reconnects, the server checks for any undelivered messages in their conversations and delivers them at connection time, then marks them delivered. This means every message is persisted regardless of whether the recipient is online, both for this offline-delivery purpose and for message history — the real-time WebSocket delivery path and the persistent storage path aren't alternatives, they happen together for every message.

## Step 5: Message ordering

Within a single conversation, messages need to arrive and display in a consistent order, even if sender and recipient are on different servers with independent clocks. A per-conversation sequence number (incremented for each new message in that conversation, assigned at write time by whichever component durably persists the message first) is more reliable than relying on wall-clock timestamps alone, since clock skew between different servers can otherwise produce an inconsistent apparent ordering — this connects to the deeper ordering considerations covered in this track's message-queue lesson, applied here at the level of an individual conversation's message sequence rather than a queue partition.

## Step 6: Delivery status (sent / delivered / read)

Each status transition is itself a small piece of state that needs to propagate back to the sender, typically over the sender's own WebSocket connection: "sent" is set once the message is durably persisted server-side, "delivered" once it's actually been pushed to the recipient's active connection (or, if offline, once it's fetched at their next reconnection), and "read" once the recipient's client explicitly acknowledges viewing it (a client-side event sent back to the server). This is a small, secondary real-time data flow layered on top of the main message-delivery flow, using the same connection infrastructure rather than a separate mechanism.

## A worked example: end-to-end message flow

**Scenario:** user A sends a message to user B, who is currently offline.

1. A's client sends the message over its WebSocket connection to chat server 1 (which A is connected to).
2. Server 1 assigns the message a per-conversation sequence number and persists it to the message store — this is what makes the message durable and available for history regardless of what happens next.
3. Server 1 checks the shared connection-registry (Redis) for B's current server; finding none (B is offline), it marks the message as pending delivery rather than attempting a WebSocket push that has nowhere to go.
4. A's client receives a "sent" status update over its own WebSocket connection, confirming the message was durably received server-side, even though B hasn't seen it yet.
5. Later, B connects to chat server 2 (possibly a different server than A is on, per the load-balanced multi-server design from Step 2). Server 2 registers B's connection in the shared registry and checks for pending undelivered messages, finding and delivering A's message over B's now-active WebSocket connection, then marking it "delivered."
6. B's client, upon rendering the message, sends a "read" acknowledgment back, which propagates back to A's connection (via the same cross-server routing described in Step 3) as a "read" status update.

## Common mistakes

- **Designing as if sender and recipient are always connected to the same server instance.** This is a fine simplification for a single-server prototype, but a real horizontally-scaled deployment needs the connection-registry and cross-server routing described in Step 3 — a design that skips this doesn't actually work once there's more than one chat server.
- **Treating persistence and real-time delivery as alternative paths rather than both happening for every message.** As shown in Step 4, both need to happen together — persistence supports offline delivery and history, while the WebSocket push supports low-latency delivery when the recipient is online — a design that only does one or the other isn't meeting the stated requirements.
- **Relying on wall-clock timestamps alone for message ordering across servers with independent clocks.** Clock skew between servers can produce a genuinely inconsistent apparent ordering — a per-conversation sequence number, assigned deterministically at persistence time, avoids this problem entirely.
