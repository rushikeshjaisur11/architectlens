---
title: "Tracing and Debugging Multi-Step LLM Pipelines"
short_title: "Tracing Multi-Step Pipelines"
tags: ["observability", "tracing", "debugging", "llm"]
sources:
  - "OpenTelemetry documentation on distributed tracing concepts"
  - "LangSmith and Langfuse documentation on LLM application tracing"
  - "OpenTelemetry GenAI semantic conventions (moved to open-telemetry/semantic-conventions-genai; fetched October 2026)"
banner:
  layout: line
  nodes:
    - [user, "request"]
    - [queue, "spans"]
    - [doc, "trace tree"]
    - [client, "debug"]
predict:
  question: "A support agent quotes a wrong refund. The trace shows correct order data, an outdated policy document from the policy tool, and sound reasoning from that policy. Where is the defect?"
  options: ["In the agent's prompt, which should be tuned for arithmetic", "In the model choice, since reasoning must have been faulty", "In the order lookup, which returned data too late", "In the policy tool's data freshness, not the agent's reasoning"]
  answer: 3
  why: "The agent reasoned correctly from the stale policy it was shown, so the fix is refreshing the tool's data source."
check:
  - q: "Why store traces as a tree of nested spans rather than a flat log stream?"
    options: ["Trees compress better, so the trace takes less storage than flat logs", "Trees allow dropping the trace ID, since nesting already links the steps", "Flat logs cannot record timing, whereas spans always can", "Trees mirror execution, so you can drill into the failing branch directly"]
    answer: 3
    why: "A tree mirroring root request, retrieval, generation and tool spans lets you locate the failing branch directly."
  - q: "What is the cost of truncating logged prompts and tool results to save space?"
    options: ["The exact detail explaining a subtle bug is often what gets cut, defeating the trace", "Truncation changes the model's output, because logs feed back into the context", "Truncation is harmless, as only the first token of a prompt affects the output", "It raises latency, since truncated logs must be re-fetched at query time"]
    answer: 0
    why: "Aggressive truncation can remove precisely the detail needed to diagnose subtle issues."
  - q: "Why does a trace need to rule out retrieval and tool failures before you tune the prompt?"
    options: ["Prompt tuning is impossible once a trace exists", "Retrieval or tool faults can look like reasoning faults, so you tune the wrong part", "Tool failures are always fixed automatically by retries inside the agent", "Reasoning failures never occur when retrieval returned relevant chunks"]
    answer: 1
    why: "Without ruling out other categories first, it is easy to misdiagnose a retrieval or tool problem as a prompting problem and waste effort."
---

## Why multi-step LLM systems need tracing, not just logging

A single LLM call can be debugged by looking at its input and output directly. A RAG pipeline, an agent loop, or a multi-agent system (covered elsewhere in this track) involves many steps — retrieval, tool calls, sub-agent invocations, multiple LLM calls — where the final output is the result of a chain of intermediate decisions. Debugging "why did this produce a wrong answer" in such a system requires seeing the *entire chain*, not just the final input/output pair, because the actual defect could be in any step: bad retrieval, a misinterpreted tool result, a reasoning error at one specific point in an agent loop. This is precisely the same problem distributed tracing solves for traditional microservice architectures — a request that touches multiple services needs its full path recorded to debug, not just the entry and exit points — applied to LLM pipelines' equivalent multi-step structure.

## What a trace actually needs to capture

- **Every LLM call's full input and output** — not summarized or truncated, since the exact prompt (including any injected context) is often where a subtle bug lives, and a truncated log can hide exactly the detail needed to diagnose an issue.
- **Every tool call and its result**, including calls that failed or returned unexpected data — a tool that silently returned malformed data is a common root cause of downstream generation errors that looks, from the final output alone, like a model reasoning failure.
- **Timing per step** — not just for performance debugging, but because unusually slow steps can indicate retries, rate limiting, or a degraded dependency that correlates with quality issues, not just latency ones.
- **Metadata connecting steps into one logical trace** — a trace ID that ties together every LLM call, tool call, and sub-agent invocation that occurred as part of handling one user request, so the full chain can be reconstructed and viewed together rather than as disconnected log lines.
- **Model and parameter versions used at each step** — connecting to this track's evaluation lesson's point about silent model-version changes being a hard-to-diagnose source of regressions; a trace without this can't distinguish "the prompt was wrong" from "the model version changed underneath an unchanged prompt."

## Structuring traces as a tree, not a flat log

The most useful trace representation mirrors the actual execution structure: a root span for the overall request, with nested child spans for each sub-step (a retrieval span, an LLM-generation span, a tool-call span), and further nesting for sub-agent calls within an orchestrator-worker pattern (per this track's multi-agent orchestration lesson). This tree structure — standard in distributed tracing tools like OpenTelemetry, and adopted by LLM-specific observability tools (LangSmith, Langfuse) — makes it possible to visually and programmatically drill into exactly which branch of a complex pipeline produced an unexpected result, rather than manually correlating timestamps across a flat, unstructured log stream.

## Using traces to separate failure categories

A wrong final output in a multi-step pipeline could stem from several genuinely different root causes, and a full trace is what makes distinguishing between them tractable rather than guesswork:

- **Retrieval failure** (in a RAG step) — the trace shows the retrieved chunks didn't contain the needed information, pointing at chunking, embedding, or indexing issues (per this track's RAG and vector-search lessons), not the generation model.
- **Tool failure** (in an agent) — the trace shows a tool call returned an error or unexpected data that the agent then reasoned from incorrectly — the fix is in the tool or its error handling, not the agent's prompt.
- **Reasoning failure** — the trace shows all upstream steps (retrieval, tool calls) returned correct, relevant information, but the model's own reasoning over that correct information still produced a wrong conclusion — this is the case that actually implicates the prompt or the model choice itself, and without the trace ruling out the other categories first, it's easy to misdiagnose a retrieval or tool problem as a "prompting problem" and waste effort tuning the wrong component.

## A worked example

**Scenario:** a customer support agent (using the agent loop and tool-use pattern from this track's agents lesson) gives a wrong refund amount to a user, and the team needs to find out why.

- **The trace shows**: a `get_order(order_id)` tool call that returned correct order data, followed by a `check_refund_policy` tool call that returned an outdated policy document (the actual current policy had been updated, but the tool's underlying data source hadn't been refreshed), followed by the agent correctly reasoning from that (incorrect) policy data to compute a refund amount that was correct *given the stale policy it was shown*, but wrong given the actual current policy.
- **Without the trace**, this would likely have been misdiagnosed as "the agent reasoned incorrectly" and led to unproductive prompt-tuning efforts — the trace makes clear the agent's reasoning was actually sound given its inputs, and the real defect is in the tool's data freshness, a completely different fix (updating the data refresh pipeline) than what a "the model is confused" diagnosis would have led to.
- **This finding also becomes a permanent eval case** (per this track's evaluation lesson) — a regression test ensuring the refund-policy tool's data freshness is checked, preventing the same category of failure from recurring silently.

## Current practice (verified October 2026)

OpenTelemetry's GenAI semantic conventions now cover inference, agent, tool and MCP spans, but community analysis in July 2026 reports every `gen_ai.*` attribute still has **Development** (not Stable) status after the June 2026 move to a dedicated repository. Instrument with OpenTelemetry for vendor neutrality, wrap attribute names in one adapter, capture prompt and completion text only behind a redacting flag, and propagate trace context across agents and MCP calls.

## Common mistakes

- **Logging only the final input and output of a multi-step pipeline.** This makes it structurally impossible to distinguish between the failure categories above — every wrong output looks the same from the outside, even though the actual fixes needed are completely different depending on which step actually failed.
- **Truncating or summarizing logged prompts and tool results "to save space."** The exact detail that would explain a subtle bug is often precisely what gets cut by aggressive truncation, defeating the purpose of having a trace at all for genuinely subtle issues.
- **Not connecting related steps into a single traceable request.** Disconnected log lines for each LLM call and tool call, without a shared trace ID tying them together, forces manual correlation by timestamp — slow, error-prone, and impractical at any real production volume.
