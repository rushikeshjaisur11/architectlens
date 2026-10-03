---
title: "Golden Datasets and Regression Testing for Prompts"
short_title: "Golden Datasets"
tags: ["evaluation", "regression-testing", "prompting", "observability"]
sources:
  - "OpenAI Evals framework documentation (github.com/openai/evals)"
  - "promptfoo documentation (promptfoo.dev)"
  - "Anthropic Prompt Engineering: evaluating outputs (docs.anthropic.com)"
banner:
  layout: line
  nodes:
    - [doc, "golden set"]
    - [model, "prompt v2"]
    - [shield, "regression"]
    - [server, "CI gate"]
predict:
  question: "A prompt tweak raises overall golden-set accuracy from 89% to 91%, but the out-of-scope category, a small slice of traffic, fails far more often. What does the lesson's CI practice imply?"
  options: ["Merge it, since the blended score went up", "Block or inspect it, because gating is on category-level regressions", "Merge it and re-run the set only after a provider model update", "Delete the out-of-scope examples so the set stays representative"]
  answer: 1
  why: "The lesson says to gate on category-level regressions, not a single blended number, which can hide a drop in a hard slice."
check:
  - q: "Why tag golden examples by category and difficulty rather than keeping one flat list of cases?"
    options: ["Aggregates can hide a regression on the hard 10% of traffic, while category tags show which slice degraded", "Category tags let exact-match graders replace every LLM judge in the pipeline", "Flat lists cannot be put into version control, but tagged lists can", "Tags reduce the dataset to under 100 examples, which is the required maximum"]
    answer: 0
    why: "A flat list of easy cases hides regressions on hard traffic; tags make the regression report show which category degraded."
  - q: "Why re-run the full golden set when the model provider updates, even if your prompt did not change?"
    options: ["Prompts are re-tokenized on each provider update, so they must be rewritten", "A silent model version bump behind the same endpoint can shift behavior on the exact same prompt", "Provider updates automatically delete cached baselines, forcing a fresh run", "The golden set expires after a fixed number of days and must be regenerated"]
    answer: 1
    why: "The lesson notes an API endpoint can change model versions silently, shifting behavior without any change on your side."
  - q: "Why check the golden set into version control next to the prompts it tests?"
    options: ["It prevents anyone from adding new production failures to the set later", "Git history is what computes the pass/fail delta, so no baseline is needed", "Prompt and test set move together, so old runs stay reproducible and comparisons have a fixed baseline", "Version control makes the set statistically significant at only 100 examples"]
    answer: 2
    why: "Versioning keeps changes and tests in sync and gives a fixed comparison point, so regressions are shown in a diff instead of argued about."
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
