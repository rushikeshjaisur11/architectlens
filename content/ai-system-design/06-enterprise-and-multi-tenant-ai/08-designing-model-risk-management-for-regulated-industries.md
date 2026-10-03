---
title: "Designing Model Risk Management for Regulated Industries"
short_title: "Model Risk Management"
tags: ["model-risk", "regulation", "validation", "explainability", "banking", "healthcare", "design"]
sources:
  - "Federal Reserve and OCC, SR 11-7 Guidance on Model Risk Management (2011)"
  - "Regulation (EU) 2024/1689 (EU AI Act) overview of risk categories and obligations"
  - "ISO/IEC 42001 AI management system standard (overview)"
---

*This lesson describes engineering and process patterns, not legal advice. Requirements vary by jurisdiction and sector; confirm with compliance and legal teams.*

## The problem

In banking, insurance, healthcare and similar sectors, models that influence decisions are subject to supervision: you must show they are **conceptually sound, validated, monitored and controlled**. Generative AI strains traditional model risk management: outputs are open-ended, behaviour changes with prompts and provider updates, and explanations are hard. A workable programme adapts established model-risk practice to LLMs without pretending they are classical scorecards.

## Step 1: Requirements

- **Inventory and tiering:** every AI use case recorded, rated by materiality and impact.
- **Independent validation:** review separate from the builders, proportional to risk.
- **Documentation:** purpose, design, data, limitations, assumptions, performance, controls.
- **Ongoing monitoring:** performance, drift, incidents, with thresholds and escalation.
- **Change control:** model, prompt and data changes assessed and approved by risk level.
- **Accountability:** named owners, an oversight committee, evidence for supervisors.

## Step 2: Classifying use cases

Classify by what the AI influences:

- **Low:** internal productivity (drafting, summarising for the author), with human use and no automated decisions.
- **Medium:** customer-facing information or internal decision support with human review.
- **High:** decisions affecting people's rights, credit, coverage, employment, health or safety, or fully automated actions with financial effect.

The tier sets validation depth, required testing (bias, robustness, explainability), human oversight and monitoring frequency. Map tiers to external regimes where applicable, such as the high-risk categories in the EU AI Act.

## Step 3: Validation for LLM systems

Classical validation (back-testing, backward-looking error rates) adapts as follows:

- **Conceptual soundness:** is an LLM appropriate for this task, are the architecture and data sources justified, are limitations understood?
- **Performance testing** on representative, held-out data with task-specific metrics, including edge cases and adversarial inputs; report confidence intervals.
- **Groundedness and hallucination testing** for generative tasks, against source documents.
- **Robustness:** prompt variations, paraphrases, typos, languages, injection attempts, long contexts.
- **Fairness and bias testing** across relevant groups where decisions affect people, with defined metrics and thresholds.
- **Safety and compliance testing:** prohibited content, privacy leaks, regulatory phrasing.
- **Sensitivity to the provider:** behaviour across model versions, since a silent provider update can change outputs; pin versions and re-validate on change.
- **Benchmarking** against a simple baseline or the existing human process.

Validation produces a report with findings, severity, required remediation and an explicit **approval with conditions** (scope, usage limits, monitoring).

## Step 4: Explainability and traceability

Full model explainability is not available, so build **decision traceability**: for each output, record the inputs, retrieved sources, prompt and model versions, tool calls and any human override. Prefer designs that make reasoning inspectable: retrieval with citations, structured intermediate outputs, rules around the model for the actual decision, and rationales tied to evidence. For high-impact decisions keep the **model advisory** and the decision rule transparent and deterministic.

## Step 5: Human oversight

Define the human role precisely: what they review, what evidence they see, the authority to override, time and training they need. Avoid rubber-stamping by measuring override rates and sampling reviewed decisions. For automated actions, set limits (amounts, categories), escalation rules and kill switches. Provide affected people with explanations and appeal routes where required.

## Step 6: Monitoring and change management

- **Ongoing monitoring:** quality metrics on sampled production traffic, drift in inputs and outputs, error and complaint rates, bias metrics, guardrail triggers, cost and usage.
- **Thresholds and escalation:** documented triggers for investigation, restriction or withdrawal.
- **Change control:** prompts, models, retrieval settings, data sources and guardrails are versioned artifacts. Material changes trigger re-validation proportional to risk; minor changes pass automated regression gates.
- **Periodic review:** annual or more frequent revalidation, and event-driven review after incidents or regulatory changes.
- **Incident management:** classification, containment, root cause, reporting duties and lessons learned.

## Step 7: Third-party and vendor risk

Providers are third parties whose models you cannot inspect. Assess security posture, data handling, version stability and deprecation notices, exit options, concentration risk and their own controls. Contractual commitments on notification of model changes, data use and incident reporting matter. Maintain a fallback and an exit plan.

## Step 8: Evidence and reporting

Automate evidence collection: evaluation results, approvals, configuration versions, audit logs, monitoring reports and training records, linked to the inventory entry. Provide dashboards for the oversight committee: models by tier, validation status, open findings, incidents and key risk indicators. Being able to produce evidence quickly is a major part of passing supervisory review.

## A worked example

**Scenario:** an insurer plans an assistant that drafts claim decision letters from adjuster notes.

1. Classification: it influences customer outcomes, so it is **high tier** until shown to be advisory only; adjusters make and sign every decision, which moves it to medium with controls.
2. Validation: independent testers evaluate 600 historical claims against adjuster-approved letters, measuring factual consistency with the claim file, prohibited statements and tone; hallucination rate 1.2 percent, with all errors caught in the human-review simulation.
3. Bias testing across customer segments shows no systematic difference in tone or content; edge cases (disputed claims, vulnerable customers) are routed to senior adjusters.
4. Approval conditions: pinned model version, mandatory adjuster review with the claim facts shown beside the draft, monthly sampling of 200 letters, override-rate monitoring, and re-validation on any model or prompt change.
5. After a provider announces a model update, the change process runs the regression suite on the new version; it shows a regression on exclusion wording, so the update is deferred until prompts are adjusted and the suite passes.

## Common mistakes

- **Treating LLMs as exempt** from model governance.
- **Validating once**, then letting prompts and provider versions change freely.
- **Human review in name only**, with no evidence shown or override tracking.
- **No inventory**, so unapproved AI use spreads.
- **Evidence assembled by hand** when audited, instead of collected automatically.
