---
title: "Designing a Feedback and Data Flywheel"
short_title: "Feedback and Data Flywheel"
tags: ["feedback", "data-flywheel", "labeling", "evaluation", "design"]
sources:
  - "Ouyang et al., 'Training language models to follow instructions with human feedback' (2022), on preference data"
  - "Public engineering articles on collecting implicit feedback in recommender and assistant products"
  - "Sculley et al., 'Hidden Technical Debt in Machine Learning Systems' (NIPS 2015)"
  - "Provider data-use and retention policy summaries for API, enterprise and consumer tiers, 2026 (secondary: protecto.ai, anonyome.com, anarlog.so)"
  - "EDPB Opinion 28/2024 on AI models and personal data (via law-firm summaries)"
predict: {"question": "Thumbs-down rises after a launch. Triage clusters 900 negative traces and 140 share the topic 'new pricing tiers'. A 40-trace sample shows answers citing the old pricing page. What is the right first fix?", "options": ["Fine-tune the model on the 140 negative traces so it learns the new tiers", "Tighten the prompt so the model ignores prices that look outdated", "Re-index the updated pricing content and add a freshness boost to retrieval", "Add a guardrail that blocks every answer mentioning pricing"], "answer": 2, "why": "The labelled cause is a retrieval miss returning stale documents, so the fix belongs in retrieval, and the labelled cases then become a regression slice."}
check: [{"q": "Why mix a random sample of ordinary traffic into the labelling queue alongside failures?", "options": ["It is cheaper per item than triage, so it stretches the labelling budget further", "It measures the true quality rate and stops the team seeing only failures", "It replaces the regression set, since ordinary traffic already covers old failures"], "answer": 1, "why": "Reviewing only failures gives no baseline for how good the product really is; a random sample provides that rate."}, {"q": "Why are implicit signals such as copy or rephrase used as triage hints, not ground truth?", "options": ["They cannot be linked to a trace id, so they never reach the labelling queue", "They are too rare compared with thumbs to provide any useful volume", "Each one is noisy: a copy suggests success and a rephrase failure, but neither is certain"], "answer": 2, "why": "Implicit signals are plentiful but ambiguous, so they help choose what to label rather than define the label."}, {"q": "Why keep a held-out evaluation set of human-verified outcomes out of training?", "options": ["Training on the model's own accepted outputs can reinforce its errors, so evaluation must stay human-verified", "Accepted outputs are always duplicates of earlier data, which would inflate the evaluation set size", "Providers forbid reusing accepted outputs in any dataset, so they have to be discarded"], "answer": 0, "why": "A feedback loop that trains on its own accepted outputs amplifies mistakes, and unseen real outcomes are what reveal that."}]
---

## The problem

An AI product launches with a prompt, a model and some guesses. The advantage that compounds over time is **data from real usage**: which answers helped, which failed, which questions nobody anticipated. A feedback flywheel is the system that captures that signal, turns it into labelled examples and evaluation cases, and feeds improvements back into the product, so each month of usage makes the next release better.

## Step 1: Requirements

- **Capture** explicit feedback (thumbs, corrections) and implicit signals (copy, retry, abandon, edit distance) with the full trace.
- **Prioritize** what is worth a human's attention among millions of interactions.
- **Label** efficiently with clear guidelines and measurable agreement.
- **Use** the labels for evaluation sets first, then for prompt changes, retrieval fixes and fine-tuning.
- **Protect** privacy: consent, redaction, retention and access control.
- **Scale (example):** 5 million interactions a month, 1 percent giving explicit feedback, a labelling budget of a few thousand items a month.

## Step 2: Signals worth capturing

- **Explicit:** thumbs up or down with an optional reason, free-text correction, "report a problem".
- **Implicit:** the user copied the answer, regenerated it, rephrased the question, abandoned the session, escalated to a human, or edited the output (the edit is often the corrected label).
- **System:** latency, tool errors, validation failures, refusals, low retrieval scores.

Implicit signals are plentiful but ambiguous: a copy suggests success, a rephrase suggests failure, but each is noisy. Treat them as **triage hints** rather than ground truth. Every signal is stored linked to the **trace id**, so the full context (prompt version, retrieved documents, tool calls) is available for diagnosis.

## Step 3: Selecting what to label

Labelling everything is impossible and unnecessary. Build a **triage queue** that mixes:

- Negative-feedback and escalation cases (likely failures).
- **Uncertain** cases: low retrieval scores, judge disagreement, low model confidence.
- Clusters of similar failures, found by embedding and clustering failed traces, so one fix addresses many cases.
- A **random sample** of ordinary traffic, to measure the true quality rate and to avoid only seeing failures.

Active selection of the most informative cases gets far more value from a small labelling budget than random sampling.

## Step 4: Labelling

Give annotators the trace, a rubric and a small number of well-defined outcomes (correct, partially correct, wrong, unsafe, out of scope), plus the **correct answer or the reason for the failure category** (retrieval miss, wrong reasoning, bad tool call, missing knowledge). Measure inter-annotator agreement, resolve disagreements, and keep a calibration set. Pre-label with a strong model to speed up humans, but keep humans in charge of the final label and track the model's accuracy against them.

## Step 5: Closing the loop

Different failure categories feed different improvements:

- **Retrieval miss:** add or fix content, change chunking, add query rewriting; the case becomes a retrieval test.
- **Prompt or reasoning error:** adjust instructions or examples; the case becomes an evaluation case.
- **Missing capability or style:** collect many labelled examples and consider fine-tuning.
- **Tool failure:** fix the tool or its schema.
- **Policy gap:** update guardrails.

First priority for every labelled failure: add it to the **regression set**, so it can never return silently. Only after the evaluation set is solid should labelled data be used for training, with a strict separation between training and evaluation data.

## Step 6: Avoiding feedback traps

- **Bias:** users who click thumbs are not representative; weight and supplement with random sampling.
- **Feedback loops:** training on the model's own accepted outputs can reinforce its errors; keep human-verified data for evaluation.
- **Metric gaming:** optimising thumbs-up rate can reward flattery. Pair user feedback with accuracy audits.
- **Privacy:** redact personal data before labelling, honour deletion requests across stored traces and derived datasets, and restrict who can see raw conversations.

## Step 7: Infrastructure

An event stream carries interactions and feedback into a store keyed by trace id. A processing job enriches them (redaction, clustering, scoring), populates the labelling queue, and publishes versioned datasets to the evaluation platform. Dashboards track quality rate, feedback volume, time from failure to fix, and how many production failures became tests.

## A worked example

**Scenario:** the support assistant's thumbs-down rate rises after a product launch.

1. The triage job clusters 900 negative traces; one cluster of 140 shares the question topic "new pricing tiers".
2. Reviewers label a sample of 40: the assistant cites the old pricing page. Cause: retrieval returns stale documents.
3. The team re-indexes the updated pricing content and adds a freshness boost; the 40 labelled cases become a regression slice.
4. The next release is evaluated on that slice, passes, and rolls out gradually. The negative rate for the topic drops within a week.
5. The cluster dashboard records time from detection to fix: three days, and no manual hunting through chat logs.

## Enterprise practice (verified October 2026)

**Basics.** Collect signals, filter, label, retrain or re-rank, evaluate, ship (steps above).

**What you may and may not feed back (policy landscape, 2026; secondary summaries).** Major providers state that **API and enterprise inputs are not used to train their models by default**, with standard API retention windows (for example 30 days with automatic deletion at one provider) and zero-data-retention arrangements for eligible customers; consumer chat products have different, opt-out-based policies that have changed during 2025 and 2026. The flywheel is *your* data loop: customer conversations, edits and ratings become training or evaluation data only if your contracts, privacy notices and lawful basis allow it. Under GDPR, the EDPB's 2024 opinion treats models that can emit personal data as non-anonymous and stresses documentation and a lawful basis, so keep consent flags and purpose on every record.

**Enterprise pattern.**

- **Capture structured signals** (accept, edit, regenerate, escalate, task success), not only thumbs; link each to the trace, prompt version and retrieved sources.
- **Filter before use:** remove PII, drop low-confidence or adversarial examples, deduplicate, and check for feedback bias (users who rate are not representative).
- **Close the loop in cheap places first:** retrieval fixes, prompt changes and routing rules before fine-tuning; track which loop changed which metric.
- **Prevent self-reinforcement:** keep a held-out evaluation set of real outcomes never used for training, and watch for drift toward the model's own style when synthetic or model-edited data enters the loop.

## Common mistakes

- **Collecting feedback with no plan** to act on it.
- **Treating implicit signals as truth** rather than triage hints.
- **Only reviewing failures**, with no random sample for the true quality rate.
- **Mixing training and evaluation data**, inflating results.
- **Ignoring privacy and deletion** in stored traces and derived datasets.
