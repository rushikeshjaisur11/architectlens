---
title: "Human-in-the-Loop and Approval Gates for Agentic Actions"
short_title: "Human-in-the-Loop Gates"
tags: ["human-in-the-loop", "approval-gates", "safety", "agents"]
sources:
  - "LangGraph human-in-the-loop documentation (langchain-ai.github.io/langgraph)"
  - "Anthropic: Building Effective AI Agents (anthropic.com/research)"
  - "OWASP Top 10 for LLM Applications (owasp.org)"
---

## Why autonomy needs a throttle, not an on/off switch

Full agent autonomy and fully manual approval of every step are both usually wrong for the same reason: the risk profile of agent actions isn't uniform. Reading a file and deleting a production database row are not the same category of decision, and gating both identically either creates approval fatigue (a human rubber-stamping dozens of low-risk actions a day, until they stop actually reading them) or removes the agent's usefulness entirely. The design problem is choosing *which* actions need a human in the loop, not whether any do.

## Where to place the gate

Three common insertion points, each with a different cost/safety tradeoff:

- **Pre-execution approval on specific tool calls.** The agent proposes an action (a specific tool name + arguments) and execution blocks until a human approves, edits, or rejects it. This is the tightest control — nothing happens without sign-off — but doesn't scale to high action-volume agents without becoming a bottleneck. LangGraph's `interrupt()` pattern implements this directly: the graph pauses execution at a node, persists state, and resumes only on external input, so the "wait for human" isn't a polling loop but a real suspend/resume of the agent's state machine.
- **Plan-level approval.** The human reviews and approves an upfront plan (see plan-and-execute) once, and the agent then executes the approved steps autonomously. Lower friction than per-call approval, but only as safe as the plan's granularity — an approved step like "update customer record" can still be executed with a variety of specific arguments the human never saw.
- **Post-hoc review with rollback.** The agent acts autonomously but every action is logged, reversible, and reviewable after the fact (soft-deletes instead of hard deletes, versioned writes, an audit trail). This maximizes throughput and is appropriate when actions are cheap to undo, but is the wrong choice for anything irreversible — sending an email, calling a real payment API, deleting external data the agent doesn't own a backup of.

## Deciding what needs a gate

The practical heuristic used across production agent frameworks: gate on **irreversibility and blast radius**, not on task difficulty. A complex multi-step research task that only reads data needs no gate regardless of how "impressive" the reasoning is; a single-argument tool call that sends a real email, moves real money, or deletes real data needs one regardless of how simple the call looks. Anthropic's agent-design guidance frames this as tiering tool access by consequence: read-only tools can generally run unsupervised, while tools with side effects — especially external-facing or destructive ones — should default to requiring confirmation until the agent has a demonstrated track record in that specific workflow.

## Designing the approval interface itself

An approval gate is only as good as what it shows the human. Presenting a raw tool call (`transfer_funds(amount=5000, to="acct_9F2")`) forces the reviewer to mentally reconstruct context the agent already had. Effective gates surface the *reasoning* alongside the action (why the agent chose this action, what alternatives it considered) and make the diff between "what will happen" and "current state" explicit — the same principle behind reviewing a code diff rather than reviewing a description of a change. A gate that's too slow or too opaque gets approved reflexively, which defeats its purpose; this is the same failure mode as alert fatigue in monitoring systems.

## Interaction with self-correction and retries

Approval gates and self-correction loops (see failure recovery) need to compose carefully: if a rejected or failed action triggers an automatic retry with modified arguments, that retry should generally re-enter the approval gate rather than bypass it — otherwise a human's rejection of one specific action can be silently circumvented by the agent's own retry logic proposing a slightly different version of the same risky action.

## Common mistakes

- **Uniform gating on every tool call**, producing approval fatigue that erodes the actual safety benefit as reviewers stop reading and start rubber-stamping.
- **Gating the plan but not the arguments** — approving "send the refund" without seeing the amount or recipient, then having the agent fill in specifics the human never reviewed.
- **No re-approval on retry**, letting an agent route around a human's rejection by generating a marginally different call that never re-enters the gate.
- **Treating post-hoc audit logs as equivalent to a pre-execution gate** for irreversible actions — a log entry after money has already moved is forensics, not prevention.
