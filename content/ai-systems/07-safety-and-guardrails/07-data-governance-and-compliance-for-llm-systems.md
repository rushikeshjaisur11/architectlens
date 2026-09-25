---
title: "Data Governance and Compliance for LLM Systems"
short_title: "Data Governance & Compliance"
tags: ["compliance", "governance", "audit-logs", "guardrails"]
sources:
  - "EU AI Act — Regulation (EU) 2024/1689 (record-keeping and transparency obligations)"
  - "NIST AI Risk Management Framework (AI RMF 1.0)"
  - "ISO/IEC 42001:2023 — AI management system standard"
---

## Why LLM systems need governance beyond standard app logging

A conventional web app's audit log answers "who did what, when." An LLM system's governance obligations are wider: what data went into the prompt, what the model was allowed to retrieve, what it generated, whether that generation was reviewed or acted on autonomously, and — for regulated domains — whether the system's behavior can be reconstructed and explained after the fact. Regulations converging on this space (the EU AI Act's obligations for high-risk systems, sector rules like HIPAA and GLBA that already applied to the underlying data) treat the *absence* of adequate logging as a compliance failure independent of whether anything went wrong.

## What to log

- **Full prompt-response pairs**, including the system prompt version, retrieved context (for RAG systems — which documents/chunks were retrieved and their source), and any tool calls made along with their arguments and results. Without the retrieved context, you can't later reconstruct *why* a model produced a given answer — a critical gap when a wrong answer becomes a dispute.
- **Model and configuration version.** Which model, which prompt template version, which guardrail configuration was active for this request. Model behavior drifts across provider updates even at a fixed model name (a vendor's silent model update can change output distribution), so version pinning and logging which version actually served a request is what makes a later "why did it say that" investigation possible at all.
- **Guardrail decisions.** When a PII filter redacted something, when a moderation check flagged and blocked a response, when a human-in-the-loop gate required approval — log the decision and its rationale, not just the final sanitized output. This is what lets you distinguish "the guardrail worked as designed" from "the guardrail silently failed" during an audit.
- **User and consent context**, where personal data is involved: what data subject the request pertains to, what legal basis or consent covers processing it, and — for EU AI Act "high-risk" classified systems — the human oversight events tied to that request.

## Retention policy design

Retention isn't just "keep everything forever" — that itself creates liability (a larger breach surface, GDPR's storage-limitation principle, e-discovery burden in litigation). Practical retention design separates:

- **Operational logs** (short retention, days to weeks) for debugging and immediate incident response.
- **Compliance/audit logs** (retention set by the applicable regulation — often multi-year for financial or healthcare records) that must be tamper-evident and access-controlled, typically stored separately from operational logs with stricter access controls.
- **Training/eval data derived from logs** — if production logs feed back into fine-tuning or eval sets, that reuse needs its own consent and governance check; data collected for one purpose (serving a request) isn't automatically cleared for another (model improvement), which is a distinct legal basis under most privacy frameworks.

A common failure mode is a single undifferentiated log store where debug-level data (containing raw, unredacted PII) sits at the same retention and access tier as records that genuinely need long retention for compliance — this maximizes both breach exposure and storage cost without improving actual auditability.

## Explainability and traceability

For high-risk classified use cases, "the model decided X" isn't a sufficient answer during an audit — governance requires being able to reconstruct the decision path: input, retrieved context, model version, any human review step, and final action taken. Systems that can't reproduce this chain (because intermediate steps weren't logged, or because retrieval is non-deterministic and wasn't snapshotted) can't demonstrate compliance even if the underlying decision was correct.

## Common mistakes

- **Logging only the final output, not the full context that produced it.** Without the retrieved documents, tool calls, and guardrail decisions, an audit log can't answer "why," only "what."
- **One retention policy for all log types.** Treating debug logs and compliance-mandated audit records identically either over-retains sensitive data or under-retains what regulation requires.
- **No version pinning on models/prompts feeding into logged decisions.** If you can't say which exact model and prompt version served a historical request, you can't reproduce or defend that decision later, even with a complete log.
