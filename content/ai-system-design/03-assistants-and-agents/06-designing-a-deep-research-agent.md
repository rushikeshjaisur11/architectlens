---
title: "Designing a Deep Research Agent"
short_title: "Deep Research Agent"
tags: ["research-agent", "planning", "multi-agent", "long-running", "design"]
sources:
  - "Anthropic, 'How we built our multi-agent research system' (engineering write-up)"
  - "Yao et al., 'Tree of Thoughts: Deliberate Problem Solving with Large Language Models' (2023)"
  - "Public documentation of long-running agent and workflow execution engines"
  - "DeepResearch Bench (Du et al., 2025) and DeepResearch Bench II (arXiv 2601.08536), plus 2026 leaderboard summaries (secondary)"
---

## The problem

Some questions need an hour of an analyst's time: compare vendors, survey the literature, assemble a market overview. A **deep research agent** takes a broad question, plans an investigation, searches and reads many sources, cross-checks them, and writes a structured, cited report. It runs for minutes, uses many model calls, and must stay on task and within budget.

## Step 1: Requirements

- **Output:** a report with sections, cited claims and explicit uncertainty, not a chat reply.
- **Autonomy with control:** the user can steer at checkpoints, see progress and stop it.
- **Reliability:** survive tool failures and long runtimes without losing work.
- **Cost and time bounds:** a budget in tokens and minutes; deterministic stopping.
- **Scale (example):** 2,000 concurrent research jobs, each 5 to 20 minutes.

## Step 2: Architecture

A common structure is a **lead agent plus parallel workers**:

1. **Clarify and plan:** the lead agent restates the goal, asks questions if the request is ambiguous, and writes a plan: sub-questions, source types, success criteria.
2. **Research workers:** each takes a sub-question, runs searches, reads pages and documents, extracts evidence, and returns **notes with citations**.
3. **Synthesis:** the lead merges notes, resolves conflicts, identifies gaps and may launch a second round.
4. **Writer and verifier:** a final pass drafts the report, then checks every claim against the notes and sources.

Parallel workers cut wall-clock time and keep each worker's context small and focused, at the cost of more total tokens.

## Step 3: Managing context

Long investigations overflow any context window. The design principle is **externalise memory**:

- A shared **research notebook** (structured store) holds the plan, sub-question status, extracted facts with source ids and open questions.
- Workers write findings to the notebook and return a short summary, not their whole trace.
- The lead reads the notebook, not the raw pages.
- Large documents are chunked and retrieved on demand rather than pasted whole.

This keeps every call's context bounded and makes the state recoverable.

## Step 4: Controlling the loop

Autonomous loops can wander or never end. Add explicit controls:

- **Budgets:** maximum searches, pages read, tokens and wall-clock time, enforced by the runtime, not the model.
- **Effort scaling:** simple questions get one worker, complex ones many; the lead sets effort from the query's difficulty.
- **Progress checks:** after each round, evaluate whether the sub-questions are answered with sufficient evidence; stop when the criteria are met or the budget runs out.
- **Loop detection:** repeated identical searches or no new evidence trigger a change of strategy or termination.
- **Human checkpoints:** show the plan for approval before spending heavily, and allow mid-run steering.

## Step 5: Source handling and quality

Prefer primary and authoritative sources, record the retrieval date, and note disagreement. Deduplicate similar pages, and require corroboration for key claims. Treat fetched content as untrusted data (prompt injection), and run workers with read-only tools: search and fetch only, no ability to send data anywhere.

## Step 6: Durable execution

A 15-minute job will meet failures: timeouts, rate limits, worker crashes. Run on a **durable workflow engine**: each step is a recorded, retryable activity; state persists after every step; a crashed run resumes from the last completed step instead of restarting. Make tool calls idempotent, and checkpoint the notebook. Provide progress events to the UI (current sub-question, sources read) through a stream.

## Step 7: Evaluation

Evaluating open-ended reports is hard. Combine:

- **Rubric-based grading** by a judge model plus human review: coverage of key points, accuracy, citation support, structure.
- **Claim-level checks:** sample claims and verify them against cited sources (faithfulness).
- **Task benchmarks** with known answers (find these ten facts) for regression testing.
- **Cost and time per report**, and the share of runs hitting budget limits.

## A worked example

**Scenario:** "Compare the leading open-source vector databases for a 500 million vector workload."

1. The lead agent proposes a plan: performance at scale, memory cost, filtering, operations, licensing. The user approves.
2. Five workers run in parallel, one per dimension, each searching documentation, benchmarks and engineering blogs and writing notes with citations to the notebook.
3. The lead notices that benchmark numbers conflict between two sources and launches a short follow-up worker to find the test configurations.
4. The writer drafts a comparison table and recommendations; the verifier removes one claim whose cited page did not actually support it.
5. The report arrives in eight minutes with 24 sources, a "what we could not verify" section, and a record of tokens and searches used.

## Enterprise practice (verified October 2026)

**Basics.** Plan sub-questions, search in parallel, read sources, synthesise a cited report, verify (steps above).

**How quality is measured now.** **DeepResearch Bench** uses 100 expert-written research tasks across 22 fields and scores reports on comprehensiveness, insight, instruction-following, readability and **citation accuracy**; a second version (DeepResearch Bench II, early 2026) diagnoses agents more finely, and **DRBench** targets enterprise-style research over internal and web sources. Secondary 2026 leaderboard summaries report top overall scores in the low 70s for frontier models, with insight scores tightly clustered and **citation accuracy the most volatile metric (reported from about 33% to 83%)**. BrowseComp measures hard multi-step web retrieval. The practical takeaway: the report may read well while a third of its citations do not support the claim.

**Enterprise pattern.** Make verification a pipeline stage, not a hope: after drafting, a verifier checks that each cited passage entails the claim and drops or flags unsupported sentences; store source snapshots (URL, retrieval time, hash) so a report can be audited later. Restrict sources by policy (licensed, internal, allow-listed domains), include internal knowledge only through permission-aware retrieval, cap cost per run with a budget the planner can see, run long jobs asynchronously with progress and resumability, and present confidence and unresolved questions honestly.

## Common mistakes

- **One long-running context** that grows until quality collapses.
- **Budgets enforced only by prompting** the model to be economical.
- **Losing all progress** on a mid-run failure because state lived in memory.
- **Reporting claims without checking** them against the cited sources.
- **Giving research workers write-capable tools.**
