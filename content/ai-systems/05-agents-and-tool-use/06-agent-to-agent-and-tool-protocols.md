---
title: "Agent-to-Agent and Agent-to-Tool Protocols: MCP and A2A"
short_title: "Agent Interop Protocols"
tags: ["mcp", "a2a", "protocols", "interoperability", "agents"]
sources:
  - "Model Context Protocol specification (modelcontextprotocol.io)"
  - "Agent2Agent Protocol specification (a2a-protocol.org, originally Google)"
  - "Anthropic MCP announcement and documentation (anthropic.com, docs.anthropic.com)"
  - "A2A Protocol documentation, a2a-protocol.org (v1.0, fetched October 2026)"
  - "MCP specification 2026-07-28 release notes, blog.modelcontextprotocol.io/posts/2026-07-28 (fetched October 2026)"
  - "Agentic commerce protocol comparisons, 2026 (secondary: digitalapplied.com, crossmint.com)"
banner:
  layout: line
  nodes:
    - [model, "agent A"]
    - [lb, "A2A"]
    - [model, "agent B"]
    - [server, "tool"]
predict:
  question: "A team wires a supervisor and three workers inside one LangGraph app using A2A between them. What is the likely outcome?"
  options: ["Extra serialization and network overhead with no real benefit", "Better agent discovery, with no change in overhead", "Lower latency, since A2A tasks are asynchronous by design"]
  answer: 0
  why: "A2A's value is cross-trust-boundary discovery and async task lifecycle; in-process handoffs can use direct calls."
check:
  - q: "Which framing correctly splits MCP and A2A?"
    options: ["MCP is for peer agents, and A2A is for giving one agent its tools", "MCP gives one agent its tools, and A2A lets agents act as peers", "Both do the same job, and A2A only adds streaming and auth"]
    answer: 1
    why: "MCP is agent-to-tool; A2A covers discovery and delegation between independent agents."
  - q: "Why avoid hardcoding a remote agent's assumed capabilities?"
    options: ["Agent Cards are needed only for authentication, not capabilities", "Hardcoding is faster but removes the ability to stream results", "It recreates tight coupling and breaks silently when capabilities change"]
    answer: 2
    why: "Reading the Agent Card at a well-known URL is the discovery step that keeps the caller loosely coupled."
  - q: "Why is an MCP server not automatically trustworthy?"
    options: ["A compromised server can return crafted results that inject prompts into the host", "Servers must run remotely, so they are exposed to the internet", "The protocol requires the server to see the model's full history"]
    answer: 0
    why: "A server is code with tool-execution and context-injection access, so treat it like any dependency."
---

## Why standardized protocols exist at all

Before MCP, every agent framework wired tool integrations bespoke: a LangChain agent's Slack integration and a custom agent's Slack integration shared no code, no auth pattern, no discovery mechanism — an M×N problem where every agent needs custom glue for every tool. Standardized protocols turn that into an M+N problem: tools implement one server interface, agents implement one client interface, and any conforming agent can use any conforming tool. This is the same shift HTTP made for client-server communication, applied to agent-tool and agent-agent wiring.

## MCP: agent-to-tool

The Model Context Protocol (introduced by Anthropic, late 2024) standardizes how an agent (the **host**, e.g., Claude Desktop or Claude Code) connects to external context and capability providers (**MCP servers**). It's a client-server protocol over JSON-RPC 2.0, transported via stdio (local processes) or HTTP/SSE (remote servers).

An MCP server exposes three primitive types:

- **Tools** — callable functions with JSON Schema parameters, analogous to function-calling tool definitions but discoverable at connection time rather than hardcoded into the prompt.
- **Resources** — read-only data the host can pull into context (a file, a database row, a URL) without necessarily invoking a "tool call" — closer to a GET than a POST.
- **Prompts** — reusable prompt templates the server exposes, letting a tool provider ship recommended usage patterns alongside the tool itself.

The practical effect: an agent host can connect to any number of MCP servers (Postgres, GitHub, Slack, a filesystem) without the agent's core code knowing anything about those integrations in advance — capabilities are discovered via a `list_tools`/`list_resources` handshake at connection time. This is why MCP adoption spread quickly past Anthropic's own products — OpenAI and Google have both added MCP client support, since the protocol is provider-agnostic once you're speaking JSON-RPC over a defined schema.

## A2A: agent-to-agent

The Agent2Agent protocol (originally published by Google, now under Linux Foundation stewardship alongside contributions from Anthropic and others) addresses a different problem: MCP standardizes how one agent calls tools, but says nothing about how two independent *agents* — each with their own internal reasoning, memory, and tool access — discover each other and delegate work. A2A defines:

- **Agent Cards** — a JSON document at a well-known URL describing an agent's capabilities, supported input/output modalities, and authentication requirements, so a calling agent can discover what a remote agent can do before invoking it.
- **Tasks** — a unit of work sent to a remote agent, with a defined lifecycle (submitted, working, input-required, completed, failed) that supports long-running, asynchronous work rather than assuming a synchronous request-response.
- **Streaming and push notifications** for tasks that take longer than a single HTTP round trip, and a mechanism for the remote agent to ask the calling agent for more input mid-task (`input-required`) rather than failing outright.

The conceptual split: **MCP is for giving an agent hands** (tools, data access); **A2A is for letting agents talk to other agents as peers**, each an opaque reasoning system behind a capability card, without either side needing to know the other's internal architecture, model, or framework.

## When you need which

- A single agent calling out to databases, APIs, or file systems: MCP.
- A single agent needing a reusable, versioned library of internal tool integrations shared across multiple agent products: MCP servers as the packaging unit.
- Multiple autonomous agents (possibly built by different teams or vendors) that need to delegate sub-tasks to each other and track long-running async work: A2A.
- A tightly-coupled multi-agent system within one codebase (e.g., a supervisor and worker agents in a single LangGraph app) generally doesn't need A2A's discovery and auth machinery — direct function calls or an in-process message bus are lower-overhead until agents genuinely live in separate trust domains or deployments.

## Current practice (verified October 2026)

**A2A reached v1.0** (reported released 12 March 2026) under the Linux Foundation, with signed Agent Cards (JWS with canonicalisation) so one agent can verify another's domain and declared capabilities, and enterprise multi-tenancy. Its own documentation frames the split: use MCP to give one agent its tools, use A2A to let specialised agents collaborate. Reported adoption by April 2026 included more than 150 supporting organisations and integrations in Azure AI Foundry, Amazon Bedrock AgentCore and Salesforce Agentforce. In commerce, ACP (checkout, from Stripe and OpenAI), AP2 (payment mandates, contributed to the FIDO Alliance in April 2026) and UCP address different layers; confirm each spec's version before building, since this area moves quickly.

## Common mistakes

- **Reaching for A2A inside a single-process multi-agent system.** A2A's value is cross-trust-boundary discovery and async task lifecycle; using it for in-process agent handoffs adds serialization and network overhead for no benefit.
- **Treating MCP servers as automatically trustworthy.** An MCP server is code you're granting tool-execution and context-injection access to; a malicious or compromised server can return crafted tool results or resource content that constitutes a prompt injection into the host agent's context.
- **Skipping the Agent Card / discovery step and hardcoding a remote agent's assumed capabilities** — this reintroduces exactly the tight coupling A2A exists to remove, and breaks silently when the remote agent's capabilities change.
