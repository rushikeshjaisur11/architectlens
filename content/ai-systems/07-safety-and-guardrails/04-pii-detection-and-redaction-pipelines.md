---
title: "PII Detection and Redaction Pipelines"
short_title: "PII Detection & Redaction"
tags: ["pii", "privacy", "guardrails", "compliance"]
sources:
  - "Microsoft Presidio (open-source PII detection/anonymization engine)"
  - "NIST SP 800-122: Guide to Protecting the Confidentiality of PII"
  - "Google Cloud Data Loss Prevention (DLP) API documentation"
  - "EDPB Opinion 28/2024 on AI models and personal data (via law-firm summaries); OWASP LLM02 Sensitive Information Disclosure"
banner:
  layout: line
  nodes:
    - [doc, "text"]
    - [shield, "detector"]
    - [server, "mask"]
    - [db, "vault"]
predict:
  question: "A team redacts PII in live requests before they reach the model, but their tracing tool records each prompt before the redaction step runs. Where does raw PII persist?"
  options: ["Nowhere, because the model never sees the raw text and so nothing is stored", "In the model's weights only, since the trace is discarded after redaction completes", "In the trace store, which holds a second, unguarded copy of the raw prompt"]
  answer: 2
  why: "Redaction after logging only changes what the model saw, not what persisted; observability pipelines are a common leak path."
check:
  - q: "Why combine regex, NER and an optional LLM pass instead of using only an LLM detector?"
    options: ["Regex and NER are always more accurate than LLMs, so an LLM pass adds nothing", "Regex is cheap and precise on structured types, while the LLM adds cost and latency", "An LLM detector can't find names, so NER is required to cover that PII category"]
    answer: 1
    why: "Layering puts cheap high-precision detectors first and reserves the slower, costlier LLM call for ambiguous or domain-specific cases."
  - q: "Why prefer pseudonymization over plain masking for a summarization pipeline?"
    options: ["Masking is irreversible and pseudonymization is not, so only pseudonymization meets privacy law", "Consistent fake values keep referential structure, so the model can still tell people apart", "Pseudonymization removes the need for a mapping table, which reduces the security surface"]
    answer: 1
    why: "Identical placeholders destroy coherence; consistent pseudonyms preserve it and can allow reversal via a secure mapping."
  - q: "A team ships a PII detector without measuring it on representative traffic. What failure modes does the lesson predict?"
    options: ["Missed PII goes unnoticed until an incident, and over-redaction silently degrades task quality", "Only over-redaction appears, since detectors by default err toward flagging too much text", "Only missed PII appears, because over-redaction is caught automatically by downstream tasks"]
    answer: 0
    why: "Without precision/recall measurement, both false negatives and false positives stay hidden."
---

## Why LLM pipelines need their own PII layer

Traditional PII scanning (DLP tools scanning databases and file shares) assumes structured fields with known schemas. LLM applications break that assumption twice: **unstructured input** (a user pastes a support ticket containing a customer's SSN inline in free text) and **unstructured output** (a model trained or fine-tuned on data containing PII can regurgitate it verbatim in a completion, even when the current prompt never mentions it). A production pipeline needs detection at both the input boundary and the output boundary, and they require different techniques.

## Detection approaches

- **Rule-based / regex + checksum.** Fast and precise for structured formats with verifiable checksums — credit card numbers (Luhn algorithm), SSNs, IBANs, email addresses. Near-zero false positives on well-formed patterns but blind to context (a regex matching `\d{3}-\d{2}-\d{4}` can't tell a SSN from a coincidental numeric string) and misses PII with no fixed format.
- **Named Entity Recognition (NER) models.** Statistical or transformer-based models (spaCy pipelines, Presidio's default NER recognizers) catch names, addresses, and organizations that regex can't. These carry real false-positive/negative rates — a small model tuned for English news text underperforms on informal chat text, non-Western names, or domain-specific identifiers (patient IDs, internal employee codes).
- **LLM-as-detector.** Prompting a model to identify and tag PII spans generalizes well to novel formats and multilingual text but adds latency (a second inference call) and cost, and needs its own evaluation — an LLM detector can itself hallucinate spans or miss PII embedded in unusual phrasing.
- **Combined pipelines** (what Presidio and most production systems do) layer these: regex/checksum recognizers for high-precision structured types, NER for names/locations, and an optional LLM pass for ambiguous or domain-specific cases, then merge overlapping spans with a confidence score per detection.

## Redaction strategies

Detecting a span is only half the pipeline — what you do with it matters for both privacy and utility:

- **Masking/redaction**: replace with a placeholder (`[REDACTED_SSN]`). Simplest, but destroys information the downstream task might need (a summarization model can't reference "the customer" coherently if every name became identical placeholder text).
- **Tokenization/pseudonymization**: replace with a consistent fake value (swap "John Smith" for "Person_A" consistently across the document). Preserves referential structure and document coherence, and — if reversible via a secure mapping table — lets an authorized downstream process re-identify data later. This is the standard approach for **de-identification with re-identification** workflows in healthcare (HIPAA Safe Harbor) and finance.
- **Generalization**: replace a specific value with a coarser category (an exact birthdate becomes an age range, a street address becomes a city). Common in analytics pipelines where the specific value isn't needed, only the statistical signal.
- **Differential privacy at the aggregate level** is a separate, stronger guarantee than redaction — it bounds what an attacker can infer about any individual from model outputs or training data, at the cost of injected noise. It's rarely applied per-request in LLM guardrail pipelines because it operates on datasets/training, not single completions; it matters more when fine-tuning on user data.

## Placement in the request pipeline

PII guardrails need to run at **input** (before the prompt reaches the model or gets logged), **output** (before a completion is returned or stored), and **at rest** (scanning logs, traces, and eval datasets that accumulated raw prompts before a guardrail existed). A common miss: teams redact live traffic but forget that their observability/tracing pipeline (LangSmith, Datadog, custom logging) captured the raw, unredacted prompt before redaction ran, creating a second, unguarded copy of the same PII.

## Current practice (verified October 2026)

The EDPB's December 2024 opinion treats a model that can emit personal data about people whose data trained it as **not anonymous**, and stresses documentation and lawful basis; do not assume fine-tuning on redacted text is risk-free. Redact at the gateway before provider calls, treat traces and logs as the main leak path (OWASP LLM02), support erasure across prompts, memory, vector indexes and training sets, and keep pseudonym mapping tables inside your boundary.

## Common mistakes

- **Redacting only structured PII and assuming that's "done."** Free-text PII — a customer describing their own medical condition in a support chat — evades regex and requires NER/LLM detection layered in.
- **Applying redaction after logging instead of before.** If the raw prompt is written to a log store or vector database prior to redaction, the guardrail didn't prevent exposure — it just decorated what the model saw, not what persisted.
- **No evaluation set for the detector itself.** Teams ship a PII detector without measuring its precision/recall on representative traffic, so false negatives (missed PII) go unnoticed until an incident, and false positives (over-redaction) silently degrade task quality.
