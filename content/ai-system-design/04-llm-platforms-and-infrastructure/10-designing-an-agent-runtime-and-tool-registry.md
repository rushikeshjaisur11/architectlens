---
title: "Designing an Agent Runtime and Tool Registry"
short_title: "Agent Runtime and Tool Registry"
tags: ["agents", "runtime", "tool-registry", "mcp", "sandbox", "platform", "design"]
sources:
  - "Model Context Protocol specification and documentation"
  - "Public documentation of durable workflow engines and container sandboxes"
  - "OWASP guidance on excessive agency in LLM applications"
  - "MCP specification 2026-07-28 release notes (fetched Oct 2026)"
  - "A2A Protocol documentation v1.0 (fetched Oct 2026)"
  - "Anthropic pricing documentation, Managed Agents section (fetched Oct 2026)"
---

## The problem

Many teams want to build agents. Without shared infrastructure each re-implements the loop, tool calling, state, sandboxing, approvals and logging, usually insecurely. An **agent runtime** provides a managed environment for running agent loops safely at scale, and a **tool registry** is the governed catalogue of capabilities agents may use. Together they turn agent building into configuration plus evaluation rather than bespoke plumbing.

## Step 1: Requirements

- **Execution:** run agent loops reliably, from seconds to hours, with streaming progress.
- **Tools:** discover, describe, authorise and invoke tools from many systems, including via MCP.
- **State and memory:** durable state, conversation and task memory, resumable runs.
- **Safety:** least privilege, sandboxing, approvals, budgets, kill switches.
- **Observability:** full traces of reasoning steps, tool calls and costs.
- **Multi-tenancy and governance:** isolation, quotas, ownership, audit.
- **Scale (example):** 20,000 concurrent runs, 3,000 registered tools.

## Step 2: Architecture

- **Agent definition store:** versioned configuration: model, system prompt, tool set, memory settings, limits, approval rules.
- **Run orchestrator:** starts runs, manages the loop, persists state after every step, handles timeouts and resumption.
- **Model gateway integration:** all model calls go through the LLM gateway for routing, quotas and logging.
- **Tool gateway:** the only path from agents to tools; enforces authorisation, validation, rate limits and approvals.
- **Tool registry:** metadata, schemas, owners, versions, risk classification, health.
- **Sandbox service:** isolated execution for code, browsers and file operations.
- **Memory and state services:** run state, conversation store, long-term memory index.
- **Policy engine and approval service:** rules, human-in-the-loop requests.
- **Observability and evaluation hooks.**

## Step 3: The run loop, made durable

The loop is: build context, call the model, parse tool calls, execute tools through the gateway, append results, repeat until a final answer or a limit. Make each iteration a **recorded step** in a durable workflow: state and the step's result are persisted before continuing, so a crash resumes at the last completed step. Tool calls carry idempotency keys; retries do not repeat side effects. Enforce **limits in the runtime**: maximum steps, tokens, wall-clock time and spend per run, plus loop detection for repeated identical calls. Support pause and resume for approvals and long waits as durable timers, not sleeping workers.

## Step 4: The tool registry

Each tool entry holds: name and description written for the model, a typed input and output schema, owner and contact, version and deprecation status, **risk class** (read, write, destructive, external send), required scopes, rate limits, cost, latency expectations, sandbox requirements and examples. Tools come from OpenAPI services, internal functions and **MCP servers**; the registry normalises them. Governance: registration review, security assessment for risky tools, versioned changes with compatibility checks, health checks and usage analytics. Agents are granted tool sets by policy, not by discovering everything.

## Step 5: Tool execution safety

The tool gateway enforces, outside the model:

- **Authorisation:** user, agent and task scope checks with delegated, short-lived credentials.
- **Validation:** arguments checked against schemas and business rules; return structured errors the model can act on.
- **Rate limits and budgets** per tool, agent and tenant.
- **Approvals** for risky classes, bound to the exact action and parameters.
- **Output handling:** truncate and sanitise tool results before they re-enter the prompt; mark them as untrusted data.
- **Egress control:** block arbitrary network access; allow-list destinations.
- **Sandboxing** of code and browser tools: ephemeral containers, resource limits, no secrets, filesystem isolation.

## Step 6: Memory and context management

Agents accumulate long histories. Provide: a scratchpad for task notes, summarisation of old steps, retrieval of relevant long-term memories, and offloading of large artifacts (files, search results) to storage with handles in the prompt rather than inline. Scope memory per user and tenant, with retention rules and deletion.

## Step 7: Multi-agent support

Allow an agent to call other agents as tools, with delegated permissions that only narrow, a maximum delegation depth, shared budgets, and a trace that stitches the tree together. Provide patterns (supervisor and workers, pipelines) as templates, and guard against cost explosions with run-tree-level limits.

## Step 8: Observability, evaluation and operations

Capture a trace per run: each model call (prompt, response, tokens, cost), tool call (arguments, result, latency, errors), decision and approval. Replay runs for debugging. Evaluate agents with task suites run in sandboxed copies of tools, scoring success, steps, cost and unsafe actions, gated in CI before agent definitions are promoted. Monitor failure categories, loop rate, approval wait times, tool error rates and spend per agent. Provide a **kill switch** per agent and per tool.

## A worked example

**Scenario:** a team deploys an "IT helpdesk agent" that resets passwords and orders hardware.

1. The agent definition lists three tools from the registry: `lookup_user` (read), `reset_password` (write, requires the requesting user's verification), `create_hardware_order` (write, approval above $500).
2. A run starts when an employee messages the helpdesk. The orchestrator persists each step. The agent calls `lookup_user` through the tool gateway, which attaches a token scoped to the requester.
3. For `reset_password` the policy requires a recent multi-factor challenge; the gateway pauses the run and sends a verification prompt. After it succeeds the call runs once with an idempotency key.
4. The employee asks for a monitor costing $650; the order tool exceeds the approval threshold, so the run waits (durably) for the manager's approval, then resumes and completes.
5. The worker running the agent dies after the order call but before logging; the resumed run sees the step recorded as complete from the idempotent response and does not order a second monitor.

## Enterprise practice (verified October 2026)

**Basics.** A runtime executes the agent loop with durable state, timeouts, retries and tool calls; a registry lists tools with schemas and permissions (steps above).

**Standards you should build on (live-checked).**

- **MCP (2026-07-28 revision).** Stateless core (no session handshake), so tool servers scale horizontally behind any load balancer. **Multi Round-Trip Requests** let a server answer `input_required` and the client retry with the answer, replacing long-lived server-initiated streams: good for approvals mid-call. List results carry `ttlMs` and `cacheScope`, so the registry can cache tool catalogues safely. **Tasks** is a formal extension for long-running work with poll-based status. Header-based routing lets the gateway meter and authorise per tool.
- **A2A v1.0** for cross-agent delegation, with signed Agent Cards for discovery and verification. MCP equips one agent with tools; A2A lets agents collaborate.
- **Managed runtimes exist.** Anthropic prices Managed Agents at $0.08 per running session-hour plus tokens (idle time is free; no batch discount). Compare build-versus-buy including runtime cost, not just tokens.

**Enterprise pattern.** The registry stores for each tool: owner, schema version, scopes required, data classification, side-effect class (read, write, irreversible), rate limit and approval rule. The runtime checkpoints after every step so a crashed worker resumes, enforces per-run budgets, and emits one trace per run. Pin tool versions per agent release so a tool change cannot silently alter agent behaviour.

## Common mistakes

- **Every team writing its own agent loop** with its own security gaps.
- **Tools discovered dynamically with no governance**, giving agents unreviewed capabilities.
- **Limits enforced only in the prompt.**
- **In-memory run state**, losing work on restart.
- **Tool outputs inserted as trusted instructions.**
