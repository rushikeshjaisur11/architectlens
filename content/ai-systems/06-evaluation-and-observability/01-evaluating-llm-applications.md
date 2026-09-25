---
title: "Evaluating LLM Applications: Beyond Vibes-Based Testing"
short_title: "Evaluating LLM Applications"
tags: ["evaluation", "evals", "observability", "llm"]
sources:
  - "Anthropic and OpenAI documentation on evaluation methodology"
  - "Hamel Husain, writing on LLM evaluation practices for production systems"
---

## Why LLM applications need a different testing approach

Traditional software testing checks for exact output equality — a function given input X should return exactly Y. LLM outputs are non-deterministic and often have many valid phrasings of a correct answer, so exact-match testing usually fails on correct outputs and passes on subtly wrong ones just as easily. This is why teams shipping LLM features without a real evaluation process tend to rely on "vibes" — a developer skims a handful of outputs, they look fine, and it ships — which catches obvious breakage but misses the gradual quality regressions and edge-case failures that actually matter once the feature is in front of real users.

## The three layers of LLM evaluation

- **Unit-level evals** — narrow, automated checks on specific behaviors: does the output parse as valid JSON, does it contain a required field, does it avoid a specific banned phrase, is it under a length limit. Fast, cheap, deterministic — the LLM equivalent of unit tests, and just as useful for catching regressions in CI before a prompt or model change ships.
- **Model-graded evals (LLM-as-judge)** — using a separate LLM call to score an output against a rubric (accuracy, helpfulness, tone, adherence to instructions) that's too subjective or open-ended for a simple string check. Powerful for scaling evaluation beyond what unit checks can capture, but introduces its own reliability concerns — an LLM judge can be inconsistent, biased toward certain response styles (e.g., preferring longer answers regardless of quality), or simply wrong, so judge prompts need their own validation against human-labeled examples before being trusted.
- **Human evaluation** — domain experts or end users rating actual outputs. The most reliable signal, but slow and expensive to run continuously — typically used to validate that automated evals (unit and model-graded) actually correlate with real quality, and as a periodic check rather than a per-change gate.

## Building an eval set that means something

A generic benchmark rarely tells you whether *your* system works for *your* users. The eval set that matters is built from real or realistic examples of what the system actually needs to handle — including the failure cases that showed up in production. A practical way to build one:

1. **Start from real user queries** (logged, with PII handled appropriately) rather than hypothetical examples a developer imagines — actual usage surfaces edge cases nobody would think to write by hand.
2. **Include known failure cases explicitly**, so a regression that broke something once has a permanent test guarding against it breaking the same way again — this is the LLM-application equivalent of a regression test.
3. **Label expected behavior, not just expected text.** For open-ended tasks, a rubric ("does the answer cite the source document," "does it refuse when it should") is often more durable than trying to pin down one exact correct phrasing.
4. **Grow the set over time** as new failure modes are discovered in production — an eval set is a living asset, not a one-time deliverable.

## Observability: what to log beyond the final output

Debugging why an LLM application produced a bad output requires more than the final answer — it requires the full context that produced it:

- **The exact prompt sent**, including any retrieved context (for RAG systems) or tool results (for agents) — not just the user-visible input, since the actual model behavior depends on everything in the context window.
- **Model and parameters used** (model version, temperature, any other sampling settings) — a quality regression traced to a silent model version change is a common, otherwise hard-to-diagnose failure.
- **Intermediate steps for multi-step systems** — retrieved chunks in RAG, each tool call and result in an agent loop (see this track's agents lesson) — since the final output alone doesn't reveal whether the failure was in retrieval, reasoning, or generation.
- **User feedback signals**, where available (thumbs up/down, regeneration requests, session abandonment) — these are a cheap, continuous, if noisy, source of real-world quality signal that complements offline evals.

## A worked example

**Scenario:** a RAG-based support chatbot's answer quality seems to have degraded after a recent change, but "seems to have" isn't actionable — the team needs to find out what actually changed and by how much.

- **Unit evals** catch anything mechanical first: are responses still returning in the expected format, still citing sources, still within length limits. If these pass, the regression is likely in answer *quality*, not structure.
- **The eval set** (built from real past support queries, with known-good expected answers or rubrics) gets re-run against both the old and new system versions, and a model-graded eval scores each response for accuracy against the source material.
- **The comparison isolates the regression**: if unit evals pass but model-graded accuracy drops specifically on questions requiring information from a particular document type, the team checks retrieval logs for those specific queries — this is where having retrieved-chunk logging (not just final answers) pays off, since it separates "retrieval got worse" from "generation got worse" instead of leaving the team guessing.
- **A human review of a sample of the regressed cases** confirms the model-graded eval's finding before the fix ships, since a judge model's score alone isn't fully trusted without periodic human-labeled validation.

## Common mistakes

- **Shipping changes based on a developer eyeballing a handful of outputs.** This catches only the most obvious breakage and provides no way to detect a real but subtle regression, or to prove a fix actually worked.
- **Trusting an LLM-as-judge score without ever validating it against human judgment.** A judge prompt that's miscalibrated (too lenient, biased toward verbosity, or simply misunderstanding the rubric) produces evaluation numbers that look rigorous but don't actually track real quality.
- **Only logging the final output, not the full trace.** This makes multi-step systems (RAG, agents) nearly impossible to debug precisely, since a bad final answer could stem from any step in the pipeline, and without intermediate logging there's no way to tell which one.
