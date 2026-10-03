---
title: "AI Regulation and Standards: What Engineers Need to Know"
short_title: "AI Regulation and Standards"
tags: ["regulation", "eu-ai-act", "nist", "iso-42001", "governance", "compliance"]
sources:
  - "EU AI Omnibus (Reg. (EU) 2026/1744) summary, Gibson Dunn, gibsondunn.com (fetched October 2026)"
  - "NIST AI 600-1, Artificial Intelligence Risk Management Framework: Generative AI Profile (July 2024)"
  - "ISO/IEC 42001:2023, Artificial intelligence management system"
  - "Federal Reserve SR 26-2 (17 April 2026), federalreserve.gov (summary page fetched October 2026)"
---

*This is an engineering overview, not legal advice. Dates and scope change; confirm with counsel.*

## Why engineers should care

Regulation turns design choices into obligations. Whether a system falls in a high-risk category, whether outputs must be labelled, how long logs must be kept: these shape architecture (logging, human oversight, data lineage, evaluation evidence) and are far cheaper to build in than to retrofit.

## The EU AI Act, as amended in 2026

The EU AI Act classifies AI systems by risk: **prohibited** practices, **high-risk** systems (for example in employment, credit, education, essential services), systems with **transparency duties** (chatbots, generated media), and **general-purpose AI models** with their own duties. A 2026 amendment (the "AI Omnibus", entered into force 27 July 2026) changed the clock:

- **High-risk, stand-alone systems (Annex III)** now apply from **2 December 2027** (previously 2 August 2026).
- **High-risk, embedded in regulated products (Annex I)** from **2 August 2028**.
- **Article 50 transparency duties** (disclosing AI interaction, marking generated content) stayed at **2 August 2026**, with a watermarking grace period for existing systems until **2 December 2026**.
- **General-purpose model obligations** have applied since **2 August 2025**; the AI Office gained exclusive competence over systems built on a general-purpose model by the same provider.
- A new prohibition covers AI systems generating non-consensual intimate imagery and child sexual abuse material, with a transition to 2 December 2026.

Engineering implications for high-risk systems: risk management process, data governance and quality, technical documentation, **automatic logging**, human oversight, accuracy and robustness testing, and post-market monitoring. Marking generated content is typically met by combining signed provenance metadata (such as C2PA) with watermarking.

## US and sector guidance

The US has no single federal AI statute; guidance comes from frameworks and sector regulators. The **NIST AI Risk Management Framework** and its **Generative AI Profile (AI 600-1)**, which lists risks specific to generative AI (such as confabulation, information integrity, data privacy and intellectual property), are the usual reference in US procurement. In banking, interagency model-risk guidance **SR 26-2** (17 April 2026) replaced SR 11-7; its summary stresses a risk-based approach tailored to an institution's size and model use, and secondary analyses report that generative and agentic AI are treated as outside its scope pending further work. Securities regulators apply existing supervision and recordkeeping rules to GenAI use. Several US states have enacted chatbot and consumer-protection laws.

## Standards you can certify against

**ISO/IEC 42001** specifies an AI management system (policies, roles, risk assessment, controls, continual improvement) and is certifiable by auditors, similar in spirit to ISO 27001. Many organisations use it as a single control library and map NIST and EU requirements onto it, so one body of evidence serves several regimes.

## Turning rules into engineering requirements

1. **Inventory and classify** every AI use case with an owner and risk tier.
2. **Define evidence**: evaluation results, test data lineage, approvals, incident records, kept per system and version.
3. **Build logging and traceability** that can answer "what did the system do for this person on this date".
4. **Design human oversight** where required: who can intervene, with what information, within what time.
5. **Label AI interaction and generated content** where required.
6. **Track changes**: model, prompt and tool changes trigger re-review by tier.

## A worked example

A lender plans an AI assistant that summarises loan applications for underwriters.

- Classification: credit decisions are a high-risk area under the EU Act, so a decision-support tool used on EU applicants is assessed; deployment is planned for 2028, after the 2 December 2027 Annex III date, but design starts now.
- Controls built in from day one: immutable logs of inputs, outputs and the underwriter's decision; underwriter sees source evidence for every summary line; monthly bias and accuracy reports by segment; documented override path.
- In the US the bank applies its model-risk programme by analogy, since SR 26-2 does not directly cover generative AI.
- Evidence is stored once and mapped to ISO 42001 controls, NIST AI RMF functions and EU Act articles.

## Common mistakes

- **Treating regulation as a launch-week checklist.**
- **Hard-coding dates in prose** instead of tracking them in the governance registry (the EU dates just moved).
- **Ignoring vendor models** in the inventory.
- **Logging too little** to reconstruct a decision, or too much personal data to keep lawfully.
- **Assuming "not in scope" means "no expectations"**; supervisors still ask.
