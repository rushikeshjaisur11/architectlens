---
title: "Prompting Fundamentals: How LLMs Actually Read Your Instructions"
short_title: "Prompting Fundamentals"
tags: ["prompting", "llm", "foundations"]
sources:
  - "OpenAI Prompt Engineering Guide (platform docs)"
  - "Anthropic Prompt Engineering documentation (docs.anthropic.com)"
---

## The core mental model

A large language model doesn't "understand" a prompt the way a person reads a request. It's predicting the next token given everything that came before it — the system prompt, the conversation history, and the current message, all concatenated into one sequence. Every design decision in prompting follows from that one fact: you're steering a next-token predictor, not briefing an assistant.

This means:

- **Order matters.** Instructions near the end of a long prompt are generally weighted more heavily than instructions buried in the middle — a phenomenon sometimes called "lost in the middle." Put critical constraints close to the actual task.
- **Ambiguity gets resolved statistically, not logically.** If your prompt is vague, the model doesn't ask itself "what did the user *really* mean?" — it produces whatever continuation looks statistically plausible given its training data. Specificity isn't a nicety; it's how you constrain the output space.
- **Examples do more work than adjectives.** Telling a model to be "concise" is a much weaker signal than showing it two examples of concise output. Few-shot examples directly shape the token distribution; descriptive instructions are indirect.

## System prompt vs. user message

Most production LLM APIs separate a **system prompt** (persistent instructions, set once) from **user messages** (the actual turn-by-turn conversation). The practical difference:

- The system prompt is the right place for role definition, output format constraints, and behavior that should hold across the whole conversation.
- The user message is the right place for the specific task or question — content that changes turn to turn.

A common mistake is cramming everything into the system prompt, including content that's really per-request context (like a document to summarize). That content should usually go in the user message, since it changes every call and mixing it into the "constant" system prompt makes caching and prompt versioning harder.

## Structuring a prompt for reliability

A prompt that needs to produce consistent, machine-parseable output benefits from explicit structure over prose:

- **Delimiters** (XML tags, markdown headers, or triple-backtick blocks) around distinct sections — instructions, examples, input data — reduce the model's chance of confusing what's an instruction versus what's content to process.
- **Explicit output format** stated as a schema or example, not just described in words. "Return JSON" is weaker than showing the exact JSON shape you expect, including field names.
- **Negative constraints stated concretely.** "Don't be verbose" is vague; "respond in one sentence" or "use no more than 3 bullet points" gives the model something concrete to satisfy.

## Chain-of-thought: when it helps and when it doesn't

Asking a model to "think step by step" before answering (chain-of-thought prompting) reliably improves performance on tasks requiring multi-step reasoning — arithmetic, logic puzzles, multi-hop questions. It works because it gives the model more tokens to "compute" in before committing to an answer, and each intermediate token is conditioned on the ones before it, effectively letting the model build up a scratchpad.

It's not free, though:

- It costs latency and tokens — every reasoning step is generated before the final answer.
- For simple classification or extraction tasks, it can *hurt* — the model may talk itself into an inconsistent answer by overthinking something that had an obvious response.
- If you don't need to show the reasoning to the user, it's often worth prompting for reasoning in a scratch section, then a final answer in a separate, clearly delimited section — so downstream code can parse just the final answer.

## Common mistakes

- **Treating the model as if it has memory beyond the context window.** Every call is stateless unless you explicitly include prior turns; "the model should remember what I said" is a category error if that context wasn't actually sent.
- **Vague success criteria.** "Make this better" gives the model no signal about what "better" means; specify the dimension (shorter, more formal, fewer technical terms).
- **Testing on one example.** A prompt that works on your first try can fail on edge cases — empty input, very long input, adversarial input. Prompt behavior should be evaluated across a representative set, not a single anecdote.
