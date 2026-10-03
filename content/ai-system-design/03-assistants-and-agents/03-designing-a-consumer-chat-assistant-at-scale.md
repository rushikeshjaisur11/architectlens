---
title: "Designing a Consumer Chat Assistant at Scale"
short_title: "Consumer Chat Assistant at Scale"
tags: ["chat", "conversation", "streaming", "memory", "scale", "design"]
sources:
  - "Public engineering write-ups on large-scale chat assistant infrastructure"
  - "Server-Sent Events and WebSocket specifications for streaming transports"
  - "Public provider documentation on conversation context management and rate limiting"
  - "California SB 243, Companion Chatbots (signed 13 October 2025, effective 1 January 2026), via law-firm summaries (Jones Walker, Future of Privacy Forum), October 2026"
  - "Provider privacy and data-retention policies for consumer versus API data, 2026 (secondary summaries)"
banner:
  layout: line
  nodes:
    - [user, "users"]
    - [lb, "gateway"]
    - [model, "LLM pool"]
    - [db, "memory"]
predict:
  question: "A user closes the browser tab halfway through a streamed answer. What should the chat service do?"
  options: ["Keep generating to the end so the full answer is cached for later", "Cancel generation and store the partial message so a reconnect can resume", "Discard the partial output and restart the answer on reconnect"]
  answer: 1
  why: "The lesson says to cancel generation on disconnect to save GPU time and store partial output so a reconnect resumes."
check:
  - q: "Why scale the chat tier on concurrent streams rather than on request rate?"
    options: ["Each reply is a long-lived connection, so the tier is connection-bound", "Request rate cannot be measured once responses are streamed", "Streams use more CPU per token than ordinary web requests do"]
    answer: 0
    why: "Long-lived SSE or WebSocket connections make the edge and chat tiers connection-bound, so concurrency is the limiting factor."
  - q: "Why give paid users a separate queue with reserved capacity rather than one shared queue?"
    options: ["Separate queues make every request faster during normal load", "A single queue cannot enforce per-user message limits", "Priority classes keep a surge from starving the traffic that must stay served"]
    answer: 2
    why: "Demand exceeds capacity at peaks, so priority classes and reservations decide who is degraded first; the worked example keeps paid users on a reserved pool."
  - q: "Why disable the code-execution tool for the free tier during a launch surge?"
    options: ["It protects limited sandbox capacity while core chat keeps working", "Free users are not allowed to run code under the terms of service", "Code execution is the main cause of prompt injection in surges"]
    answer: 0
    why: "The worked example degrades heavy tools first to protect sandbox capacity, and lifts the degradations in reverse order as queues drain."
---

## The problem

Design a ChatGPT-style product used by millions: users hold multi-turn conversations, see answers stream in, use tools and files, and expect history across devices. The product combines classic web scale (sessions, storage, fan-out) with expensive, slow, GPU-bound generation, so the design centres on **streaming, conversation state, fairness under load and cost control**.

## Step 1: Requirements

- **Functional:** chat with streaming replies, conversation history and search, file and image uploads, tools (web search, code execution), regenerate and edit, sharing, settings and personalisation, memory.
- **Non-functional:** time to first token under about 1 second, high availability, graceful degradation under overload, strong privacy, abuse resistance.
- **Scale (example):** 50 million weekly users, 1 million concurrent conversations at peak, average 6 turns of 400 output tokens.
- **Cost:** model inference dominates; free and paid tiers need different limits.

## Step 2: High-level architecture

- **Edge and API gateway:** TLS, authentication, rate limiting and abuse detection, routing to regions.
- **Chat service:** stateless handlers that load conversation context, build the prompt, call the inference layer and stream tokens back.
- **Conversation store:** durable storage of messages, metadata, attachments, per-user partitioned.
- **Inference layer:** routing to model pools (small, medium, large) with queueing, priorities and capacity management.
- **Tool services:** web search, code sandbox, file processing, image handling.
- **Memory service:** long-term user memories retrievable per conversation.
- **Safety services:** input and output moderation, abuse detection.
- **Async pipelines:** title generation, summarisation, indexing for search, analytics, feedback.

## Step 3: Streaming

Replies arrive token by token. Use **Server-Sent Events** (simple, one-way, works through proxies) or WebSockets for richer interaction. Each connection is long-lived, so the edge and chat tiers are **connection-bound**: scale on concurrent streams, use event-driven servers, keep per-connection memory low, and set sensible idle and maximum durations. Handle client disconnects by cancelling generation to save GPU time, and support **resume**: store partial output server-side so a reconnect continues rather than restarts. Backpressure from slow clients must not block the inference stream.

## Step 4: Conversation state and context

Store every message durably, keyed by user and conversation, in a partitioned store with the latest messages cached for fast access. For each turn the chat service builds the prompt from the system prompt, memories, retrieved or attached content, and the **conversation history**. Long conversations exceed the context window or budget, so apply: sliding windows, summarisation of older turns, selective inclusion of relevant earlier messages, and truncation of large tool outputs. Keep message ordering and idempotency: a retried request with the same id must not duplicate a turn. Branching (edit, regenerate) is modelled as a tree of messages.

## Step 5: Inference scheduling and fairness

Demand exceeds capacity at peaks, so design the queueing policy deliberately:

- **Priority classes:** paid users, free users, API and batch, with separate queues and capacity reservations.
- **Admission control:** estimate cost (prompt length, model tier) and reject or queue with a clear message when overloaded; show position or estimated wait.
- **Model routing:** simple queries to smaller models, with automatic escalation; fall back to a smaller model when large pools are saturated.
- **Per-user limits:** messages per hour by tier, concurrent generations per user, and token caps, with abuse detection for scripted use.
- **Continuous batching** and prefix caching in the serving layer; route conversations with shared prefixes to the same replicas.

## Step 6: Tools and files

Tools run in isolated services. Web search returns snippets to the model with citations; code execution runs in sandboxed containers with CPU, memory, time and network limits and no secrets; file uploads are scanned, parsed (OCR, text extraction), chunked and retrieved per conversation, with per-user storage quotas and lifecycle. Tool latency is part of the user experience, so stream status updates ("searching…") and parallelise independent calls.

## Step 7: Memory and personalisation

Long-term memory stores facts and preferences the user chose to share, extracted by a background process and stored as small items with embeddings. Retrieve a few relevant memories per conversation. Give users **visibility and control**: view, edit, delete, disable; keep memory separate from model training by default and honour data-use settings. Apply privacy rules for sensitive categories.

## Step 8: Safety, abuse and trust

Moderate inputs and outputs (including streaming outputs), rate limit and detect abuse (spam, jailbreak farming, credential stuffing), protect minors per policy, and provide reporting and appeals. Prompt-injection controls apply to tools and uploaded documents. Monitor safety metrics and add rapid-response blocklists and classifier updates.

## Step 9: Reliability and operations

Multi-region deployment with users routed to the nearest healthy region; conversation data replicated according to residency policy; graceful degradation modes (disable heavy tools, shorter outputs, smaller models) defined in advance. Observability: TTFT, tokens per second, queue depth, error and refusal rates, cost per conversation, and quality sampling. Plan capacity from user growth and tokens per conversation, with launch-day surge procedures.

## A worked example

**Scenario:** a surge hits when a new feature launches.

1. Traffic doubles in ten minutes. The gateway's per-tier limits start rejecting scripted traffic; abuse detection flags a bot network.
2. Large-model queues grow; admission control shows free users an estimated wait of 20 seconds, while paid users keep priority with a reserved pool.
3. The router temporarily sends simple queries from free users to the medium model, and disables the code-execution tool for free tier to protect sandbox capacity.
4. One user closes the tab mid-answer: the chat service detects the disconnect, cancels generation and stores the partial message; on reconnect the client resumes from the saved state.
5. Autoscaling adds replicas from a warm pool within a minute; as queues drain, degradations are lifted in reverse order, and a postmortem adds launch-surge capacity reservations to the plan.

## Enterprise practice (verified October 2026)

**Basics.** Stream responses, keep conversation memory, moderate, cache, autoscale (steps above).

**Regulation and policy now shape consumer chat design (US example; secondary summaries).** **California SB 243** (effective 1 January 2026) applies to *companion chatbots* and requires clear disclosure that the user is talking to an AI when a reasonable person might think otherwise; for users the operator **knows are minors**, a reminder at least every **three hours** of continuous use to take a break and that the chatbot is AI-generated, and reasonable measures to prevent sexually explicit content; operators must also maintain protocols for suicide and self-harm and the law allows private suits at **$1,000 per violation**. It does not require age verification of every user, but "knows or reasonably should know" is assessed per user, so age-signal detection matters. Other states (for example New York) have enacted related laws. Check applicability to *your* product: general assistants may fall outside "companion" definitions yet face similar expectations.

**Data policy.** Consumer and enterprise tiers differ: major providers state that **API and enterprise data is not used for training by default**, while consumer chats may be used unless the user opts out; one provider's June 2026 policy update reportedly allows conversations flagged for safety review to be used regardless of the opt-out. Present your own training-use policy plainly and let users delete history.

**Scale design.** Treat conversation state as an externalised, region-pinned store, stream tokens over SSE or WebSockets with backpressure, apply per-user rate limits and abuse detection, route simple turns to smaller models, and maintain crisis-response flows (detect self-harm signals, surface resources, escalate) as a tested, versioned component.

## Common mistakes

- **Treating the chat service as stateless HTTP** and ignoring long-lived streams.
- **No cancellation** when users disconnect, burning GPU on unseen output.
- **Unbounded history** in every prompt, inflating cost and latency.
- **One queue for all traffic**, with no priority or admission control.
- **Memory without user control**, creating privacy and trust problems.
