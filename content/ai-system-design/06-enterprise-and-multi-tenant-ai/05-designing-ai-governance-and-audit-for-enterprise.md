---
title: "Designing AI Governance and Audit for the Enterprise"
short_title: "AI Governance and Audit"
tags: ["governance", "audit", "compliance", "policy", "risk", "design"]
sources:
  - "NIST, AI Risk Management Framework (AI RMF 1.0, 2023)"
  - "Regulation (EU) 2024/1689 (EU AI Act) overview of risk tiers and obligations"
  - "ISO/IEC 42001 AI management system standard (overview)"
  - "EU AI Omnibus (Reg. (EU) 2026/1744) summary, Gibson Dunn, gibsondunn.com (fetched Oct 2026)"
  - "NIST AI 600-1, Generative AI Profile (July 2024)"
  - "ISO/IEC 42001:2023, AI management systems"
banner:
  layout: line
  nodes:
    - [server, "AI system"]
    - [doc, "registry"]
    - [shield, "review"]
    - [db, "audit trail"]
predict:
  question: "Reviewers of a high-risk screening tool override the model's recommendation in 0 percent of cases. What does the lesson suggest this may mean?"
  options: ["Evidence of excellent accuracy and a reason to reduce review", "A possible sign of rubber-stamping rather than real oversight", "A sign the override option should be removed to save cost"]
  answer: 1
  why: "A 0 percent override rate may mean reviewers are not truly disagreeing, so oversight exists in name only."
check:
  - q: "Why tier review by risk instead of applying the full process to every use case?"
    options: ["Uniform review slows low-risk work and under-reviews high-risk work", "Regulators only require review of internal brainstorming tools", "Tiering removes the need for an AI registry"]
    answer: 0
    why: "One-size-fits-all review is slow for low-risk use cases and thin for high-risk ones."
  - q: "Why is logging every interaction in full a governance risk?"
    options: ["Full logs prevent reconstructing what happened for audits", "Logs are themselves sensitive and can create a new privacy risk", "Log volume makes the policy engine reject requests"]
    answer: 1
    why: "Logs should be minimised, redacted and retention-limited, because they can become a new privacy exposure."
  - q: "Why store EU AI Act deadlines as data in the registry rather than in prose?"
    options: ["Prose cannot be read by auditors during a review", "Deadlines are fixed by law and never change once published", "Dates slip, as this one just did, so they must be easy to update"]
    answer: 2
    why: "The Annex III date moved from 2 August 2026 to 2 December 2027, so deadlines should be updatable data."
---

*This lesson describes engineering patterns for governance, not legal advice. Regulations differ by jurisdiction and change; check requirements with your legal and compliance teams.*

## The problem

As AI features spread across a large organisation, leadership and regulators ask uncomfortable questions: which models are in use, on what data, who approved them, what did they do for a given customer, and can you prove it? Governance is the system of **policies, controls and evidence** that answers those questions, so AI can be used at scale without unmanaged risk. Done well it speeds teams up by making safe paths obvious.

## Step 1: Requirements

- **Inventory:** a registry of every AI system, model, prompt, data source and owner.
- **Risk classification:** each use case rated by impact (internal drafting versus decisions affecting people), driving the required controls.
- **Policy enforcement:** automated, not a document nobody reads: allowed models per data class, PII handling, human oversight, retention.
- **Auditability:** reconstruct what happened for any request: inputs, model, versions, outputs, approvals.
- **Accountability:** named owners, review cadences, incident process.
- **Scale (example):** 150 AI use cases across 40 teams, regulated data in a subset.

## Step 2: The control plane

Centralise what must be consistent, leave product logic to teams.

- **AI registry:** one record per system: purpose, owner, risk tier, models and providers, data categories, evaluation results, approval status, links to monitoring.
- **LLM gateway:** the enforcement point for model access, redaction, region rules, rate limits and logging, as in the gateway design.
- **Policy engine:** rules expressed as code (for example: customer data of class "restricted" may only go to models approved for that class in region EU), evaluated at request time and at deployment time.
- **Evidence store:** immutable, access-controlled logs and artifacts used for audits.

## Step 3: Risk-based controls

Not every use case needs the same scrutiny. A tiered approach avoids both recklessness and paralysis:

- **Low risk** (internal brainstorming, no sensitive data): automated checks, self-service registration.
- **Medium risk** (customer-facing content, internal data): required evaluations, security review, monitoring.
- **High risk** (decisions about employment, credit, health, legal rights): formal review, bias and robustness testing, human oversight on decisions, documented limitations, regular reassessment.

Align tiers with applicable frameworks such as the NIST AI RMF and the risk categories in laws like the EU AI Act, translated into concrete checklists engineers can follow.

## Step 4: What to record

For each interaction, enough to reconstruct it without over-collecting:

- Time, user or service identity, use-case id.
- Prompt template version, model and parameters, tool calls and results.
- Retrieved document ids (not necessarily contents) and their access decisions.
- Guardrail outcomes (redactions, blocks) and the final output or a hash and pointer.
- Human approvals or overrides.

Apply **data minimisation**: redact personal data in logs, set retention by data class, restrict log access, and support deletion requests for derived records. Logs are themselves sensitive.

## Step 5: Human oversight

For consequential decisions, design the human role deliberately: the person sees the model's recommendation **and the evidence**, can disagree easily, and their overrides are recorded and reviewed. Avoid automation bias by measuring how often reviewers actually change outcomes; a 0 percent override rate may mean rubber-stamping. Provide escalation and appeal paths for affected people where required.

## Step 6: Continuous assurance

Governance is not a launch gate only. Monitor in production: quality and drift, safety incident rates, fairness metrics across groups where applicable, cost, and use outside approved scope. Reassess on triggers: a model or prompt change, new data source, new regulation, or an incident. Run periodic red-team exercises and tabletop incident drills. Maintain an **incident process** with severity levels, notification duties and post-incident reviews feeding back into controls.

## Step 7: Operating model

Define roles: system owners, a central AI risk function, security, privacy, legal, and an approval board for high-risk cases. Provide **paved paths**: templates, approved models, pre-built guardrails and checklists, so compliant is the easy route. Report to leadership with a small set of metrics: systems by risk tier, percentage with current evaluations, open findings, incidents and time to remediate.

## A worked example

**Scenario:** HR wants an assistant that screens internal job applicants.

1. Registration classifies it as **high risk** (affects employment decisions), triggering the full control set.
2. Review requires: documented purpose and limits, bias testing across groups on a representative dataset, human review of every recommendation, and no automated rejection.
3. The gateway policy allows only an approved model in the company's region, with applicant data redacted in logs after 30 days.
4. In production every recommendation stores its inputs, rubric version and the reviewer's decision. Dashboards watch override rates and group-level outcome differences.
5. Quarterly reassessment finds a skew for one group; the system is paused, retuned, retested, and the incident, fix and approval are recorded in the evidence store.

## Enterprise practice (verified October 2026)

**Basics.** Inventory every AI system, classify by risk, assign owners, require approvals and keep evidence (steps above).

**Regulatory clock (live-checked October 2026).**

- **EU AI Act, as amended by the AI Omnibus** (political agreement 7 May 2026, in force 27 July 2026). High-risk obligations for stand-alone **Annex III** systems now apply from **2 December 2027** (was 2 August 2026); **Annex I** products (AI embedded in regulated products) from **2 August 2028**. **Article 50 transparency** duties stayed on **2 August 2026**, with a watermarking grace period to **2 December 2026** for existing systems. General-purpose model duties have applied since **2 August 2025**. The AI Office gains exclusive competence over AI systems built on a general-purpose model by the same provider. A new Article 5 prohibition covers AI-generated non-consensual intimate imagery and CSAM.
- **NIST AI RMF and the Generative AI Profile (AI 600-1)** list 12 GAI-specific risks (for example confabulation, information integrity, data privacy, IP) and are the usual US reference in procurement.
- **ISO/IEC 42001** is the certifiable AI management-system standard; many enterprises use it as the single control library and map NIST and EU evidence onto it.

**Enterprise pattern.** One control library, three mappings (EU, NIST, ISO). The registry records risk tier, data categories, model and version, owner, evaluation results and approvals; changes to model, prompt or tools trigger re-review by tier. Dates slip (this one just did), so keep deadlines as data in the registry, not in prose.

*Not legal advice; confirm obligations with counsel.*

## Common mistakes

- **Governance as a document**, with no automated enforcement.
- **One-size-fits-all review**, slowing low-risk work and under-reviewing high-risk work.
- **Logging everything** in a way that creates a new privacy risk.
- **Human oversight in name only**, with no evidence reviewers can and do disagree.
- **Treating approval as one-time**, ignoring drift and change.
