---
title: "Designing Agent Identity and Authorization"
short_title: "Agent Identity and Authorization"
tags: ["agents", "identity", "authorization", "oauth", "least-privilege", "design"]
sources:
  - "RFC 6749 (OAuth 2.0) and RFC 8693 (OAuth 2.0 Token Exchange)"
  - "NIST SP 800-207, Zero Trust Architecture"
  - "Simon Willison, writing on the 'lethal trifecta' for AI agents (2025)"
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

## Common mistakes

- **A shared service account with broad access** for all agent actions.
- **Credentials or long-lived keys placed in the prompt** or agent memory.
- **Authorisation checks inside the model's instructions** instead of at the tool boundary.
- **Delegation chains that widen scope**, or lose track of the originating user.
- **Approvals that are generic** ("allow email") rather than bound to a specific action.
