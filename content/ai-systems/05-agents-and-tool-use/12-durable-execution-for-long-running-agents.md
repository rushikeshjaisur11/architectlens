---
title: "Durable Execution for Long-Running Agents"
short_title: "Durable Execution for Agents"
tags: ["agents", "durable-execution", "checkpointing", "workflows", "reliability"]
sources:
  - "Temporal, 'LangGraph in production: Temporal's LangGraph Plugin adds Durable Execution' (July 2026) and durable-execution comparisons (hackernoon.com, cordum.io), via search results, October 2026"
  - "MCP specification 2026-07-28, Tasks extension, blog.modelcontextprotocol.io (fetched October 2026)"
banner:
  layout: line
  nodes:
    - [server, "workflow"]
    - [db, "event log"]
    - [server, "worker"]
    - [queue, "resume"]
---

## The problem: agents that outlive a process

A simple agent finishes in seconds inside one request. Useful agents do not: research a topic for 20 minutes, wait two days for a human to approve a refund, process 5,000 documents overnight, retry a flaky vendor API for an hour. During that time servers restart, deployments roll, networks drop and rate limits hit. If the agent's state lives in the memory of one process, any of those events loses the work, and re-running from scratch repeats expensive model calls and, worse, repeats side effects (a second email, a second payment).

**Durable execution** is the property that a long-running program survives failures and resumes where it stopped, with completed steps not repeated.

## Checkpointing is not the same as durability

Agent frameworks such as LangGraph can **checkpoint**: save a snapshot of the graph state after every step to a store such as Postgres, so a run can be resumed. That is necessary but not sufficient. Someone still has to **detect** that a worker died, **decide** where to re-enter, **restart** the run, and ensure that a step which had started but not finished is handled safely. Durable-execution engines (Temporal, Restate, DBOS, Inngest) supply those parts: they record every step's outcome in an event history, replay it after a crash so completed steps return their stored results, and re-run only unfinished work. Secondary sources report integrations between these engines and agent frameworks (for example, a Temporal plugin for LangGraph in public preview as of July 2026, and integrations with the OpenAI Agents SDK and Google ADK), and a common production pattern: the framework handles *reasoning*, the durable engine handles *orchestration and side effects*.

## Idempotency: the rule that makes retries safe

Replay and retry mean a step may execute more than once. For read-only steps that is harmless. For steps with side effects it is not, so each must be **idempotent**: running it twice has the effect of running it once. The usual technique is an **idempotency key**, a unique id for the intended action, sent to the downstream system: "refund order 8841, key r-8841-1". If the call is retried, the payment API recognises the key and returns the original result instead of paying twice. For systems without such support, record the intent first, perform the action, then record completion, and check the record before acting.

## Human-in-the-loop as a first-class wait

Approval steps are the natural reason an agent must be durable. A durable engine lets a workflow **wait** for a signal (the approval) for hours or days without holding a thread or a model connection, then continue with full state. Design the approval as a node with: the exact proposed action, a timeout, an escalation path when nobody responds, and an audit record of who approved. MCP's 2026-07-28 revision also standardised long-running tool calls as a **Tasks** extension with poll-based status, so a tool can say "started" and let the agent check back.

## Versioning in-flight work

A workflow that started last Tuesday must finish under the code and prompts it started with, or be migrated deliberately. Changing a step order while runs are in flight can break replay. Practices: version workflow definitions, route new runs to the new version, drain or migrate old ones, and treat prompt and model changes as versioned inputs recorded in the history.

## A worked example

An agent processes supplier invoices: extract fields, match to purchase orders, request approval over $5,000, pay.

1. Step 1 extracts fields with a model (cost $0.03). The engine stores the result.
2. The worker crashes during step 2 (matching). A new worker replays: step 1 returns its stored result instantly, with no second model call; step 2 re-runs.
3. Step 3 sends an approval request and waits. Two days pass with no compute used. The manager approves; the workflow resumes.
4. Step 4 pays using idempotency key `inv-20931-pay`. A network timeout triggers a retry; the payment system returns the first result. The vendor is paid once.
5. Every step, retry and approval appears in the run history for audit.

## Practical rules

- **Make every side-effecting step idempotent** and carry a key.
- **Cap budgets per run**: tokens, steps, wall-clock, retries; loop detection for agents that cycle.
- **Separate deterministic orchestration from non-deterministic model calls**; record model outputs so replay is exact.
- **Use dead-letter queues and alerts** for runs that exhaust retries.
- **Expose status**: users and operators need to see where a long run is.
- **Scope credentials per workflow**, not shared admin tokens.

## Common mistakes

- **Equating a checkpoint with durability.**
- **Retrying payments or emails without idempotency keys.**
- **Holding a connection open** for a two-day approval.
- **Changing workflow code under in-flight runs** without versioning.
- **No visibility** into stuck runs until a customer complains.
