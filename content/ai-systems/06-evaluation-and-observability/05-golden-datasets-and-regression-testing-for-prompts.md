---
title: "Golden Datasets and Regression Testing for Prompts"
short_title: "Golden Datasets"
tags: ["evaluation", "regression-testing", "prompting", "observability"]
sources:
  - "OpenAI Evals framework documentation (github.com/openai/evals)"
  - "promptfoo documentation (promptfoo.dev)"
  - "Anthropic Prompt Engineering: evaluating outputs (docs.anthropic.com)"
---

## Why prompts need regression tests

A prompt is code that happens to be written in English, and like code it regresses: a tweak meant to fix one failure mode silently breaks three others that were passing. Without a fixed test set, teams only discover this from user complaints days later. A **golden dataset** is the fixed set of inputs (and, where possible, expected outputs or acceptance criteria) that every prompt or model change gets run against before shipping — the LLM equivalent of a unit test suite.

## Building the dataset

- **Source from production, not imagination.** The most valuable golden examples are real user inputs that previously caused failures — hallucinations, refusals, format breaks — pulled from logs or support tickets. Synthetic edge cases (empty input, adversarial phrasing, extremely long context) fill gaps but shouldn't be the majority.
- **Stratify by difficulty and category.** A flat list of 50 "easy" examples hides regressions on the 10% of traffic that's actually hard. Tag each example with a category (e.g., multi-turn, ambiguous intent, out-of-scope) so a regression report can show *which* category degraded, not just an aggregate score.
- **Size**: 100-300 well-chosen examples usually gives a stable enough signal to catch regressions, versus thousands needed to move a statistically significant needle on subtle quality differences. Depth of labeling matters more than raw count.
- **Freeze the set, version it.** Golden sets should be checked into version control alongside the prompts they test, so a prompt change and its test set move together and old evaluation runs stay reproducible.

## Scoring strategies

Different example types need different graders:

- **Exact-match / regex / schema validation** for structured outputs (JSON extraction, classification labels, tool-call arguments) — cheap, deterministic, zero ambiguity.
- **LLM-as-judge with reference answers** for open-ended generation where exact match is meaningless but a rubric can check for required facts or forbidden content (see the companion note on LLM-as-judge design for calibration details).
- **Assertion-based checks** (promptfoo-style): "output must contain X," "output must not exceed N tokens," "output must not mention competitor names" — fast, auditable, and good for catching hard failures like a system prompt leak or a broken output format.

## Running regression tests in CI

The pattern mirrors software CI: every prompt or model-version change triggers a run of the full golden set, producing a pass/fail delta against the last known-good baseline. Key practices:

- **Gate merges on regression, not absolute score.** A prompt change that drops overall accuracy from 91% to 89% but fixes a critical category should still be inspectable — block on category-level regressions, not a single blended number.
- **Track per-example history, not just aggregate trend.** When example #47 flips from pass to fail, the diff between the two prompt versions on that specific input is the fastest way to understand why — faster than re-reading the whole prompt.
- **Re-run the full set on model provider updates too**, not just on your own prompt changes — a silent model version bump behind an API endpoint can shift behavior on the exact same prompt.

## Common mistakes

- **Letting the golden set go stale.** If it isn't refreshed with new production failures every few weeks, it stops representing current traffic and passes stop meaning anything.
- **Testing only happy-path examples**, so the set never catches the failure modes that actually reach users.
- **No baseline versioning**, so "did this get better or worse" has no fixed comparison point and regressions get argued about in Slack instead of shown in a diff.
