---
title: "Designing a Content Moderation System with LLMs"
short_title: "Content Moderation with LLMs"
tags: ["moderation", "trust-and-safety", "classification", "human-review", "policy", "design"]
sources:
  - "Public trust and safety transparency reports and moderation policy documentation"
  - "Inan et al., 'Llama Guard: LLM-based Input-Output Safeguard for Human-AI Conversations' (2023)"
  - "Regulation (EU) 2022/2065 (Digital Services Act) overview of notice-and-action and transparency duties"
---

## The problem

A platform with user-generated text, images and video must remove harmful content (hate, harassment, self-harm, scams, illegal material) quickly and consistently, at huge volume, without silencing legitimate speech. Rules are written in natural language and change; context and culture matter; adversaries adapt. LLMs can apply written policies with nuance, but they are slow, expensive and fallible, so the system around them (routing, thresholds, human review, appeals) is the real design.

## Step 1: Requirements

- **Coverage:** text, images, audio and video, in many languages, in real time for live content and in bulk for backlogs.
- **Accuracy:** high recall on severe harms, controlled false positives on borderline speech.
- **Speed:** block clearly illegal content in seconds; routine decisions within minutes.
- **Consistency and explainability:** decisions map to specific policy rules, with reasons users can appeal.
- **Human oversight:** reviewers for hard cases, wellbeing protections, quality audits.
- **Compliance:** auditability, transparency reporting, regional rules.
- **Scale (example):** 300 million items a day.

## Step 2: A tiered funnel

Volume and cost force a funnel where each stage handles what it can cheaply:

1. **Hash and rule matching:** known illegal material by perceptual hash databases, banned strings and spam signatures. Microseconds, near-zero cost, precise for known items.
2. **Fast classifiers:** small multi-label models for toxicity, nudity, violence, spam. Milliseconds, run on everything.
3. **LLM or multimodal policy judge:** reads the item and context with the written policy and returns a structured verdict with the rule cited. Used for uncertain classifier scores, new categories, context-dependent cases, and appeals; seconds, costlier.
4. **Human review:** for low-confidence, high-severity, high-reach or contested items.
5. **Appeals and audits:** a separate path with fresh eyes.

Thresholds at each stage determine automatic action, escalation or allow.

## Step 3: The LLM judge

Give the model the **policy text** (versioned), definitions and examples, plus the item and relevant **context** (the thread, the reported reason, the author's history, the audience, language). Ask for structured output: category, severity, rule id, confidence, rationale and the spans that triggered it. Techniques that help: few-shot examples per rule, chain-of-thought rationale kept for audit (not shown to users), calibration of confidence against human labels, and **self-consistency** or a second model for borderline items. Treat user content as untrusted: it may contain instructions aimed at the judge, so delimit it and never let it change the policy.

## Step 4: Context and nuance

Meaning depends on context: a slur quoted in a news story, reclaimed language within a community, satire, or a threat that is clearly joking. Provide thread context, community norms and the reported reason, and design categories so context changes the action (label, reduce reach, age-gate) rather than only remove or keep. Support **graduated actions**: warnings, down-ranking, limiting sharing, temporary suspension, removal.

## Step 5: Human review loop

Reviewers handle the hardest and most sensitive items. Build tooling for them: policy lookup, side-by-side model rationale, queues prioritised by severity and reach, and **blind quality audits** where a second reviewer re-labels a sample. Protect wellbeing: blur or grayscale graphic media by default, limit exposure, rotate tasks, provide support. Human decisions flow back as labels for the next classifier and for evaluating the judge.

## Step 6: Measuring and tuning

Define **precision and recall per policy category and severity**, with severe categories weighted toward recall. Sample both removed and kept content for human re-labelling to estimate false positives and false negatives (the latter requires random sampling of allowed content, not only reports). Track time to action, prevalence of violating content viewed, appeal overturn rates (a high rate signals over-enforcement) and fairness across languages and groups. Evaluate every prompt, policy or model change on a golden set that includes adversarial and edge cases before rollout, and canary it.

## Step 7: Adversaries and drift

Bad actors evade with misspellings, symbols, code words, images of text and coordinated campaigns. Respond with adversarial testing, rapid rule updates, similarity search for variants of removed content, network-level signals (accounts and clusters) beyond single items, and a fast path to add new patterns. Policies evolve, so version them and measure decisions against the policy version in force.

## A worked example

**Scenario:** a user posts a comment "people like you should disappear" under a political thread.

1. Hash and rule stages find no match. The fast classifier scores harassment at 0.55, in the uncertain zone.
2. The LLM judge receives the comment, the parent post (a heated debate), the author's history (no prior violations) and the harassment policy. It returns: category harassment, severity low-to-medium, rule 3.2, confidence 0.62, rationale "ambiguous rhetorical phrasing without a specific target or explicit threat".
3. Policy says ambiguous low-severity items get a **warning and reduced reach**, not removal; the comment is down-ranked and the author is shown a policy reminder.
4. The author appeals; a human reviewer, seeing the full thread, restores full visibility. That case is added to the golden set as a boundary example, and the judge prompt gains a clarifying example.
5. The weekly metrics show the appeal overturn rate for this rule dropping from 18 to 11 percent after the update.

## Common mistakes

- **Sending every item to the LLM**, ignoring cost and latency.
- **Judging content without context**, mislabelling quotes and satire.
- **Measuring only reported content**, never sampling what was missed.
- **No appeals path or reasons**, eroding trust.
- **Treating the policy as static**, with no versioning or evaluation set.
