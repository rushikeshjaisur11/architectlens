---
title: "Designing a PII-Safe AI Pipeline"
short_title: "PII-Safe AI Pipeline"
tags: ["pii", "privacy", "redaction", "compliance", "data-protection", "design"]
sources:
  - "Regulation (EU) 2016/679 (GDPR) overview of personal data principles"
  - "NIST SP 800-122, Guide to Protecting the Confidentiality of Personally Identifiable Information"
  - "Public documentation on named-entity recognition based PII detection and tokenization services"
---

*This lesson covers engineering patterns, not legal advice; check obligations with your privacy and legal teams.*

## The problem

AI features process emails, tickets, documents and conversations that contain names, addresses, account numbers, health details and more. Sending that data to a model provider, storing it in logs, embedding it in a vector index or using it for training all create privacy risk and regulatory exposure. A **PII-safe pipeline** minimises personal data at every stage, keeps it recoverable only where needed, and proves what happened to it.

## Step 1: Requirements

- **Minimisation:** the model and downstream systems see only the personal data the task truly needs.
- **Utility:** answers remain useful; redaction must not destroy meaning.
- **Reversibility where required:** the user-facing answer may need real names restored.
- **Coverage:** every path (prompts, retrieved documents, tool outputs, logs, caches, training data) is covered.
- **Rights:** support access and deletion requests across derived data.
- **Evidence:** audit trail and measurable detection quality.
- **Scale (example):** 5 million requests a day, mixed structured and free text.

## Step 2: Data flow map first

Before building controls, map where personal data enters and travels: user inputs, retrieved documents, tool and API results, model outputs, logs and traces, caches, vector indexes, evaluation datasets, fine-tuning data, backups and analytics. Classify each flow by data type and sensitivity, and decide for each: **block, minimise, tokenise, or allow with controls**. Most privacy incidents come from the forgotten paths (debug logs, evaluation exports), not the main request.

## Step 3: Detection

Combine methods, since each has gaps:

- **Pattern rules and checksums** for structured identifiers: emails, phone numbers, card numbers (Luhn), national ids, IBANs; precise but only for known formats.
- **Named-entity recognition models** for names, locations and organisations in free text; context-aware but probabilistic.
- **Domain dictionaries and custom entities:** customer ids, internal project names.
- **LLM-based detection** for subtle or context-dependent personal data, used selectively due to cost and latency.
- **Document structure:** known fields (a CRM export's "email" column) need no detection, only handling.

Measure **recall** on a labelled sample (missed PII is the dangerous error) and precision (over-redaction harms utility); tune per entity type and language.

## Step 4: Handling strategies

Choose per entity type and purpose:

- **Mask:** replace with a label (`[EMAIL]`); irreversible, safest for logs and analytics.
- **Tokenise (pseudonymise):** replace with a stable placeholder (`<PERSON_1>`) and keep a mapping in a secured vault, so the model reasons about "PERSON_1" consistently and the response can be **de-tokenised** for the authorised user. The model never sees the real value.
- **Generalise:** keep partial information (age range instead of birth date, city instead of address).
- **Hash or encrypt** with keys for join-ability without exposure.
- **Allow:** where the task truly requires it (the assistant must read the customer's own record), pass the data only to approved models and regions under contract, with logging.

## Step 5: Placement in the pipeline

A pragmatic layout:

1. **Ingress:** classify and tokenise user input before it reaches anything else.
2. **Retrieval:** documents are redacted at indexing time where the use case allows, or filtered by permission and tokenised at query time.
3. **Model call:** only tokenised text goes out; provider contracts disable retention and training on the data.
4. **Egress:** responses are checked for leaked personal data and de-tokenised only for the authorised requester.
5. **Observability:** logs and traces store redacted text by default; raw text only in a restricted, short-retention vault if truly needed.

Centralise this in the gateway so every application inherits it.

## Step 6: Storage, retention and rights

- **Vector indexes and caches** can hold personal data in embeddings and text; scope them per tenant, apply the same classification, and make **deletion** work: a user's data must be removable from chunks, vectors, caches and derived datasets, with the mapping vault key destruction as a way to render pseudonymised data unrecoverable.
- **Retention limits** by data class, enforced automatically.
- **Training and evaluation data:** exclude or redact personal data, and track provenance so a deletion request can trace what was used.
- **Region and residency:** keep processing in permitted regions.

## Step 7: Assurance

Run **red-team tests**: seed canary personal data and verify it never appears in logs, caches or another tenant's output. Test across languages and formats (names in other scripts, numbers with separators). Monitor detection recall on sampled production traffic with human review, track the amount of unredacted PII found downstream, and keep audit logs of access to the token vault. Document the data flows and controls for assessments.

## A worked example

**Scenario:** a support assistant summarises a ticket containing a customer's name, email and a card number.

1. Ingress detection finds the email and card number by pattern (checksum-validated) and the name by an NER model. The name becomes `<PERSON_1>`, the email `<EMAIL_1>`, and the card number is masked entirely because the task never needs it.
2. The mapping `<PERSON_1> to Anita Rao` is stored in a vault scoped to this session with a one-hour TTL.
3. The model, called under a zero-retention agreement, summarises: "`<PERSON_1>` reports a duplicate charge; reply to `<EMAIL_1>`."
4. The egress check confirms no raw identifiers remain, then de-tokenises for the authorised support agent, who sees the real name and email.
5. Logs store only the tokenised text; a canary email planted in a test ticket is verified absent from logs and the vector index by the nightly privacy test.

## Common mistakes

- **Redacting only the prompt**, while logs, caches and vector indexes keep raw data.
- **Relying on one detector** with no recall measurement.
- **Irreversible masking where users need real values back**, or keeping token maps indefinitely.
- **Ignoring deletion** of derived data like embeddings and evaluation sets.
- **Assuming the provider contract** removes the need for minimisation.
