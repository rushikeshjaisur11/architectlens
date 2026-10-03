---
title: "Choosing Between Prompting, RAG, Fine-Tuning and Agents"
short_title: "Prompting, RAG, Fine-Tuning or Agents"
tags: ["decision-framework", "rag", "fine-tuning", "agents", "architecture", "design"]
sources:
  - "Anthropic, 'Building effective agents' (workflows versus agents, 2024)"
  - "Public guidance from model providers on when to prompt, retrieve or fine-tune"
  - "Lewis et al., 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks' (2020)"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched Oct 2026)"
  - "Practitioner guides on fine-tuning versus RAG, 2026 (secondary: bigdataboutique.com, gauraw.com)"
  - "Anthropic, Contextual Retrieval (fetched Oct 2026)"
---

## The decision that shapes everything

Almost every AI product starts with the same fork: how do we get the behaviour we need from a model? The options differ in cost, risk, latency and how they fail. Choosing well is mostly about diagnosing **what is actually missing**: instructions, knowledge, skill, or autonomy.

## Diagnose the gap

| What is missing? | Typical symptom | Usually fixed by |
|---|---|---|
| Clear instructions or format | Wrong tone, structure, missing fields | Better prompting, examples, structured output |
| Knowledge the model lacks | Invents facts about your products and policies | Retrieval (RAG) |
| Fresh or changing information | Answers are out of date | Retrieval or tool calls to live systems |
| A consistent style or narrow skill | Prompts get long; quality varies; cost too high | Fine-tuning |
| Ability to act and adapt | Multi-step tasks, unknown path in advance | Workflow or agent with tools |

Fine-tuning is the most over-chosen option: it teaches **behaviour**, not facts, and facts baked into weights go stale and cannot be cited or permission-checked.

## Option 1: Prompting

Cheapest and fastest to iterate: instructions, few-shot examples, output schemas, role framing. Strengths: no infrastructure, instant changes, easy to evaluate. Limits: context budget, inconsistent adherence on subtle rules, no private knowledge. Always start here; many "needs fine-tuning" problems dissolve with good prompts, examples and structured output.

## Option 2: Retrieval-augmented generation

Retrieve relevant documents at query time and include them in the prompt. Strengths: private and current knowledge, citations, access control at retrieval time, easy updates (change the document, not the model). Costs: an ingestion pipeline, an index, retrieval quality to manage, longer prompts. Failure mode: the answer is only as good as retrieval, so evaluation must separate retrieval from generation. Choose RAG when the answer depends on **specific documents or data**.

## Option 3: Workflows (chained calls and tools)

A fixed sequence or graph of steps: classify, retrieve, extract, validate, then respond, with code between steps. Strengths: predictable, testable, cheaper than free-roaming agents, easy to add guardrails. Choose workflows when the **steps are known in advance** even if each step needs a model. Most enterprise "agents" are better built as workflows.

## Option 4: Agents

The model decides which tool to call and when, looping until done. Strengths: handles open-ended tasks and unknown paths. Costs: more model calls, higher latency and cost, harder evaluation, larger attack surface, more ways to go wrong. Choose agents when the **path genuinely cannot be specified in advance**, and constrain them: narrow tools, step and cost limits, human approval for impactful actions.

## Option 5: Fine-tuning

Train the model further on your examples. Choose it when:

- You need a **consistent style, format or domain behaviour** that prompting does not reliably achieve.
- You want to **shorten prompts** (cost and latency) by moving instructions and examples into weights at high volume.
- A **smaller model** fine-tuned on a narrow task can replace a larger one.
- You have enough **clean, labelled examples** and an evaluation set to prove improvement.

It does not fix missing or changing knowledge, and it requires a pipeline for data, training, evaluation and redeployment. Parameter-efficient methods (LoRA) lower the cost and allow per-task adapters.

## Combining them

Real systems stack techniques: a fine-tuned small model for classification and routing, RAG for knowledge, a prompted large model for synthesis, a workflow for orchestration, and an agent for the one open-ended step. Add complexity only where evaluation shows a gap.

## A decision procedure

1. Can ordinary code or search do it? Use it.
2. Write a strong prompt with examples and a schema; measure on an evaluation set.
3. If failures come from missing knowledge, add retrieval or live tool calls.
4. If the steps are knowable, formalise them as a workflow with validation.
5. If the path is open-ended, introduce an agent with tight limits.
6. If quality, cost or latency still miss targets and you have data, consider fine-tuning or distillation.
7. At each step compare cost, quality and risk against the previous rung.

## A worked example

**Scenario:** an insurer wants to summarise claims and extract fields from adjuster notes.

1. A prompted model with a JSON schema extracts fields from 200 sample notes: 82 percent field accuracy, with errors on abbreviations specific to the company.
2. Adding a glossary and five examples to the prompt raises it to 89 percent but doubles the prompt size and cost.
3. Retrieval is not needed: all information is inside each note. An agent is not needed: the steps are fixed.
4. With 8,000 labelled notes available, a small fine-tuned model reaches 94 percent, at a quarter of the cost per note and half the latency.
5. The team keeps the prompted large model as a fallback for rare note types, routes by confidence, and re-evaluates quarterly.

## Enterprise practice (verified October 2026)

**Basics.** Start with the simplest approach that could work: a good prompt; add retrieval for knowledge; fine-tune for behaviour; add agents when the task needs multi-step actions (steps above).

**What changed (live-checked, October 2026).**

- **Prompting has more headroom.** Context windows of 1M tokens are billed at the standard rate on Claude 4.6 and later, and cached input costs about 10% of normal, so a long, stable instruction-plus-examples prompt is cheap to reuse. Try prompt plus caching before building anything else.
- **RAG remains the default for fresh or private knowledge**, and its quality levers are known (hybrid retrieval, reranking, contextual chunks: failure rates down 35 to 67% in Anthropic's study).
- **Fine-tuning is for form, not facts** (secondary guidance): consistent structure, tone, tool-calling reliability and cost reduction on a narrow high-volume task, usually with at least a few hundred good examples and a real evaluation set. Managed fine-tuning exists on the major clouds.
- **Agents add risk and cost**: more tokens per task, more failure modes, and the OWASP agentic risks (goal hijack, tool misuse, privilege abuse). Use them only when a fixed workflow cannot do the job.

**Enterprise pattern.** Decide with a small bake-off on your evaluation set: baseline prompt, prompt plus RAG, fine-tuned small model, and (if needed) an agent. Compare quality, p95 latency and cost per 1,000 tasks; record the decision and the numbers; re-run it when a new model generation lands, because the winner changes.

## Common mistakes

- **Fine-tuning to add knowledge**, which then goes stale and cannot be cited.
- **Building agents for fixed processes.**
- **Skipping prompt and schema work** before heavier techniques.
- **Choosing without an evaluation set**, so each option cannot be compared.
- **Adding every technique at once**, making failures impossible to diagnose.
