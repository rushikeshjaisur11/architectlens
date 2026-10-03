---
title: "Designing a Fraud and Risk Investigation Assistant"
short_title: "Fraud and Risk Investigation Assistant"
tags: ["fraud", "risk", "investigation", "case-management", "graph", "design"]
sources:
  - "Public guidance on anti-money-laundering investigation workflows and suspicious activity reporting"
  - "Public documentation of graph-based fraud detection approaches"
  - "Regulation and supervisory guidance on explainability of automated decisions in financial services (overview)"
  - "FinCEN, FIN-2024-Alert004 on deepfake media in fraud schemes (13 November 2024), fincen.gov"
  - "Secondary 2026 summaries on AI in AML, SAR volumes and explainability gaps (fintech.global, arXiv 2605.04076)"
predict:
  question: "An alert shows four transfers under $10,000 to new beneficiaries, and two beneficiaries share a device with accounts from a reported mule network. What does the assistant do?"
  options: ["Closes the alert as benign, because each transfer is under the threshold", "Produces an evidence-linked summary and recommends escalation, and the analyst decides", "Files the regulatory report automatically, since the graph link is strong evidence"]
  answer: 1
  why: "The assistant assembles the case and recommends; the analyst checks evidence and decides."
check:
  - q: "Why implement investigations as playbook workflows instead of open-ended agents?"
    options: ["Open agents cannot call tools, so workflows are the only way to run lookups", "Workflows let the LLM choose thresholds, which makes the narratives more fluent", "Steps, data and thresholds stay deterministic and reviewed, so it is cheaper and defensible"]
    answer: 2
    why: "Deterministic steps are more reliable, cheaper and easier to defend."
  - q: "Why have the LLM summarise from structured graph results rather than raw data?"
    options: ["Every narrative statement can then cite specific records and be verified", "Raw graph data is too large for any model to read, whatever the query", "Structured results spare the analyst from opening the case management system"]
    answer: 0
    why: "Summaries from structured results keep each claim tied to a verifiable record."
  - q: "Why review a sample of summaries the assistant marked as benign?"
    options: ["Benign cases are the cheapest to review, so they give the best throughput measure", "To catch missed risk, where suspicious cases were summarised as benign", "Benign samples feed straight into the detection layer's reason codes for training"]
    answer: 1
    why: "The lesson calls for reviewing missed risk as well as over-escalation."
---

*Engineering patterns only; legal and regulatory duties differ by jurisdiction.*

## The problem

Fraud and financial crime teams drown in alerts. Detection models flag thousands of transactions, and each alert needs an analyst to gather context from many systems, judge whether it is suspicious and document the decision. A **fraud and risk investigation assistant** does not replace detection or decide guilt. It **assembles the case, explains the signals, drafts the narrative and proposes next steps**, cutting investigation time while keeping the analyst accountable and the audit trail intact.

## Step 1: Requirements

- **Triage and prioritisation:** rank alerts by risk and urgency.
- **Evidence gathering:** pull customer profile, account history, transactions, devices, counterparties, prior cases and external data.
- **Explanation:** show why the alert fired and what is unusual, in plain language with evidence.
- **Narrative drafting:** produce case notes and regulatory reports in required formats.
- **Decision support, not decision:** recommend outcomes; the analyst decides.
- **Auditability and fairness:** every step recorded; no discriminatory patterns; adverse action explanations.
- **Security:** sensitive data; strict access; no tipping-off of subjects.
- **Scale (example):** 50,000 alerts a day, 600 analysts.

## Step 2: Architecture

- **Detection layer (existing):** rules and machine-learning models that generate alerts with reason codes.
- **Case management system:** the source of truth for alerts, cases, decisions and filings.
- **Data access tools:** governed APIs for customer, account, transaction, device, sanctions and watchlist data, and a **graph store** of entities and relationships.
- **Investigation agent:** a workflow that, for an alert, runs a standard set of lookups, analyses patterns and prepares a case summary.
- **LLM services:** summarisation, explanation, drafting and Q&A over case data.
- **Analyst workspace:** a UI showing evidence, timeline, graph, the draft narrative and recommendation.
- **Audit and monitoring services.**

## Step 3: A workflow rather than a free agent

Investigations follow playbooks, so implement them as **structured workflows with tool calls**: for an account-takeover alert, check recent login and device changes, password reset events, new payees and unusual transfer amounts; for a money-laundering alert, analyse counterparties, flows and structuring patterns. The LLM reads tool results and writes summaries, but the **steps, data pulled and thresholds** are deterministic and reviewed. Allow the analyst to ask follow-up questions that trigger additional governed lookups. This design is more reliable, cheaper and easier to defend than an open-ended agent.

## Step 4: Evidence and graph analysis

Financial crime often lives in relationships: shared devices, addresses, beneficiaries and circular fund flows. Maintain a **graph** and provide queries for neighbourhoods, shortest paths between entities, communities and flow tracing. Present results visually and as structured facts (for example "this account shares a device with 6 accounts, 4 of which were closed for fraud"). The LLM summarises findings **from the structured results**, citing the specific records, so every statement in the narrative can be verified.

## Step 5: Narrative and report drafting

Regulatory filings and case notes follow templates. The assistant drafts from the evidence: who, what, when, where, why suspicious, with transaction references and amounts taken directly from data. Use constrained generation with slots filled from structured fields, then fluent prose around them. Provide **evidence links** for every claim, require analyst review and editing, and record the final text and edits. Do not allow the model to speculate on guilt or intent; use neutral, factual language and mark inferences clearly.

## Step 6: Fairness, explainability and privacy

- **Bias monitoring:** track alert rates, escalation and outcomes across protected and proxy groups; audit for disparate impact in prioritisation and recommendations.
- **Adverse action and customer communication** follow rules-based, reviewed templates, with reasons derived from the underlying detection, not freeform LLM text.
- **Data minimisation and access control:** analysts see data relevant to their cases; sensitive investigations restricted; all access logged.
- **No tipping-off:** the assistant must not generate customer-facing text that reveals an investigation; guardrails block it.
- **Model risk governance:** classify and validate the assistant, monitor quality, control changes.

## Step 7: Human oversight and quality

Measure how analysts use recommendations: acceptance, overrides and reasons, and the outcomes of both. Review samples for **missed risk** (cases the assistant summarised as benign that were actually suspicious) and for over-escalation. Prevent automation bias by showing evidence, not just a verdict, and by randomly auditing agreement. Provide analysts with an easy way to flag wrong summaries; feed corrections into evaluation sets.

## Step 8: Performance and operations

Pre-compute common enrichments for high-risk alerts, cache stable data, and parallelise lookups so a case summary appears in seconds. Prioritise capacity for urgent alert types (real-time payment holds). Monitor latency, tool failures, summary faithfulness (automatic claim-to-evidence checks), analyst throughput and handling time, false-positive disposition rates, and cost per case.

## A worked example

**Scenario:** an alert fires on a customer who sent four transfers just under the reporting threshold to new beneficiaries within two days.

1. The workflow gathers the customer's profile (a student account opened 5 months ago), transaction history, device and login events, and the beneficiaries' details.
2. Graph analysis shows two of the beneficiary accounts share a device and address with three other accounts, one previously reported in a mule network.
3. The assistant produces a summary: "Four transfers totalling $38,400 between 9 and 10 May, each under $10,000, to four new beneficiaries; two beneficiaries are linked by a shared device to accounts previously reported (case 8841); activity is inconsistent with the customer's profile and history" with links to each record.
4. It recommends escalation and drafts the narrative section of the regulatory report; the analyst checks the evidence, edits the language, and decides to escalate.
5. The final decision, the edits and the evidence references are stored; the fairness dashboard includes the case in monthly disposition analysis by segment.

## Enterprise practice (verified October 2026)

**Basics.** Assemble the case, explain the signals, draft the narrative, keep the analyst accountable (steps above).

**Context to design with (secondary, 2026).** US institutions filed about **4.7 million SARs in fiscal year 2024** (roughly 12,900 a day), so analyst time is the bottleneck this assistant targets. Graph methods (including graph neural networks) are widely used to surface mule accounts, rings and shell structures from links among accounts, devices and addresses. A regulatory-governance paper (arXiv 2605.04076) notes that **FinCEN gives no guidance on how to incorporate AI model outputs, such as feature attributions, into SAR narratives**, and proposes standardised reason codes mapped to SAR categories; treat that as an open area where your compliance team sets the rule. FinCEN's November 2024 alert on **deepfake media in fraud schemes** is a reminder that investigators now meet synthetic identity documents and voices, so verification steps should not trust a single visual or audio check.

**Enterprise pattern.** Keep detection decisions with the existing models and rules; the assistant explains and drafts. Record the evidence references behind every sentence of a draft narrative, forbid speculation on intent, keep SAR confidentiality (no customer-facing text, no tipping-off), measure analyst time per case and the rate of edited or rejected drafts, and review a sample of summaries marked "benign" for missed risk. For US banks, apply your model-risk programme to the assistant even though SR 26-2 does not directly cover generative AI.

## Common mistakes

- **Open-ended agents** instead of playbook-driven workflows.
- **LLM-generated numbers and identifiers** instead of data-sourced fields.
- **Narratives speculating on intent or guilt.**
- **No fairness or override monitoring.**
- **Customer-facing text generated freely**, risking tipping-off or inconsistent adverse-action reasons.
