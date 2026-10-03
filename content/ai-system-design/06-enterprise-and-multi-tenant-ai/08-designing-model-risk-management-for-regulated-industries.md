---
title: "Designing Model Risk Management for Regulated Industries"
short_title: "Model Risk Management"
tags: ["model-risk", "regulation", "validation", "explainability", "banking", "healthcare", "design"]
sources:
  - "Federal Reserve and OCC, SR 11-7 Guidance on Model Risk Management (2011)"
  - "Regulation (EU) 2024/1689 (EU AI Act) overview of risk categories and obligations"
  - "ISO/IEC 42001 AI management system standard (overview)"
  - "Federal Reserve SR 26-2 (17 April 2026), federalreserve.gov/supervisionreg/srletters/SR2602.htm (fetched Oct 2026)"
  - "Secondary analyses of SR 26-2 scope and generative AI (for example CRA, Elevate Consulting, 2026)"
banner:
  layout: line
  nodes:
    - [model, "model"]
    - [shield, "validation"]
    - [doc, "docs"]
    - [user, "risk board"]
predict:
  question: "A provider announces a model update. The regression suite on the new version shows a regression on exclusion wording. What happens?"
  options: ["The update ships because the adjuster reviews every letter anyway", "The update ships with a warning added to the monthly report", "The update is deferred until prompts are adjusted and the suite passes"]
  answer: 2
  why: "Model changes go through change control, so the update waits until the regression suite passes."
check:
  - q: "Why keep the model advisory with a transparent, deterministic decision rule for high-impact decisions?"
    options: ["LLM drafts are generally too long for adjusters to review in practice", "Models cannot be fully explained, so the decision rule stays inspectable", "Regulators prohibit LLM output from appearing in any claims document"]
    answer: 1
    why: "Full explainability is not available, so the decision rule itself is kept transparent while the model advises."
  - q: "Why treat prompt, model and retrieval-corpus changes as model changes?"
    options: ["Each can change outputs, so an earlier validation no longer holds", "Regulators define prompts as separate registered models", "Version control tools require formal approval for each commit"]
    answer: 0
    why: "Validating once and then letting prompts or versions change freely is a listed mistake; material changes trigger re-validation."
  - q: "Why does a provider's silent model update matter for the inventory?"
    options: ["Provider updates only change pricing, not behaviour", "Updates are blocked by contract, so no check is needed", "It is a change you never approved, so pin versions and re-validate"]
    answer: 2
    why: "A silent update changes behaviour without your approval, so versions are pinned and re-validated on change."
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

## Enterprise practice (verified October 2026)

**Basics.** Inventory models, tier by materiality, validate independently, monitor, and govern change (steps above).

**What changed in 2026 (US banking).** The Federal Reserve, OCC and FDIC issued **SR 26-2 on 17 April 2026**, superseding SR 11-7 (2011) and SR 21-8. The primary page states a **risk-based approach tailored to each organisation's model risk profile, size and complexity**, and notes it is most relevant to banks above **$30 billion** in assets. Secondary analyses report that **generative and agentic AI are explicitly out of scope** ("novel and rapidly evolving") and that the agencies plan a separate request for information. I could read only the summary page, not the PDF text, so confirm that scope statement in the PDF.

**What that means for design.** Absent specific rules, banks apply the *principles* (inventory, effective challenge, ongoing monitoring) to LLM systems by analogy and by their own policy, and examiners will still ask. Practical pattern: classify LLM use cases by materiality (customer-facing or decision-influencing is higher tier), require independent validation for those, define tolerance thresholds for quality and bias metrics, monitor drift on live samples, and treat prompt, model and retrieval-corpus changes as model changes with revalidation. Keep a vendor-model inventory, since a provider's silent model update is a change you did not approve.

*Jurisdictions differ (EU, UK PRA SS1/23, others); this section covers the US federal banking agencies only.*

## Common mistakes

- **Treating LLMs as exempt** from model governance.
- **Validating once**, then letting prompts and provider versions change freely.
- **Human review in name only**, with no evidence shown or override tracking.
- **No inventory**, so unapproved AI use spreads.
- **Evidence assembled by hand** when audited, instead of collected automatically.
