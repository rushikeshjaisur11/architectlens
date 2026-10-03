---
title: "Designing a Customer Support Agent"
short_title: "Customer Support Agent"
tags: ["agents", "support", "tool-use", "escalation", "design"]
sources:
  - "Anthropic, 'Building effective agents' (engineering guidance on workflows versus agents)"
  - "Public product documentation on AI customer-service assistants and human handoff"
  - "Yao et al., 'ReAct: Synergizing Reasoning and Acting in Language Models' (2022)"
---

## The problem

A company wants an assistant that resolves common support requests (order status, returns, password resets, plan changes) without a human, and **hands off cleanly** when it cannot. The value is deflection and speed. The risk is a confident wrong action: refunding the wrong order, leaking another customer's data, or trapping a frustrated customer in a loop.

## Step 1: Requirements

- **Functional:** chat across web and app, identify the customer, answer policy questions, perform actions through backend tools, escalate to a person with full context.
- **Quality:** correct actions, accurate policy answers, a tone consistent with the brand.
- **Safety:** actions are authorized for the authenticated customer only; money-moving actions have limits and approvals.
- **Metrics:** resolution rate without a human, handoff rate, customer satisfaction, cost per conversation, and **wrong-action rate**, the number that must stay near zero.
- **Scale (example):** 30,000 conversations per day, peak 400 concurrent.

## Step 2: Start with a workflow, add agency where needed

Most support requests follow known paths. Design the system as a **router plus specialised flows** rather than one free-roaming agent:

1. **Intent classification** sends the message to a flow: order status, return, billing, general question, or "unknown".
2. Each flow is a **constrained agent**: a short prompt, a small set of tools, and explicit steps.
3. "Unknown" and sensitive intents go straight to a human.

Narrow tool sets and short flows are easier to test, cheaper, and far less likely to misbehave than a single general agent with twenty tools.

## Step 3: Tools and authorization

Tools wrap existing backend APIs: `get_order`, `check_return_eligibility`, `create_return_label`, `issue_refund`, `update_address`. Rules:

- **Identity is injected by the platform, never chosen by the model.** The model passes an order id; the tool checks the order belongs to the authenticated customer. The model cannot supply a customer id.
- **Read tools are free; write tools are gated.** Refunds under a threshold run automatically, above it they queue for human approval.
- **Validate arguments** against schemas and business rules before executing, and return structured errors the model can act on.
- **Idempotency keys** on writes so a retry cannot refund twice.

## Step 4: Knowledge for policy questions

Use retrieval over the help center and policy documents, with citations in the reply. Keep **policy versions** and effective dates so the answer matches the customer's situation (an order placed before a policy change). When retrieval is weak the agent says it is unsure and offers a human, rather than improvising a policy.

## Step 5: Conversation state and memory

Keep a structured **case state**: customer id, current intent, entities collected (order id, reason), actions taken and their results. Rebuild the prompt from this state plus the recent messages instead of resending the full transcript. It reduces cost, avoids drift, and gives the human agent a clean summary on handoff.

## Step 6: Escalation design

Handoff is a first-class feature, not a failure path. Trigger it on: explicit request for a person, repeated failure, negative sentiment, high-value or high-risk situations, tool errors, and low confidence. The handoff includes a **summary, the actions taken, and the customer's goal**, so they never repeat themselves. Measure handoff quality, not only rate.

## Step 7: Guardrails

- **Input:** detect prompt injection, abuse and attempts to extract other users' data.
- **Output:** check for policy violations, forbidden promises (refunds the policy does not allow), and leaked internal notes.
- **Hard limits:** maximum tool calls per conversation, maximum refund amount, rate limits per customer.

## Step 8: Evaluation and rollout

Replay historical conversations against the agent offline and compare to what human agents did; grade with rubrics and sampled human review. Roll out in stages: shadow mode (agent drafts, humans send), then low-risk intents, then more, using canary traffic and a kill switch. Review wrong actions weekly and add each as a regression test.

## A worked example

**Scenario:** a customer writes "I want to return the blender I bought last week, it's broken."

1. The classifier routes to the **return flow**; the customer is authenticated.
2. The agent calls `get_orders` (platform supplies the customer id) and finds one blender order, delivered 6 days ago.
3. It calls `check_return_eligibility`: eligible, 30-day window, defective items return free.
4. The agent confirms the item, asks for a photo (policy requires it for defects), then calls `create_return_label` with an idempotency key.
5. It replies with the label and refund timeline, citing the return policy. The case state records the actions.
6. Had the order been 45 days old, the agent would have explained the policy and offered a human for an exception request.

## Common mistakes

- **One powerful agent with every tool**, instead of narrow flows.
- **Letting the model supply identifiers** that the platform should inject.
- **No escalation path**, trapping customers in loops.
- **Counting deflection as success** without measuring wrong actions and satisfaction.
- **Replaying the whole transcript** each turn instead of structured state.
