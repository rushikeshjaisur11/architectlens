---
title: "Designing an Agent Workflow Automation Platform"
short_title: "Agent Workflow Platform"
tags: ["workflows", "orchestration", "durable-execution", "platform", "design"]
sources:
  - "Public documentation of durable workflow engines and event-driven orchestration systems"
  - "Garcia-Molina and Salem, 'Sagas' (ACM SIGMOD 1987)"
  - "Anthropic, 'Building effective agents' (workflows versus agents)"
  - "Temporal, 'LangGraph in production: Temporal's LangGraph Plugin' (July 2026) and durable-execution comparisons (hackernoon.com, cordum.io), via search results, October 2026"
  - "MCP specification 2026-07-28, Tasks extension (fetched Oct 2026)"
banner:
  layout: fan
  nodes:
    - [server, "orchestrator"]
    - [model, "agent"]
    - [server, "connectors"]
    - [db, "run state"]
    - [queue, "triggers"]
predict:
  question: "The worker running the ERP step dies mid-call, and the engine retries the same attempt id. What happens?"
  options: ["A duplicate payable is created because the ERP cannot tell the calls apart", "The ERP returns the existing record, so no duplicate is created", "The run restarts from the first step and re-extracts the invoice"]
  answer: 1
  why: "The idempotency key built from the email id lets the ERP return the existing record on retry."
check:
  - q: "Why persist run state after every step with stateless workers?"
    options: ["A crash loses at most the in-flight step, which is simply retried", "It lets workers sleep during long waits without any timers", "It removes the need for idempotency keys on effectful steps"]
    answer: 0
    why: "The lesson says a worker crash loses at most the in-flight step, and durable timers replace sleeping workers."
  - q: "Why pair a LangGraph checkpointer with a durable engine such as Temporal?"
    options: ["Checkpointers cannot store any state about agent reasoning", "Snapshots alone do not detect failure or restart the run, so something must", "Temporal replaces the need for human approval steps"]
    answer: 1
    why: "Checkpointing is not durability: something must still detect failure, decide where to re-enter and restart the run."
  - q: "Why use per-tenant queues and concurrency caps?"
    options: ["They make each individual workflow run faster", "They guarantee exactly-once effects across tenants", "A workflow stuck in a loop cannot starve other tenants"]
    answer: 2
    why: "Isolation per tenant means one runaway workflow cannot consume shared capacity."
---

## The problem

Companies want non-engineers and engineers to build automations that mix **deterministic steps** (call an API, update a record) with **model-driven steps** (classify an email, draft a reply, decide what to do next), triggered by events or schedules. The platform provides the building blocks, runs them reliably at scale, and keeps them safe and observable. It is a workflow engine whose steps can be LLM calls and agents.

## Step 1: Requirements

- **Authoring:** a visual builder and a code API; templates; versioning and review.
- **Triggers:** webhooks, schedules, queue events, manual runs.
- **Steps:** HTTP and database actions, connectors to SaaS tools, LLM calls, agent steps with tools, human approvals, branching and loops.
- **Reliability:** runs survive restarts and failures; retries and timeouts per step; exactly-once effects where it matters.
- **Governance:** secrets, per-workflow permissions, audit, cost limits.
- **Scale (example):** 100,000 workflow runs per hour, 5,000 tenants, runs lasting seconds to days.

## Step 2: Core model

A **workflow definition** is a versioned graph or program of steps. A **run** is one execution of a version with an input payload and its own state. Each step has a type, configuration, retry policy, timeout and an output stored in the run context so later steps can reference it. Triggers create runs; an engine advances them.

## Step 3: Durable execution engine

The central design choice is how runs survive failures:

- **Persist after every step.** Run state and the step's result are written to a durable store before moving on. A worker crash loses at most the in-flight step, which is retried.
- **Workers are stateless** and pull work from per-tenant queues; a scheduler assigns steps whose dependencies are satisfied.
- **Timers and waits** (wait 3 days, wait for approval) are stored as durable timers rather than sleeping workers.
- **Idempotency:** each step attempt has an id; effectful steps use idempotency keys with external APIs so a retry does not repeat a charge or an email.
- **Compensation:** for multi-step side effects, support saga-style undo steps when a later step fails.

Alternatively, build on an existing durable-execution framework rather than writing the engine, and focus on the step library and governance.

## Step 4: LLM and agent steps

Treat model steps as unreliable, expensive, **non-deterministic** operations:

- **Typed outputs:** enforce a schema, validate, and retry or route to a fallback branch when invalid.
- **Bounded agents:** an agent step has a tool allow-list, a maximum number of iterations, and a cost cap, and returns a structured result to the deterministic workflow around it.
- **Caching and replay:** record inputs, outputs and the model version of every call so a run can be replayed for debugging and so retries do not re-bill a successful call.
- **Prefer deterministic logic where it works:** use the model for judgement and language, and ordinary code for routing, arithmetic and data lookups.

## Step 5: Human in the loop

Approval steps pause a run and notify a person (email, chat) with the context and options. The run waits durably, with timeouts and escalation. Record who approved what and when; for risky actions make approval mandatory by policy rather than optional in the design.

## Step 6: Multi-tenancy, secrets and limits

- **Isolation:** per-tenant queues, concurrency caps and rate limits, so a workflow stuck in a loop cannot starve others.
- **Secrets** stored in a vault, referenced by name, injected only at step execution, never exposed to the model or logged.
- **Connector permissions** scoped per workflow with least privilege; OAuth tokens per tenant.
- **Cost and loop protection:** run-level step and token budgets, maximum run duration, and circuit breakers for repeatedly failing steps.
- **Sandboxed custom code** steps with resource limits.

## Step 7: Observability and operations

Each run has a **timeline** of steps with inputs, outputs, durations, retries and errors; search and filter by status. Alert on failure rates, stuck runs and spend. Provide a replay or re-run-from-step feature, and dry-run mode with mocked effects for testing. Version workflows and support gradual migration of in-flight runs to new versions, or let them finish on the old version.

## A worked example

**Scenario:** a workflow triages incoming invoices from email.

1. A mailbox trigger creates a run with the email and attachment.
2. A deterministic step extracts the PDF; an LLM step with a schema extracts vendor, amount and due date, with a confidence field.
3. A branch: confidence above 0.9 goes straight on; below goes to a **human approval** step that shows the extracted fields next to the PDF.
4. An ERP connector step creates the payable using an idempotency key built from the email id.
5. The worker running step 4 dies mid-call. On restart the engine retries the same attempt id; the ERP returns the existing record, so no duplicate is created. The run timeline shows the retry.

## Enterprise practice (verified October 2026)

**Basics.** Triggers, a graph of steps (LLM calls, tools, conditions, approvals), a state store and retries (steps above).

**Durable execution is now the standard answer for long-running agents (secondary sources, 2026).** Checkpointing is not the same as durability: a LangGraph checkpointer (for example a Postgres saver) snapshots state at each step, but *something* must still detect failure, decide where to re-enter and restart the run. Dedicated engines (**Temporal**, Restate, DBOS, Inngest) provide that, and Temporal reports integrations for the OpenAI Agents SDK and Google ADK plus a **LangGraph plugin in public preview (July 2026)** giving automatic recovery and human-in-the-loop waits that can last days at no compute cost. The commonly recommended pattern is *LangGraph or another framework for reasoning, a durable engine for orchestration and side effects*. MCP's 2026-07-28 revision also moved long-running tool calls into a standard **Tasks** extension with poll-based status.

**Enterprise requirements.**

- **Idempotency:** every side-effecting step carries an idempotency key so a retry cannot send two emails or two refunds; record the intended action before executing it.
- **Human approval as a first-class node**, with the exact proposed action, timeout and escalation path, and an audit record of who approved.
- **Versioning:** a running workflow must keep executing against the definition it started with; migrate in-flight runs deliberately.
- **Limits and observability:** per-run and per-tenant budgets for tokens and steps, loop detection, dead-letter queues, replay of a failed run from its history, and a trace per run.
- **Credential handling:** per-workflow scoped identities, not shared admin tokens.

## Common mistakes

- **In-memory run state**, so a deploy or crash loses work.
- **Retrying effectful steps without idempotency keys.**
- **Using an agent for steps ordinary code could do** deterministically.
- **No per-tenant limits**, letting one runaway workflow starve others.
- **Passing secrets through the model** or into logs.
