---
title: "Agent Loops and Tool Use: How LLMs Take Action"
short_title: "Agent Loops and Tool Use"
tags: ["agents", "tool-use", "llm", "function-calling"]
sources:
  - "Anthropic documentation on tool use / function calling"
  - "OpenAI documentation on function calling and the assistants API"
  - "ReAct: Yao et al., 'ReAct: Synergizing Reasoning and Acting in Language Models' (2022)"
---

## What makes something an "agent" rather than a chatbot

A plain LLM call takes a prompt and returns text — it can't check a database, call an API, or run code. An **agent** wraps an LLM in a loop that lets it take actions in the world and observe the results, then decide what to do next based on those results. The core loop is: the model decides an action (call a tool), the system executes it and returns the result, the model sees the result and decides the next action — repeating until the model determines the task is done.

This is a meaningfully different failure surface than a single-shot prompt: a chatbot that gives a wrong answer is just wrong once; an agent that takes a wrong *action* (deletes the wrong file, sends the wrong email, loops forever) can cause real side effects, which is why agent design puts more weight on constraining and observing each step than plain prompting does.

## Tool use / function calling: the mechanism

Most production LLM APIs support **tool use** (also called function calling): you describe available tools to the model as structured schemas (name, description, parameters), and the model — instead of just generating text — can output a structured request to call one of those tools with specific arguments. The application executes the actual tool (a database query, an API call, a calculation) and returns the result back to the model as part of the conversation, letting it continue reasoning with that new information.

The model never directly executes anything — it only requests a call; the application layer decides whether and how to actually run it. This separation is what makes tool use safe to build guardrails around: you can validate, rate-limit, log, or reject a requested tool call before it ever executes, since the model's output is a request, not an action.

## The ReAct pattern: reasoning interleaved with acting

A common structure for agent loops, formalized as **ReAct** (Reason + Act), interleaves the model's reasoning about what to do with the actual tool calls and their results: the model produces a thought ("I need to check the user's order history before refunding"), an action (call `get_order_history`), observes the result, produces another thought based on what it found, and continues. Making the reasoning step explicit — rather than jumping straight to actions — measurably improves an agent's ability to handle multi-step tasks and recover from unexpected tool results, since the model has a visible place to reconsider its plan rather than committing to a rigid pre-planned sequence.

## Why agent loops need harder guardrails than single-shot prompts

- **Bounded iterations.** Without a maximum step count, a confused agent can loop indefinitely — retrying a failing tool call, or oscillating between two actions that undo each other. Every production agent loop needs a hard cap on steps, with a defined fallback (ask the user, or fail explicitly) when the cap is hit.
- **Tool-level permission scoping.** An agent given a broad "run any SQL query" tool can, in principle, be steered (by a bad prompt, an adversarial input, or a model mistake) into a destructive query. Narrower tools — `get_order_by_id` instead of `run_arbitrary_query` — bound what's possible to go wrong, even if the model's reasoning fails.
- **Human-in-the-loop for irreversible actions.** Sending an email, executing a financial transaction, or deleting data are typically worth a confirmation step before execution, even in an otherwise autonomous agent — the cost of a wrong confirmation prompt is low; the cost of a wrong irreversible action can be high.
- **Observability into the full trace.** Logging only the final output loses the ability to debug *why* an agent took a wrong action — the full sequence of thoughts, tool calls, and observations needs to be recorded, not just the outcome (this connects directly to this track's evaluation and observability lesson).

## A worked example

**Scenario:** a customer support agent that can look up orders, check inventory, and issue refunds.

- **Tool design:** three narrow tools — `get_order(order_id)`, `check_inventory(sku)`, `issue_refund(order_id, amount)` — rather than one broad `run_database_query` tool. This means even a model mistake can only take actions the tool schema explicitly allows, not an arbitrary query.
- **Guardrail on the risky tool:** `issue_refund` requires a confirmation step — the agent proposes the refund with its reasoning, and the flow either auto-approves under a set dollar threshold or routes to a human for anything above it, rather than letting the model execute refunds of any size autonomously.
- **Step limit:** the loop caps at, say, 10 tool calls per user request; if the agent hasn't resolved the request by then, it hands off to a human with the full trace attached, rather than continuing to retry indefinitely.
- **Trace logging:** every thought, tool call, and result is logged per conversation, so a wrong refund decision can be traced back to exactly which observation or reasoning step led to it — essential both for debugging and for building the eval set that improves the agent over time.

## Common mistakes

- **Giving an agent tools broader than the task needs**, "in case it's useful" — this expands the space of possible wrong actions without a corresponding benefit, and narrow, task-specific tools are usually both safer and easier for the model to use correctly.
- **No step limit**, letting a stuck agent loop indefinitely and burn cost (and, if tools have side effects, potentially repeat an action) without ever surfacing the failure to a human.
- **Treating tool results as always trustworthy.** A tool call can fail, time out, or return malformed data — an agent loop needs to handle tool errors as a first-class case the model can reason about ("the lookup failed, should I retry or ask the user"), not assume every tool call succeeds cleanly.
