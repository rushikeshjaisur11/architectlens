---
title: "System Prompts, User Prompts, and Instruction Hierarchy"
short_title: "Instruction Hierarchy"
tags: ["prompting", "system-prompt", "foundations"]
sources:
  - "OpenAI Model Spec / instruction hierarchy documentation"
  - "Anthropic Prompt Engineering documentation (docs.anthropic.com)"
banner:
  layout: line
  nodes:
    - [doc, "system prompt"]
    - [user, "user turn"]
    - [model, "LLM"]
    - [shield, "role"]
predict:
  question: "A developer puts the rule 'never reveal pricing' only in a user-turn template. What risk does the lesson identify?"
  options: ["The rule is billed at a higher rate than system-level rules", "That content sits at the same trust level as arbitrary user input", "The model cannot read rules placed inside any user message"]
  answer: 1
  why: "Hard constraints in a user-turn template are fragile because they sit at the same trust level as user input."
check:
  - q: "A team treats the instruction hierarchy as a full defense against prompt injection. What is wrong with that?"
    options: ["Hierarchy is a trained tendency, so untrusted input still needs guardrails", "Hierarchy only applies to the tool role, not to user messages", "Hierarchy is enforced by the API, but only for developer roles"]
    answer: 0
    why: "The hierarchy reduces but does not eliminate override risk; it is a trained tendency, not a hard guarantee."
  - q: "Why is 'You are a helpful assistant' a weak persona?"
    options: ["Personas must always name a job title to be accepted by the API", "Persona text is ignored whenever a system prompt is also set", "Nearly the whole training distribution matches it, so little is narrowed"]
    answer: 2
    why: "A vague role adds almost no conditioning signal because almost everything matches 'helpful assistant'."
  - q: "Why keep a document to summarize out of the system prompt?"
    options: ["The system prompt cannot hold more than a few hundred tokens", "Per-request data there breaks caching and blurs separate versioning", "Documents in the system prompt are treated as lower-trust content"]
    answer: 1
    why: "Stuffing per-request documents into the system prompt breaks prompt caching and conflates content that should be versioned independently."
---

## Three layers, not one

Most production LLM APIs expose at least three distinct message roles, and each carries different weight and trust level:

- **System prompt** — set once by the application developer, persists across the whole conversation. Defines role, output constraints, tone, and behavioral guardrails.
- **User messages** — the turn-by-turn input from the end user (or an upstream system acting on their behalf). Treated as lower-trust than the system prompt.
- **Assistant messages** — the model's own prior turns, included so it has conversational memory (models are stateless between calls; history is re-sent every time).

Some APIs add a **developer** role distinct from system, and tool-calling adds a **tool** role for function results. The core idea is the same regardless of exact naming: instructions closer to the "top" of this hierarchy should take precedence when they conflict with instructions further down.

## Why the hierarchy exists

Frontier model providers train models to treat system-level instructions as higher priority than user-level content specifically so that application behavior can't be trivially overridden by whatever the end user types. This is the mechanism behind "ignore previous instructions" resistance — a well-trained model should weight the system prompt's constraints over a user message that contradicts them, though this is a trained tendency, not a hard guarantee (see prompt injection).

Practical implication: **anything that must always hold — safety rules, output format, the persona — belongs in the system prompt, not the user message**, even if it's technically possible to put it there. Putting a hard constraint in a user-turn template is fragile because that content sits at the same trust level as arbitrary user input.

## Role conditioning: giving the model a persona

Assigning the model a role ("You are a senior backend engineer reviewing a pull request") does more than set tone — it activates a narrower slice of the model's training distribution, biasing vocabulary, assumed context, and even reasoning style toward what's associated with that persona in training data.

Effective role conditioning is specific, not decorative:

- **Vague:** "You are a helpful assistant." Adds almost no conditioning signal — nearly the entire training distribution matches "helpful assistant."
- **Specific:** "You are a database migration specialist reviewing schema changes for backward compatibility and lock contention risk." Narrows the model toward relevant vocabulary and concerns.

Role conditioning also sets implicit defaults for ambiguous requests — a "security reviewer" persona will flag things a "feature reviewer" persona would let pass, even given the identical input.

## What goes where

| Content | Correct location | Why |
|---|---|---|
| Persona, tone, output format | System prompt | Constant across the conversation |
| Safety/behavioral rules | System prompt | Should not be overridable by user input |
| The actual task or question | User message | Changes every turn |
| Per-request data (a document to summarize) | User message | Changes every call; keeping it out of the system prompt preserves prompt caching |
| Prior turns for context | Assistant/user message history | Models are stateless; this is how memory is simulated |

A common anti-pattern is stuffing per-request documents into the system prompt because "it's the important context." This breaks prompt caching (most providers cache the system prompt/prefix and charge less for cached tokens) and conflates two categories of content that should be independently versionable.

## Common mistakes

- **Treating the system prompt as the only place instructions can go**, then cramming per-turn variables into it, defeating prompt caching and making the template harder to version.
- **Assuming instruction hierarchy is bulletproof.** It reduces but does not eliminate the risk of user input overriding system behavior — this is why untrusted user content still needs guardrails, not just prompt placement (see prompt injection).
- **Weak, generic personas** that add token cost without adding conditioning signal — a persona only helps if it's specific enough to actually narrow the model's behavior.
