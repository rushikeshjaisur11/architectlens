---
title: "OpenTelemetry and Standards for GenAI Observability"
short_title: "OpenTelemetry for GenAI"
tags: ["observability", "opentelemetry", "tracing", "semantic-conventions", "mcp"]
sources:
  - "OpenTelemetry GenAI semantic conventions (moved to open-telemetry/semantic-conventions-genai; fetched October 2026)"
  - "Community analyses of OpenTelemetry GenAI convention stability, July 2026 (for example john-hodge.com)"
banner:
  layout: line
  nodes:
    - [server, "app"]
    - [doc, "GenAI spans"]
    - [queue, "collector"]
    - [client, "backend"]
---

## Why a standard helps

An LLM application is a chain: a request, retrieval, one or more model calls, tool calls, maybe other agents. Observability tools each used to invent their own field names for the same things ("prompt tokens", "model name", "tool result"), so switching vendors meant re-instrumenting code and mixing tools meant inconsistent traces. **OpenTelemetry (OTel)** is the vendor-neutral standard for traces, metrics and logs; its **semantic conventions** fix the *names and meanings* of attributes so that any backend can interpret them. For generative AI, the `gen_ai.*` conventions define how to describe a model call.

## What the conventions cover

The GenAI conventions describe, among other things:

- **Inference (model call) spans**: provider, request model, response model, token usage (input and output), finish reason, and sampling parameters.
- **Agent spans**: an agent invocation and its steps.
- **Tool-call spans**: tool name and outcome.
- **Metrics**: token usage and operation duration, so you can chart cost and latency per model.
- **Events or attributes for content**: the prompt and completion text, with explicit guidance on capturing sensitive content.
- **Provider-specific pages** for Anthropic, AWS Bedrock, Azure AI and OpenAI, and **MCP** conventions for tool servers.

## The stability caveat

Standards have maturity levels. In June 2026 the GenAI conventions moved out of the main semantic-conventions repository into a dedicated `semantic-conventions-genai` repository, and community analysis in July 2026 reports that **every `gen_ai.*` attribute, span, metric and event still carries "Development" status, not Stable**, meaning names and semantics can still change. The documentation provides an opt-in environment variable to select the newest experimental version. In practice many teams report the client-span and metric parts as stable in behaviour for a while, while agent and framework spans change more. Plan for change.

## How to use them safely

- **Instrument with OTel anyway**, because the alternative is lock-in to one vendor's schema, but wrap the attribute names in **one adapter module** so a rename costs one edit.
- **Do not capture prompt and completion text by default.** It is the most sensitive data in the system (customer messages, documents, secrets). Capture content behind a flag, redact, restrict access by tenant, and keep it a short time. Always capture metadata: model, token counts, latency, cache hit, tool name, error type.
- **One trace per user request**, with child spans for retrieval, each model call and each tool call, so a slow or expensive request can be broken down.
- **Propagate context across services and agents** (trace and span ids through headers) so multi-agent flows form one trace.
- **Derive cost** as a metric from token counts and a versioned rate card rather than trusting a provider's dashboard alone.

## A worked example

A support agent request takes 14 seconds, against a 6-second target.

1. The trace shows: retrieval 0.4 s, first model call 2.1 s, a tool call to the CRM 7.8 s, a second model call 1.9 s, final answer 1.8 s.
2. The `gen_ai` token metrics show the second call received 38,000 input tokens (the CRM tool returned a full customer history).
3. Fix: trim the tool output to the last five interactions and cache the CRM lookup for 30 seconds. Latency drops to 5 s; input tokens fall 85%.
4. Because attribute names are wrapped in an adapter, the team can switch tracing backends later without touching application code.

## Practical rules

- Sample all errors and low-feedback requests, and a small share of the rest.
- Link traces to evaluation runs and prompt versions, so a regression points at a change.
- Alert on cost per request, tokens per request and tool error rate, not only latency.
- Review what is captured as part of a privacy assessment.

## Common mistakes

- **Logging full prompts everywhere** and creating a sensitive-data store.
- **Hard-coding vendor-specific attribute names** across the codebase.
- **Assuming "standard" means "stable"**.
- **Tracing only the model call**, missing the retrieval or tool that is the real bottleneck.
- **No cost metrics**, so budget overruns surface in the invoice.
