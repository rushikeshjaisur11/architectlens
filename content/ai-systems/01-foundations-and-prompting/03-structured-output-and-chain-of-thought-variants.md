---
title: "Structured Output Techniques and Chain-of-Thought Variants"
short_title: "Structured Output and CoT Variants"
tags: ["prompting", "structured-output", "chain-of-thought", "llm"]
sources:
  - "OpenAI documentation on structured outputs and JSON mode"
  - "Wei et al., 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models' (2022); Wang et al., 'Self-Consistency Improves Chain of Thought Reasoning' (2022)"
---

## Why "return JSON" alone isn't reliable enough for production

This track's prompting fundamentals lesson noted that showing an exact expected schema beats describing a format in words. Production systems needing machine-parseable output generally need more than a well-written prompt, though — even a well-instructed model can occasionally produce malformed JSON, an unexpected field, or a value outside an expected enum, and a downstream parser that expects strictly valid structured output has no tolerance for those occasional deviations.

## Constrained decoding: guaranteeing valid structure at generation time

**Constrained decoding** (also called structured output mode, offered by most major providers) doesn't just instruct the model to produce a given format — it constrains the actual token generation process so that only tokens consistent with a specified schema (a JSON schema, a regular expression, a formal grammar) can be selected at each generation step. This is a fundamentally stronger guarantee than prompting alone: instead of hoping the model follows instructions correctly, the format is structurally enforced by the generation mechanism itself, making malformed output essentially impossible rather than just less likely.

The tradeoff: constrained decoding requires the format to be fully specified as a formal schema ahead of time (a JSON schema definition, for instance), which is straightforward for well-defined structured extraction tasks but doesn't help for tasks where the desired structure is more free-form or context-dependent — and it doesn't replace the need for semantic validation of the schema-valid output's actual *content* being correct, only its structural conformity.

## Chain-of-thought variants beyond the basic version

This track's prompting fundamentals lesson introduced basic chain-of-thought ("think step by step"). Several refinements improve on it for specific situations:

- **Self-consistency** — instead of generating one chain-of-thought reasoning path and taking its answer, generate several independent reasoning paths (via repeated sampling at a non-zero temperature) for the same question, then take the majority answer across them. This trades additional compute (multiple generations instead of one) for improved accuracy on tasks with a single correct answer, since errors in any individual reasoning path are less likely to be replicated identically across multiple independent attempts, making the majority vote more robust than any single path.
- **Tree of thoughts** — rather than committing to one linear reasoning chain, the model explores multiple reasoning branches at each step, evaluating and pruning less promising branches before continuing — useful for problems where an early wrong turn in a purely linear chain-of-thought would be hard to recover from, at meaningfully higher cost given the branching exploration involved.
- **Least-to-most prompting** — decomposing a complex problem into an explicit sequence of simpler sub-problems, solved in order, where each sub-problem's solution feeds into solving the next — useful for problems with a genuinely compositional structure (where breaking the problem into ordered sub-steps is natural), as opposed to problems that are better solved with a single connected reasoning chain.

## When the added cost of these techniques is actually worth it

Every technique beyond basic prompting (self-consistency's multiple samples, tree of thoughts' branching exploration) trades additional latency and cost for improved accuracy or reliability — directly connecting to this track's cost-and-latency lesson's point about matching technique to actual need rather than defaulting to the most sophisticated option. Self-consistency is worth its multiplied cost specifically for tasks where getting the answer right matters enough to justify several times the generation cost (a high-stakes classification decision, a math problem with a clear correct answer) — applying it to a low-stakes, low-error-cost task multiplies cost for marginal benefit. Constrained decoding, by contrast, is close to free to apply once available, since it doesn't require extra generation passes — the real cost is the upfront schema-definition work, not ongoing inference cost, making it a much easier default to reach for.

## A worked example

**Scenario:** an application needs to (1) extract structured order data (customer name, items, total) from unstructured email text, and (2) answer a multi-step math word problem correctly for a tutoring product.

- **Order extraction → constrained decoding.** The target structure is fully known and fixed ahead of time (a JSON schema for order data), so constraining generation to that schema directly eliminates the malformed-output failure mode this track's production-reliability lesson covers as a "soft failure" — no need for a corrective retry loop for structural errors, since they're structurally impossible under constrained decoding.
- **Math tutoring → self-consistency, layered on basic chain-of-thought.** Getting the final numeric answer right matters directly to the product's value (a tutoring tool giving a wrong answer undermines trust badly), and math problems often have a clear, checkable correct answer, making them a good fit for self-consistency's majority-vote approach — the added cost of a few extra generations per problem is judged worth it given how directly answer correctness matters to this specific product.
- **Why tree-of-thoughts wasn't used here**: the math problems in question are within basic chain-of-thought's range of reliable performance once combined with self-consistency: the added branching-exploration cost of tree-of-thoughts wasn't judged necessary for this specific problem difficulty level, illustrating that even among these techniques, matching complexity to actual need (not defaulting to the most sophisticated available option) is the right default reasoning.

## Common mistakes

- **Relying on prompted JSON formatting alone for a system where malformed output causes a hard failure downstream**, when constrained decoding is available and would eliminate that entire failure category essentially for free.
- **Applying self-consistency or tree-of-thoughts by default to every task, regardless of whether the task's error cost justifies the added generation cost.** These techniques exist for a specific tradeoff (accuracy for cost) that's worth making deliberately, task by task, not applied uniformly as a "better" default regardless of need.
- **Assuming constrained decoding validates content correctness, not just structural validity.** A schema-valid JSON object can still contain a factually wrong or semantically nonsensical value in a correctly-typed field — structural constraint and content correctness are different guarantees, and conflating them misses the need for separate content validation (per this track's evaluation lesson) even when structure is guaranteed.
