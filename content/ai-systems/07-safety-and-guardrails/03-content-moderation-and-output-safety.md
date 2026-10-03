---
title: "Content Moderation and Output Safety for LLM Applications"
short_title: "Content Moderation and Output Safety"
tags: ["safety", "content-moderation", "guardrails", "llm"]
sources:
  - "OpenAI Moderation API documentation"
  - "Anthropic documentation on usage policies and safety classifiers"
---

## Why output safety is a separate concern from prompt injection

This track's prompt injection lesson covers defending against malicious instructions hidden in input the model processes. **Output safety** is a related but distinct concern: even with a perfectly well-behaved, uninjected model, an application still needs to guard against the model generating content that's harmful, policy-violating, or simply inappropriate for the context — a customer support bot shouldn't discuss unrelated harmful topics even if a user innocently steers the conversation there, and a children's education product needs stricter output bounds than a general-purpose research tool. These are product and policy requirements, not just adversarial-attack defenses, and they need their own deliberate design.

## Where moderation can happen in the pipeline

- **Input moderation** — checking user input before it ever reaches the model, catching clearly disallowed requests early (before spending a model call on them) and reducing the surface area the model itself needs to handle.
- **Output moderation** — checking the model's generated response before it's shown to the user, catching cases where the model produced problematic content despite acceptable input — this matters because input moderation alone can't catch every case; a seemingly benign input can still occasionally lead to an inappropriate output, and the reverse is also true (an input that looks concerning can lead to a perfectly appropriate refusal or redirection).
- **Both together** is the more robust default for any production application with real safety requirements — relying on only one direction leaves a gap the other would have caught, and the two checks are cheap relative to the cost of a genuinely bad output reaching a user.

## Moderation approaches, from cheap to expensive

- **Rule-based / keyword filtering** — fast, cheap, deterministic, but brittle: easy to both over-trigger (blocking legitimate content that happens to contain a flagged word in an innocuous context) and under-trigger (missing harmful content that doesn't use any specific flagged keyword). Useful as a fast first-pass filter for clearly disallowed categories, not as a sole line of defense for anything requiring nuanced judgment.
- **Dedicated moderation classifiers** (like OpenAI's Moderation API, or a purpose-built classification model) — trained specifically to detect categories of harmful content (violence, self-harm, sexual content, hate speech, and similar categories) with better nuance than keyword matching, and typically fast and cheap enough to run on every request without materially affecting latency or cost.
- **LLM-as-judge for policy-specific checks** — a separate model call evaluating whether a specific output violates a product's own custom policy (which may be more specific and context-dependent than the general categories a standard moderation classifier covers) — more flexible for nuanced, product-specific rules, but slower and costlier than a dedicated classifier, and carries the same judge-reliability caveats covered in this track's evaluation lesson.

Most production systems layer these: a fast classifier catches the bulk of clearly problematic content cheaply, with an LLM-as-judge reserved for more nuanced, product-specific policy checks where a general-purpose classifier's categories don't map cleanly onto the actual requirement.

## Refusals need to be handled deliberately, not just blocked

When a model appropriately declines to answer (a request outside its intended scope, or a genuinely disallowed request), how that refusal is presented matters for product quality, not just safety — an abrupt, unexplained refusal is a worse user experience than one that clearly (if briefly) indicates why the request can't be fulfilled and, where appropriate, redirects toward what the assistant *can* help with. This is a prompt-design and product-design concern layered on top of the underlying safety mechanism — the safety check determines *whether* to refuse; separate design work determines *how* that refusal is communicated.

## A worked example

**Scenario:** a general-purpose writing assistant needs output moderation appropriate for a broad audience, including the possibility of being used by minors, without being so restrictive it blocks legitimate creative writing that touches on serious themes (conflict, loss, difficult emotions in fiction).

- **Input moderation** uses a standard moderation classifier to catch clearly disallowed requests early (explicit instructions to generate content in clearly prohibited categories), before spending a model call on them.
- **Output moderation** runs the same classifier on generated content as a backstop, catching the rarer case where a seemingly benign creative-writing request leads to genuinely inappropriate content in the output.
- **A deliberately calibrated threshold, not a blanket ban on serious themes**: since fiction legitimately explores difficult subjects (conflict, loss, moral complexity) without being harmful, the moderation threshold is tuned to catch clearly disallowed content categories specifically, rather than any mention of a serious theme — an overly blunt filter here would block a large amount of legitimate creative writing for no actual safety benefit, which is exactly the over-triggering failure mode keyword-based approaches are especially prone to.
- **Refusals, when they do happen**, are designed to briefly explain the boundary and suggest an alternative direction, rather than a bare "I can't help with that" — treated as a product-quality concern distinct from the underlying safety mechanism that triggered the refusal.

## Common mistakes

- **Relying solely on input moderation, assuming a well-behaved model won't produce problematic output from acceptable input.** As covered above, this misses a real category of failures where the model itself is the source of an inappropriate output despite unremarkable input — output moderation exists precisely to catch this gap.
- **Using an overly blunt keyword filter for a use case requiring nuance** (creative writing, educational content about sensitive topics), producing a high rate of false positives that block legitimate content and degrade the product for no corresponding safety benefit.
- **Treating a refusal as purely a safety mechanism with no product-design consideration.** An unexplained or overly abrupt refusal, even when the underlying safety judgment is correct, creates a worse user experience than necessary — how a refusal is communicated is a separate, deliberate design decision from whether to refuse.
