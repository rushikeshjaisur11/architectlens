---
title: "Multi-Agent Security Boundaries and Tool Permission Scoping"
short_title: "Multi-Agent Security Boundaries"
tags: ["multi-agent", "security", "guardrails", "tool-use"]
sources:
  - "OWASP Top 10 for LLM Applications (2025) — Excessive Agency"
  - "Anthropic: Building Effective Agents / Model Context Protocol documentation"
  - "Simon Willison — 'The lethal trifecta' (prompt injection + private data + external communication)"
---

## Why multi-agent systems widen the attack surface

A single LLM call with tools has one trust boundary: the prompt in, the tool calls out. A multi-agent system — orchestrator delegating to sub-agents, sub-agents calling tools, tools returning data that feeds back into other agents — multiplies that boundary across every agent-to-agent and agent-to-tool hop. **Excessive agency**, OWASP's term for an agent granted more capability than its task requires, compounds badly here: a sub-agent compromised by a prompt injection in retrieved content can invoke *any* tool it has access to, not just the one relevant to its assigned task, and its output becomes untrusted input to whichever agent consumes it next.

## The lethal trifecta

Simon Willison's framing is the sharpest lens for this: an agent is dangerous when it simultaneously has (1) access to private/sensitive data, (2) exposure to untrusted external content (web pages, documents, emails it processes), and (3) a channel to communicate externally (send email, post to an API, write to a shared file). Any one or two of these are usually fine. All three together mean a prompt injection hidden in a document the agent reads can exfiltrate private data through the agent's own legitimate tool access — no vulnerability in the tools themselves is required, only their combination. Multi-agent architectures routinely assemble all three across different agents without anyone auditing the composite risk, because each individual agent looks safe in isolation.

## Tool permission scoping

The core mitigation is applying **least privilege** per agent, not per system:

- **Per-agent tool allowlists.** A research sub-agent that only needs read access to a search API shouldn't inherit the orchestrator's full tool set (file write, code execution, email send). Scope tools at agent instantiation, not centrally for the whole pipeline.
- **Capability tokens over ambient authority.** Instead of an agent holding a long-lived API key it can use for anything the key permits, issue short-lived, narrowly-scoped credentials per task (a token valid for one read operation on one resource ID) — this is the agentic analog of the principle behind OAuth scopes and is what the Model Context Protocol's resource/tool permission model is moving toward.
- **Human-in-the-loop gates on irreversible or high-blast-radius actions.** Sending an email, deleting data, making a payment, or executing arbitrary code should require explicit confirmation even if the agent's reasoning looks correct — the risk isn't that the agent reasons badly, it's that its reasoning can be manipulated by injected content it has no way to distinguish from legitimate instructions.
- **Data isolation between agents.** An agent that processes untrusted external content (a webpage, a user-uploaded file) shouldn't have its raw output piped directly into an agent with write access to sensitive systems without a validation or sanitization step in between — this is the multi-agent version of not trusting client input in a web app.

## Boundary enforcement patterns

- **Orchestrator-worker isolation**: the orchestrator holds broader context and decision authority; workers get narrowly scoped tool access and their outputs are treated as data, not instructions, when they flow back to the orchestrator.
- **Sandboxing code execution.** Any agent that generates and runs code needs to run in an isolated environment (container, VM, gVisor-style sandbox) with no network access or filesystem access beyond what the task needs — code-executing agents are a favorite target because arbitrary code execution subsumes almost every other guardrail.
- **Message provenance tracking.** In multi-agent systems, tag messages with their source (user, tool output, another agent) so a downstream agent can apply different trust levels — treating a sub-agent's summary of a scraped webpage with the same trust as a direct user instruction is how injected content becomes an executed instruction.

## Common mistakes

- **Granting the orchestrator's full tool set to every sub-agent "for flexibility."** This collapses the whole point of scoping and means one compromised sub-agent has the same blast radius as a compromised orchestrator.
- **Trusting inter-agent messages as if they were user input that already passed guardrails.** Guardrails applied at the system's entry point don't automatically apply to content an agent generates internally and passes to another agent.
- **No audit trail across agent boundaries.** When an incident happens, teams that logged only the final output can't reconstruct which agent, tool call, or injected content caused the bad action — logging needs to span the full agent-to-agent, agent-to-tool call graph.
