---
title: "Model Context Protocol (MCP): A Standard Way to Connect Models to Tools"
short_title: "Model Context Protocol (MCP)"
tags: ["mcp", "agents", "tool-use", "protocols"]
sources:
  - "Model Context Protocol specification, architecture overview (modelcontextprotocol.io)"
  - "Anthropic announcement of the Model Context Protocol (November 2024)"
---

## The integration problem MCP exists to solve

This track's agents lesson covers tool use: you describe a tool to the model, the model asks to call it, and your application runs it. That works, but every application ends up writing its own glue — its own schema format, its own wrapper around each API, its own handling of auth and errors. With N AI applications and M tools or data sources, you get N×M bespoke integrations, each maintained separately and none reusable by the next application.

**The Model Context Protocol (MCP)** is an open standard that turns N×M into N+M. A tool or data source is wrapped once as an MCP *server*; any MCP-aware application can then connect to it without custom code. The comparison people reach for is USB: one connector shape instead of a drawer of proprietary cables.

## The three roles

The architecture separates three parts, and the separation is the point:

- **Host** — the user-facing AI application (a chat app, an IDE, an autonomous agent). It runs the model, decides what the user has authorized, and manages connections.
- **Client** — a component inside the host that holds one connection to one server, handling discovery, requests, and notifications. A host runs one client per server it talks to.
- **Server** — an independent process that exposes capabilities. It knows nothing about which model is on the other end.

The host is the trust boundary. The model never talks to a server directly; the host mediates, which is where permission prompts, allow-lists, and logging belong.

## What a server can expose

Servers offer three kinds of capability, and they differ in *who controls them*:

- **Tools** — functions the *model* can decide to call (query a database, create a ticket). Model-controlled, and the ones with side effects.
- **Resources** — data the application or user can attach as context (a file, a schema, a record). Application-controlled, read-oriented.
- **Prompts** — reusable, parameterized templates a *user* can invoke (a "review this pull request" workflow). User-controlled.

Keeping these separate matters for safety: a read-only resource and a tool that deletes rows should not be treated as the same kind of thing just because both arrive over the same protocol.

## Transports and message format

MCP messages are JSON-RPC. They travel over one of two transports:

- **stdio** — the host launches the server as a local subprocess and talks over standard input/output. Simple, no network, suited to local tools.
- **Streamable HTTP** — the server is remote, reached over HTTP, with OAuth the recommended way to obtain authorization.

The current specification revision (2026-07-28) describes the protocol as stateless at the request level: each request carries its own protocol version and capability information rather than depending on a long-lived handshake. Earlier revisions leaned on a stateful initialization exchange, so check which revision a given SDK or server targets before assuming behavior.

## Where MCP does not help, and where it adds risk

MCP standardizes the *plumbing*. It does not make a tool safe, make the model choose well, or make a server trustworthy. Two risks deserve naming, both extensions of this track's safety lessons:

- **Tool descriptions are model-visible input.** A server supplies the text describing its tools, and that text goes into the model's context. A malicious or compromised server can put instructions in a description or result — the indirect prompt injection pattern from this track's safety lesson, delivered through a new channel.
- **Overly broad tools.** Connecting a server that exposes "run any query" recreates the unscoped-tool problem from the agents lesson, now one config line away from a user's whole machine.

## A worked example

**Scenario:** an engineering team wants their IDE assistant and a separate support-triage agent to both read from the company's issue tracker.

- **Without MCP**, they write two integrations, one per application, with separate auth handling and separate schemas.
- **With MCP**, they write one issue-tracker server that exposes a read-only `search_issues` tool and an `issue` resource. Both applications connect to it as clients.
- **Safety choices made at the host:** the support agent is given only the read-only tools; creating or closing issues is a separate server, enabled only in the IDE assistant and gated behind a user confirmation. The server's tool descriptions are reviewed like code, since they flow straight into the model's context.

## Common mistakes

- **Treating "it speaks MCP" as a trust signal.** The protocol says nothing about whether a server is honest or well-scoped; vet servers the way you would any dependency with access to your data.
- **Exposing write-capable tools by default.** Start read-only and add side-effecting tools deliberately, each behind the host's confirmation step.
- **Assuming every server and SDK implements the same spec revision.** The protocol has changed between revisions, including around statefulness; pin and check versions rather than guessing.
