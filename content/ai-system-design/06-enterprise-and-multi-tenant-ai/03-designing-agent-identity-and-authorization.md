---
title: "Designing Agent Identity and Authorization"
short_title: "Agent Identity and Authorization"
tags: ["agents", "identity", "authorization", "oauth", "least-privilege", "design"]
sources:
  - "RFC 6749 (OAuth 2.0) and RFC 8693 (OAuth 2.0 Token Exchange)"
  - "NIST SP 800-207, Zero Trust Architecture"
  - "Simon Willison, writing on the 'lethal trifecta' for AI agents (2025)"
  - "MCP specification 2026-07-28 release notes, blog.modelcontextprotocol.io/posts/2026-07-28 (fetched Oct 2026)"
  - "A2A Protocol documentation, a2a-protocol.org (v1.0, fetched Oct 2026)"
  - "OWASP Top 10 for Agentic Applications 2026 (ASI01 to ASI10), via secondary summaries"
banner:
  layout: line
  nodes:
    - [model, "agent"]
    - [lock, "token"]
    - [shield, "policy"]
    - [server, "tool"]
---

## The problem

An agent acts on behalf of a person: it reads their mail, queries company systems and files tickets. Whose authority is it using, how much, and for how long? If the agent runs with a broad service account, one prompt injection can reach everything that account can. If it runs with the user's full credentials, it can do anything the user can, including things the user never intended. **Agent identity and authorization** defines who the agent is, what it may do on whose behalf, and how that is enforced outside the model.

## Step 1: Requirements

- **Delegation:** the agent acts with the **authority of a specific user**, never more.
- **Least privilege:** only the permissions the current task needs, for as short a time as possible.
- **Accountability:** every action attributable to a user, an agent and a task.
- **Control:** high-impact actions need approval; revocation takes effect immediately.
- **Interoperability:** work with existing identity providers and resource APIs.
- **Scale (example):** 50,000 users, 2,000 agent definitions, 100 million tool calls a day.

## Step 2: Principals and their relationships

Model three distinct principals:

- **User:** the human whose data and permissions are being used.
- **Agent:** a software identity (a registered application) with its own metadata, owner, risk tier and allowed tools.
- **Session or task:** a specific run, with a purpose and a time limit.

An action is authorised only if **all three** permit it: the user has the right, the agent is allowed to use that tool, and the task's scope includes it. This three-way check prevents both over-trusting the agent and over-trusting the user's broad rights.

## Step 3: Delegated tokens

Use standard delegation mechanisms rather than inventing one.

- **OAuth with token exchange:** the user authenticates and consents; the platform issues the agent a **short-lived, narrowly scoped access token** that records both the subject (the user) and the actor (the agent). Resource servers see "agent X acting for user Y with scope Z".
- **Scopes per tool,** such as `calendar.read` rather than `calendar.*`; separate read and write.
- **Short lifetimes** (minutes), refreshed only while the task runs; no long-lived keys inside prompts or agent memory.
- **Audience restriction:** a token for one resource cannot be replayed at another.

The model never holds credentials. A tool-execution layer attaches the right token when it calls the API.

## Step 4: Policy enforcement

Enforce authorization **at the tool boundary and at the resource**, not in the prompt.

- A **policy decision point** evaluates rules: user permissions, agent allow-list, task scope, resource sensitivity, time and context. Express them as code or a policy language.
- The **tool gateway** calls it before executing, and the resource API independently checks the token again (defence in depth).
- **Contextual rules:** an agent that has read untrusted content in this session may lose the ability to send data externally for the rest of the task; this breaks the exfiltration path of the "lethal trifecta" (private data, untrusted content, external communication).
- **Data-level controls:** row and column permissions apply to the agent exactly as to the user.

## Step 5: Approvals and step-up

Classify actions by impact. Reads of low-sensitivity data run freely. Writes, external sends, spending and deletions require **just-in-time consent**: the user sees what will happen, with exact parameters, and approves; the approval is bound to that specific action and expires. For high-risk operations require **step-up authentication** (a fresh credential check). Record each approval with the evidence the user saw.

## Step 6: Multi-agent and delegation chains

When an agent calls another agent, authority must **narrow, never widen**. Pass a derived token whose scope is a subset of the caller's, with a chain of custody listing every hop. Reject requests where the downstream scope exceeds the upstream. Limit delegation depth, and make the originating user visible in audit logs through the whole chain.

## Step 7: Lifecycle, revocation and audit

- **Registration and review:** agents are registered with an owner, purpose, tools and risk tier before they get credentials.
- **Revocation:** disabling an agent or a user's consent invalidates tokens quickly (short TTLs plus a revocation list for emergencies).
- **Rotation and secret hygiene** for the agent's own client credentials, stored in a vault.
- **Audit:** log (user, agent, task, tool, parameters summary, decision, approver) in tamper-evident storage; alert on unusual patterns such as a sudden spike in reads or access to unusual resources.
- **Periodic access review** of which agents hold which scopes, removing unused ones.

## A worked example

**Scenario:** a user asks an assistant to "find last quarter's invoices from Acme and email a summary to my finance lead".

1. The platform issues the assistant a task token for the user with scopes `mail.read` (filtered to the finance mailbox label) and `files.read`; no send scope yet.
2. The agent searches mail and files; the tool gateway checks each call against the policy and the user's own permissions. It reads an external PDF containing hidden instructions, and the session is flagged as having consumed untrusted content.
3. The agent drafts the summary and requests to send email. Because the session is tainted and sending is high impact, policy requires approval.
4. The user sees the recipient, subject and body, approves, and a one-time `mail.send` token bound to this exact message is issued.
5. The email goes out; the audit log records user, agent, task, the approved message hash and the approval time. The hidden instruction to forward data elsewhere had no tool and no scope to act on.

## Enterprise practice (verified October 2026)

**Basics.** An agent needs its own identity, a delegated user token with narrow scope, and a policy check outside the model (steps above). That is the baseline every enterprise review asks for.

**What the protocols now give you (live-checked).**

- **MCP 2026-07-28 spec.** The protocol core is **stateless**: no `initialize` handshake and no `Mcp-Session-Id`, so MCP servers sit behind ordinary round-robin load balancers. HTTP requests carry `Mcp-Method` and `Mcp-Name` headers so gateways and WAFs can route, meter and authorise without parsing JSON bodies. Authorization is hardened: **RFC 9207 issuer validation** before code redemption, client credentials bound to the issuing authorization server, and a formal shift from Dynamic Client Registration toward **Client ID Metadata Documents (CIMD)**. **Enterprise Managed Authorization (EMA)** is a formal extension, which lets the corporate identity provider, not each user clicking "allow", decide which agents may reach which tools. Roots, Sampling and Logging are deprecated with a twelve-month minimum support window, and legacy HTTP+SSE is deprecated.
- **A2A v1.0** (Linux Foundation, March 2026) uses **signed Agent Cards** (JWS with JCS canonicalisation) so one agent can verify another's domain and declared capabilities, and adds multi-tenancy. Use MCP for agent-to-tool, A2A for agent-to-agent.
- **OWASP Top 10 for Agentic Applications (Dec 2025)** names *Identity and Privilege Abuse* (ASI03), *Tool Misuse* (ASI02), *Insecure Inter-Agent Communication* (ASI07) and *Rogue Agents* (ASI10). Map your controls to these in the threat model.

**Enterprise pattern.** Register every agent in the IdP as a workload identity; issue short-lived tokens through token exchange (RFC 8693) carrying both the user (`sub`) and the agent (`act`); enforce at the MCP gateway using the new routing headers; require step-up approval for write tools; log each tool call with agent id, user id and policy decision. Because MCP is now stateless, authorisation must be checked **per request**, never remembered per session.

*Verify before building:* the 2026-07-28 revision is recent; check which version your MCP SDK and gateway implement.

## Common mistakes

- **A shared service account with broad access** for all agent actions.
- **Credentials or long-lived keys placed in the prompt** or agent memory.
- **Authorisation checks inside the model's instructions** instead of at the tool boundary.
- **Delegation chains that widen scope**, or lose track of the originating user.
- **Approvals that are generic** ("allow email") rather than bound to a specific action.
