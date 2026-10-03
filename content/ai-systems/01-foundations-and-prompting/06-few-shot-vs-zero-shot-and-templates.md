---
title: "Few-Shot vs. Zero-Shot Prompting and Template Design"
short_title: "Few-Shot vs. Zero-Shot"
tags: ["prompting", "few-shot", "templates", "foundations"]
sources:
  - "OpenAI Prompt Engineering Guide (platform docs)"
  - "Anthropic Prompt Engineering documentation (docs.anthropic.com)"
  - "Brown et al., 'Language Models are Few-Shot Learners' (GPT-3 paper)"
---

## Zero-shot: instructions alone

Zero-shot prompting asks a model to perform a task from instructions only, with no worked examples. It's the cheapest prompt to write and the cheapest to run — fewer tokens, less latency — and modern instruction-tuned models handle a surprising range of tasks this way: classification, extraction, rewriting, summarization.

Zero-shot works best when:

- The task is common and well-represented in the model's training distribution (sentiment classification, translation, standard summarization).
- The output format is simple enough to describe in a sentence.
- You're prototyping and want a fast baseline before investing in examples.

It breaks down when the task has a house style, a non-obvious output schema, or edge cases that are hard to describe but easy to demonstrate.

## Few-shot: showing instead of telling

Few-shot prompting includes 1–5+ input/output examples directly in the prompt before the actual task. This works because the model conditions its output on the pattern established by the examples, not just the instruction text — it's pattern completion, not rule-following.

Few-shot earns its token cost when:

- **The output format is unusual or strict.** Showing three examples of the exact JSON shape you want is far more reliable than describing the schema in prose.
- **The task has house-specific conventions** — a particular tone, a domain-specific way of phrasing things, a classification taxonomy that doesn't map cleanly to common-sense categories.
- **Edge-case handling matters.** An example that demonstrates how to handle an empty field, a malformed input, or an ambiguous case teaches the model what a thousand words of instruction can't.

## Example selection and ordering

Few-shot quality depends heavily on which examples you pick and how you order them:

- **Diversity over redundancy.** Examples that all look alike teach a narrow pattern; a few examples spanning the input distribution (short/long, typical/edge-case) generalize better.
- **Recency bias.** Models tend to weight the last example more heavily than the first. If your examples aren't uniform in difficulty, put the most representative or important one last.
- **Label balance matters for classification.** If 4 of 5 examples are labeled "positive," the model will lean toward predicting "positive" regardless of the actual input — this is a well-documented majority-label bias in few-shot classification.
- **Consistent formatting across examples.** Every example should use identical delimiters and field ordering; inconsistency in the examples themselves becomes noise the model has to filter out.

## Template design for production prompts

A prompt template is the reusable skeleton — instructions, delimiters, and placeholders — that gets filled with per-request variables. Designing one for production means treating it like an interface, not a one-off string:

- **Separate the constant parts from the variable parts explicitly**, usually with a templating engine (Jinja, f-strings, or a dedicated prompt-management library) rather than string concatenation, so injection of untrusted variable content can't accidentally break out of its delimited section.
- **Version templates like code.** A prompt change is a behavior change; track it in source control and be able to diff and roll back, especially once you have evals running against it.
- **Keep few-shot examples in the template, not hardcoded inline**, so they can be swapped, A/B tested, or trimmed independently of the instruction text.
- **Budget tokens deliberately.** Few-shot examples consume context window on every single call — for high-volume production paths, weigh the reliability gain against the added cost and latency versus fine-tuning or a shorter zero-shot prompt with better instructions.

## Common mistakes

- **Adding examples to fix a problem instructions could solve.** If the model is missing an explicit constraint, add the constraint first — examples are for demonstrating patterns, not patching vague instructions.
- **Reusing the same few-shot examples verbatim across very different task instances**, so the model overfits to the specific examples' surface features rather than the underlying pattern.
- **Ignoring label imbalance in classification few-shot prompts**, silently biasing predictions toward whichever class appears more often in the examples.
