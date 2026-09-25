---
title: "Multi-Agent Orchestration: When and How to Split Work Across Agents"
short_title: "Multi-Agent Orchestration"
tags: ["agents", "orchestration", "multi-agent", "llm"]
sources:
  - "LangGraph and CrewAI documentation on multi-agent orchestration patterns"
  - "Anthropic documentation on multi-agent research systems"
---

## Why split one task across multiple agents at all

A single agent loop (covered in this track's agent loops lesson) works well for tasks with a fairly linear structure — reason, act, observe, repeat. Some tasks don't fit that shape well: they have genuinely independent sub-tasks that could run in parallel, they require different specialized behavior at different stages (research vs. writing vs. fact-checking), or the overall context needed would overwhelm a single agent's working context if it tried to hold everything at once. **Multi-agent orchestration** splits a task across multiple agent instances, each with a narrower scope, coordinated by some structure that combines their work.

The key design question isn't "should I use multiple agents" as a default — a single well-scoped agent is simpler to build, debug, and reason about, and multi-agent systems add real coordination complexity. Multi-agent orchestration earns its complexity specifically when a task has structure that benefits from it: genuine parallelism, meaningfully different specialized roles, or context isolation needs that a single agent's context window can't accommodate well.

## Common orchestration patterns

- **Orchestrator-worker (also called supervisor pattern)** — one orchestrating agent breaks a task into sub-tasks and dispatches them to worker agents, then synthesizes their results. The orchestrator holds the overall plan and final synthesis; workers each handle one bounded piece without needing visibility into the whole task. This mirrors the tool-use pattern from the agents lesson, but with entire sub-agents (each potentially running their own reasoning loop) standing in for individual tool calls.
- **Sequential pipeline** — agents run one after another, each consuming the previous agent's output as its input (a research agent's findings feed into a writing agent, whose draft feeds into an editing agent). Useful when the task naturally decomposes into distinct stages requiring different behavior or context, but a failure or quality issue at an early stage propagates forward unless each stage has its own validation.
- **Parallel fan-out/fan-in** — multiple agents work on genuinely independent sub-tasks simultaneously (research agent A investigates topic X while research agent B investigates topic Y), with results merged once all complete. This is the pattern that actually captures a latency benefit from multi-agent structure — genuinely parallelizable sub-tasks reduce wall-clock time, unlike sequential or orchestrator-worker patterns that don't inherently parallelize.
- **Debate/critique** — multiple agents (or the same agent in different roles) evaluate or challenge each other's outputs before finalizing, aiming to catch errors a single agent's reasoning might miss on its own. Adds latency and cost for a potential quality improvement, most justified for high-stakes outputs where an error is costly enough to warrant the extra verification pass.

## The real cost of multi-agent systems

Splitting work across agents doesn't just multiply cost roughly linearly with agent count (each agent is its own set of LLM calls) — it adds coordination overhead that a single agent doesn't have: agents can produce inconsistent or conflicting outputs that need reconciliation, failures in one agent need a defined handling strategy (does the whole task fail, or can the orchestrator route around a failed worker), and debugging becomes harder since a wrong final result could originate from any agent in the chain, requiring full-trace observability (per this track's evaluation and observability lesson) across every agent, not just one. This overhead is the actual reason "just use multiple agents" isn't a default — it's a deliberate structural choice with real, ongoing cost.

## When a single, well-scoped agent is the better choice

Many tasks that look like they need multiple specialized agents can instead be handled by a single agent with well-designed tools and a clear system prompt — the tool-use pattern from the agents lesson often covers what a naive "let's add another agent for this" instinct is reaching for. A single agent with a `search_web` tool and a `summarize` tool, called sequentially within one reasoning loop, can accomplish what a two-agent research-then-writing pipeline does, with meaningfully less coordination overhead and a simpler failure model — multi-agent structure is worth its cost specifically when the sub-tasks genuinely benefit from independent context, parallelism, or specialized behavior that a shared context and tool set can't cleanly provide.

## A worked example

**Scenario:** a research assistant needs to investigate a broad question by gathering information from several distinct sources (academic papers, news articles, a company's internal documents), then produce a synthesized report.

- **Fan-out for the gathering stage**: three parallel worker agents, each scoped to one source type (papers, news, internal docs), run simultaneously — this is a genuine parallelism win, since these searches are independent of each other and don't need to happen sequentially, directly reducing wall-clock time versus one agent working through all three source types in sequence.
- **Orchestrator synthesizes**: a separate orchestrating agent receives all three workers' findings and produces the final report — kept as a distinct step (rather than having one of the search agents also do synthesis) specifically because synthesis benefits from seeing all three sources' findings together, which no single search-focused worker agent has visibility into on its own.
- **Why not more agents**: a "critique" agent reviewing the final report before it ships was considered but deliberately left out for this use case — the report is a well-understood, lower-stakes internal summary, not a high-stakes output where an extra verification pass's added latency and cost would be clearly justified, per the debate/critique pattern's tradeoff above.

## Common mistakes

- **Reaching for multi-agent orchestration as a default architecture "because it seems more sophisticated,"** without a specific structural reason (genuine parallelism, meaningfully distinct specialized roles, or context isolation needs) that a single well-tooled agent couldn't handle — this adds real coordination cost and debugging difficulty for no corresponding benefit.
- **Building a sequential pipeline without validation between stages**, letting an error or low-quality output from an early agent silently propagate and compound through later stages, rather than catching it where it originated.
- **Insufficient observability across the full multi-agent trace.** With several agents involved, a wrong final output could originate from any one of them — without full-trace logging across every agent's reasoning and outputs (not just the final synthesis), diagnosing which agent actually introduced the error becomes far harder than in a single-agent system.
