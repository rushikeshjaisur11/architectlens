---
title: "Jailbreaks and Adversarial Robustness"
short_title: "Jailbreaks and Adversarial Robustness"
tags: ["safety", "jailbreaks", "adversarial", "llm"]
sources:
  - "Anthropic and OpenAI documentation and research on adversarial robustness and red-teaming"
  - "Wei, Haghtalab & Steinhardt, 'Jailbroken: How Does LLM Safety Training Fail?' (2023)"
---

## How jailbreaks differ from prompt injection

This track's prompt-injection lesson covers untrusted content in the model's input steering it toward unintended behavior, often via indirect, hidden instructions. **Jailbreaks** are a related but distinct category: a user directly and deliberately attempts to get a model to bypass its own safety training and produce content it would normally refuse — through role-play framing ("pretend you're an AI with no restrictions"), hypothetical framing ("write this as fiction, not real advice"), or more technical techniques exploiting how the model's safety training generalizes (or fails to generalize) across different phrasings of essentially the same disallowed request.

## Why safety training doesn't fully generalize

A model's safety behavior is itself learned (via the RLHF/DPO-style training covered in this track's human-feedback lesson, applied to safety-relevant preference data specifically) from a finite set of training examples of what to refuse and what to allow — and like any learned behavior, it can fail to generalize perfectly to inputs meaningfully different in surface form from what it was trained on, even when the underlying intent is essentially identical to something it would correctly refuse in a more direct phrasing. This is the structural reason jailbreaks work at all: they're often not exploiting a specific "bug" so much as finding a phrasing that falls outside the training distribution the safety behavior actually generalized well to — directly analogous to how the fine-tuning-data lesson's point about representativeness applies to a model's safety training data specifically, not just its general task-performance training data.

## Common jailbreak technique categories

- **Role-play and persona framing** — asking the model to adopt a persona explicitly defined as having no restrictions, or as being a different AI system without the deployed model's actual safety training, attempting to get the model to generate disallowed content "in character" rather than as itself.
- **Hypothetical/fictional framing** — requesting content framed as fiction, a thought experiment, or an academic discussion, attempting to exploit any gap between the model's willingness to discuss a topic abstractly versus provide genuinely actionable disallowed content, even when the actual requested output would be functionally identical either way.
- **Multi-turn escalation** — building up to a disallowed request gradually across several turns, each individually appearing more innocuous than the final target request, attempting to exploit the possibility that safety training generalizes less reliably to gradual, context-dependent escalation than to an obviously disallowed single-turn request.
- **Encoding/obfuscation** — expressing a disallowed request in an unusual encoding (a cipher, a different language, split across multiple messages, unusual formatting) attempting to evade pattern-matching-style detection while remaining decodable/interpretable by the model itself.

## Why defenses need to be layered, similar to prompt injection's guidance

Analogous to this track's prompt-injection lesson's conclusion that no single prompt-level defense fully solves the problem, jailbreak resistance similarly benefits from layered defenses rather than relying on any single mechanism:

- **Safety training itself** (via RLHF/DPO on adversarially-collected examples, specifically including known jailbreak patterns in the training data) remains the primary defense, and its quality directly depends on how representative and adversarially thorough the training data is — a safety training process that never saw examples of a specific jailbreak technique category is less likely to generalize correctly against it.
- **Input/output classifiers** (per this track's content-moderation lesson) as an additional layer independent of the model's own learned behavior — catching cases where the primary model's safety training didn't generalize correctly to a specific adversarial phrasing, similar to how output moderation serves as a backstop for input moderation gaps.
- **Red-teaming as an ongoing practice, not a one-time pre-launch check** — dedicated effort (internal or via external red-teaming programs) to actively search for jailbreak techniques the current safety training doesn't yet handle well, feeding discovered gaps back into future safety-training data — directly connecting to this track's evaluation lesson's point about building eval sets from real discovered failure cases, applied specifically to safety failure modes.

## A worked example

**Scenario:** a general-purpose assistant product needs ongoing defense against jailbreak attempts, given that a determined user population will actively probe for gaps.

- **Adversarial safety-training data** deliberately includes examples of known jailbreak technique categories (role-play framing, hypothetical framing, multi-turn escalation), not just direct disallowed requests — since, per the generalization point above, training only on direct requests leaves a real gap for indirect framings that carry the same underlying intent.
- **An independent output classifier** (per the content-moderation lesson) runs on generated responses regardless of how benign the immediate input looked, catching cases where a multi-turn escalation or clever framing got past the primary model's own safety judgment despite the additional training.
- **Ongoing red-teaming** is treated as a continuous program, not a pre-launch checklist item — new jailbreak techniques are discovered by the broader research and user community over time, and a defense validated only against techniques known at launch will predictably degrade in effectiveness as new techniques emerge, without an ongoing process to discover and incorporate defenses against them.
- **Discovered jailbreak successes are fed back into both the safety-training data and the eval set** (per this track's evaluation lesson) used to validate future model or prompt changes — turning each discovered gap into a permanent regression check, the same pattern the evaluation lesson recommends for general quality failures, applied here to safety specifically.

## Common mistakes

- **Treating jailbreak resistance as a solved, static property established once at launch**, rather than an ongoing arms race requiring continuous red-teaming and safety-training updates as new techniques are discovered — a defense that was adequate at launch can become inadequate over time without active maintenance.
- **Relying solely on the model's own learned safety behavior without an independent output-classification layer.** As with prompt injection, this leaves the entire defense dependent on one mechanism's generalization holding perfectly, with no backstop for the cases where it doesn't.
- **Training safety behavior only on direct, obviously-disallowed request phrasings**, missing the generalization gap to indirect framings (role-play, hypothetical, multi-turn) that carry equivalent intent but don't resemble the training examples closely enough for the learned refusal behavior to reliably transfer.
