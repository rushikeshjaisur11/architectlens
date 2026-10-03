---
title: "A Framework for Designing AI Systems"
short_title: "AI System Design Framework"
tags: ["framework", "methodology", "requirements", "architecture", "interview", "design"]
sources:
  - "Huyen, Designing Machine Learning Systems (O'Reilly, 2022)"
  - "Sculley et al., 'Hidden Technical Debt in Machine Learning Systems' (NIPS 2015)"
  - "Google Cloud and AWS Well-Architected guidance for machine learning and generative AI workloads"
  - "EU AI Omnibus (Reg. (EU) 2026/1744) summary, Gibson Dunn (fetched Oct 2026)"
  - "MCP specification 2026-07-28 release notes, blog.modelcontextprotocol.io/posts/2026-07-28 (fetched Oct 2026)"
  - "OWASP Top 10 for LLM Applications 2025 (genai.owasp.org, fetched Oct 2026)"
banner:
  layout: line
  nodes:
    - [user, "use case"]
    - [doc, "requirements"]
    - [model, "design"]
    - [shield, "evaluate"]
---

## Why AI systems need their own method

Classic system design asks how to store, move and serve data reliably. An AI system adds a component whose output is **probabilistic, expensive and sometimes wrong**, and whose behaviour depends on data, prompts and model versions as much as on code. Teams that apply only classic design ship demos that fall apart on real traffic, real data and real risk. The framework below is a repeatable order of questions that works for interviews and for real enterprise designs.

## The framework in nine steps

1. **Problem and value:** who is the user, what job is being done, what is the measurable outcome, and is an AI approach justified at all?
2. **Requirements:** functional, quality, latency, cost, scale, security, compliance, and what a failure costs.
3. **Data:** what data exists, who owns it, how fresh, how sensitive, how it is permissioned.
4. **Approach selection:** rules, classical ML, prompting, retrieval, fine-tuning, agents, or a combination.
5. **Architecture:** components, data flows, synchronous and asynchronous paths.
6. **Evaluation:** how quality is defined, measured offline and online, and gated.
7. **Safety, security and governance:** threats, controls, approvals, audit.
8. **Operations:** observability, reliability, cost control, rollout, incident response.
9. **Evolution:** feedback loops, model and data drift, how the system improves over time.

Each step produces a decision that constrains the next. Skipping to architecture before requirements and evaluation is the most common design failure.

## Step 1 and 2: Problem and requirements

Start with the outcome, not the technology: "reduce average handling time for support agents by 20 percent without lowering satisfaction". Separate requirement types:

- **Functional:** what the system does for the user.
- **Quality:** accuracy, groundedness, tone, completeness, with a target and a way to measure it.
- **Performance:** time to first token, total latency, throughput.
- **Cost:** a ceiling per interaction or per user per month.
- **Risk:** the worst realistic failure and who it affects; this sets the required level of human oversight.
- **Constraints:** data residency, regulated industry, on-premises needs, existing identity and platform standards.

Ask whether an AI-free baseline (search, rules, templates) would meet the need; it is a useful benchmark and sometimes the right answer.

## Step 3: Data first

AI systems are limited by data quality, access and permissions. Inventory sources, formats, update frequency, ownership, sensitivity and legal basis. Decide how data reaches the system (connectors, change feeds), how access control is preserved, how quality is monitored, and what happens when sources conflict or disappear. Most "model problems" turn out to be data problems.

## Step 4: Selecting the approach

Climb a **ladder of complexity**, stopping at the first rung that meets the requirements:

1. Deterministic rules or existing software.
2. A prompted general model.
3. Prompting plus retrieval (RAG) for private or changing knowledge.
4. Structured workflows chaining model calls and tools.
5. Agents for open-ended tasks with dynamic tool use.
6. Fine-tuning for style, format, latency or cost at scale.
7. Training or heavily adapting your own models only when nothing else suffices.

Each rung adds cost, risk and operational burden. A later lesson develops this decision in detail.

## Step 5: Architecture

Draw the system as layers:

- **Experience layer:** UI, API, streaming, feedback capture.
- **Orchestration layer:** prompts, workflows, agents, tool calls, memory.
- **Knowledge layer:** ingestion, indexes, caches, permissions.
- **Model layer:** providers, self-hosted models, routing, fallbacks.
- **Platform layer:** gateway, guardrails, evaluation, observability, cost control, identity.
- **Data and infrastructure layer:** storage, queues, compute, networking.

Decide which paths are **synchronous** (interactive) and which **asynchronous** (ingestion, batch, long tasks), where state lives, and where trust boundaries sit.

## Step 6 to 9: Evaluate, protect, operate, evolve

- **Evaluation** is designed up front: a golden dataset, metrics per layer (retrieval, generation, end-to-end), an automatic gate in CI, online monitoring.
- **Safety and security:** treat model inputs as untrusted, restrict tool permissions, redact sensitive data, define human approval for impactful actions, and keep audit trails.
- **Operations:** tracing and quality dashboards, SLOs, rate limits and budgets, canary releases, fallbacks, runbooks.
- **Evolution:** capture feedback, turn failures into tests, schedule re-evaluation, plan model and prompt migrations.

## A worked example

**Scenario:** "Design an assistant that answers HR policy questions for 40,000 employees."

1. **Value and requirements:** reduce HR ticket volume by 30 percent; answers must cite the policy; wrong answers about leave or pay are high risk; latency under five seconds; cost under 5 cents per question; employee data must not leak between employees.
2. **Data:** 800 policy documents in a wiki and a document store, updated weekly, country-specific variants, access rules by country and role.
3. **Approach:** RAG over policies with permission filters; no fine-tuning; no agent (read-only); a human escalation path for personal cases.
4. **Architecture:** ingestion with change feeds, hybrid index with country and role metadata, retrieval with the employee's attributes as filters, a mid-size model with citations, a gateway for quotas and logging.
5. **Evaluation:** 300 real questions with expected sources; gate on retrieval hit rate and faithfulness; sample live answers weekly with HR reviewers.
6. **Safety and operations:** no personal data in prompts beyond the employee's own record, abstain when retrieval is weak, canary rollout by department, spend alerts, a feedback button feeding the regression set.

## Enterprise practice (verified October 2026)

**Basics.** Walk the framework in order: requirements, data, model approach, architecture, evaluation, safety, cost, operations (steps above). Do it for a small feature first.

**What an enterprise adds to every step (live-checked, October 2026).**

- **Requirements include regulatory ones.** The EU AI Act timeline moved in 2026: Annex III high-risk duties now apply from **2 December 2027**, embedded-product duties from **2 August 2028**, while Article 50 transparency duties started **2 August 2026**. Record the risk tier of the feature at requirements time.
- **Architecture includes the standards your tools will speak.** MCP's 2026-07-28 revision made the protocol stateless with header-based routing, so agent-tool traffic can pass through ordinary gateways and load balancers; A2A v1.0 covers agent-to-agent calls.
- **Threat model uses the current lists:** the OWASP LLM Top 10 (2025) and the Agentic Applications Top 10 (December 2025).
- **Evaluation is a gate, not a report:** a golden set, slice metrics and a regression suite that runs on every prompt, model or retrieval change.
- **Operations covers vendor change:** models are deprecated and repriced on the provider's schedule, so keep an exit path (gateway abstraction, per-model prompts and evaluations).

**Enterprise pattern.** Capture the outputs as a one-page design record per feature: risk tier, data classes, model and fallback, evaluation gate, SLOs, cost envelope, owner and review date. Review it again when the model, prompt or tools change.

## Common mistakes

- **Starting with the model** instead of the outcome and the data.
- **Defining quality after building**, so improvement cannot be measured.
- **Jumping to agents** when a fixed workflow would be safer and cheaper.
- **Treating safety, cost and operations as phase two.**
- **No plan for how the system learns** from its own failures.
