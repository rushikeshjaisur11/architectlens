---
title: "Designing a Clinical Documentation Assistant"
short_title: "Clinical Documentation Assistant"
tags: ["healthcare", "clinical-notes", "ambient-scribe", "hipaa", "safety", "design"]
sources:
  - "HHS, HIPAA Privacy and Security Rules overview"
  - "HL7 FHIR specification (Fast Healthcare Interoperability Resources)"
  - "Public clinical informatics literature on ambient documentation and note quality evaluation"
  - "Doximity, 2026 State of AI in Medicine (physician adoption of voice documentation tools), via secondary summaries"
  - "FDA Clinical Decision Support Software guidance (final, January 2026), docket FDA-2017-D-6569, via secondary summaries"
  - "HHS, HIPAA Privacy and Security Rules (business associate requirements)"
banner:
  layout: line
  nodes:
    - [phone, "visit audio"]
    - [model, "STT + LLM"]
    - [doc, "draft note"]
    - [user, "clinician"]
predict:
  question: "During a visit the audio around a drug name is unclear, though the patient said 'ten milligrams'. What does the draft note show?"
  options: ["A flagged placeholder asking the clinician to confirm the drug and dose", "The most likely drug from the EHR medication list, inserted silently", "The sentence is dropped from the note with no marker at all"]
  answer: 0
  why: "Ambiguous or inaudible content is flagged for the clinician rather than guessed."
check:
  - q: "Why extract facts into a typed structure first and render the note from those facts?"
    options: ["Typed structures make speech recognition more accurate in noisy rooms", "The generator then cannot add content that has no supporting extracted fact", "It lets the EHR accept the note without needing a clinician signature"]
    answer: 1
    why: "Constrained generation limits the note to extracted, evidence-linked facts."
  - q: "Why should accepting a flagged item not be easier than reading it?"
    options: ["Quick acceptance raises edit rates, which hides quality problems in each section", "Flags come from the verifier, so clinicians should never need to read them", "Easy acceptance invites automation bias, so errors pass through unread"]
    answer: 2
    why: "The lesson warns about automation bias in the review UI."
  - q: "Why is auto-populating billing codes without clinician review a design risk?"
    options: ["It can push the product toward Software as a Medical Device, off the documentation side", "It breaks the BAA, because billing data falls outside protected health information", "It raises recording-consent exposure under state wiretap laws for every visit"]
    answer: 0
    why: "Tools that auto-populate billing codes without review can move toward regulated device territory."
---

*Engineering patterns only; clinical and legal requirements vary by jurisdiction and must be confirmed with clinical safety, privacy and legal teams.*

## The problem

Clinicians spend a large part of the day documenting. An **ambient clinical documentation assistant** listens to a consultation (with consent), transcribes it, and drafts a structured note for the clinician to review, edit and sign, possibly pre-populating orders and codes. The value is time returned to patient care. The risks are specific and serious: a hallucinated symptom, medication or dose in a medical record can harm a patient, and the data is among the most sensitive there is.

## Step 1: Requirements

- **Output:** a structured note (for example SOAP: subjective, objective, assessment, plan) in the clinic's template and style, with problem list, medications and follow-ups.
- **Safety:** every statement in the draft traceable to something said or recorded; no invented findings, doses or diagnoses.
- **Workflow:** clinician reviews and signs; the assistant never files unsigned content as final.
- **Integration:** read context from and write drafts to the electronic health record (EHR) via standard interfaces.
- **Privacy and compliance:** consent, minimum necessary data, encryption, audit, residency, business associate agreements with vendors.
- **Latency:** draft available within a minute or two after the visit.
- **Scale (example):** 3,000 clinicians, 12,000 visits a day.

## Step 2: Pipeline

1. **Consent and capture:** record patient and clinician consent in the workflow; capture audio from the device with clear indicators.
2. **Speech recognition** tuned for medical vocabulary, accents and noisy rooms, with speaker separation (clinician, patient, others).
3. **Context assembly:** pull relevant history from the EHR (problem list, medications, allergies, recent results) through FHIR APIs, scoped to the patient and the encounter.
4. **Structured extraction:** identify clinically relevant facts: symptoms, history, exam findings, assessments, plans, medications with doses.
5. **Note generation:** draft sections in the clinic's template, with each statement linked to transcript evidence.
6. **Verification:** automated checks (below), then the clinician reviews.
7. **Sign and file:** the clinician edits and signs; the note and audit trail are stored in the EHR.
8. **Retention:** audio and transcripts deleted or retained according to policy.

## Step 3: Grounding and faithfulness

Medical notes must reflect what actually happened. Techniques:

- **Evidence linking:** each sentence or fact in the draft references the transcript spans (and EHR items) that support it; the UI highlights them on click.
- **Constrained generation:** extract facts first into a typed structure, then render the note from those facts, so the generator cannot add unsupported content.
- **Attribution of source:** distinguish patient-reported ("patient reports chest pain for 2 days") from clinician observation and from the EHR history.
- **Uncertainty handling:** ambiguous or inaudible content is flagged for the clinician rather than guessed; omit rather than invent.
- **No new clinical reasoning by default:** the assistant records, it does not diagnose; any suggestions are clearly labelled as such and optional.

## Step 4: Automated safety checks

- **Unsupported-claim detection:** an independent verifier checks each claim against the transcript and flags those without support.
- **Medication safety:** validate drug names against a formulary, check doses and units for plausibility, compare with the active medication list and known allergies, and highlight discrepancies.
- **Negation and temporality:** "denies chest pain" must not become "chest pain"; "history of" must not become current.
- **Laterality and numbers:** left versus right, measurements and dates verified against the transcript.
- **Completeness checks:** required template sections present; follow-ups mentioned in conversation captured.
- **Contradiction checks** against the existing record.

Items failing checks appear as highlighted warnings in the review UI.

## Step 5: The clinician review experience

Design for speed and safety. Show the draft beside the transcript with evidence highlighting, mark low-confidence and flagged items, make edits trivial, and require an explicit signature. Track what clinicians change: edit rates by section reveal quality problems. Avoid **automation bias**: do not make accepting a flagged item easier than reading it; occasionally present known-error test drafts to measure reviewer attentiveness in evaluation environments.

## Step 6: Privacy and security

- **Consent and transparency** for recording; per-site policy and local law (including all-party consent rules).
- **Minimum necessary:** retrieve only the EHR data needed for the encounter; redact identifiers where models do not need them.
- **Vendors and models:** run in a compliant environment with a business associate agreement, no retention or training on patient data, regional processing; consider private deployment.
- **Access control** by role and relationship to the patient, break-glass auditing, full audit logs.
- **Encryption** of audio, transcripts and notes in transit and at rest; short retention of raw audio.
- **Patient rights:** access, correction and deletion handling consistent with regulation and medical record retention rules.

## Step 7: Evaluation and governance

Evaluate with clinicians: note quality rubrics (accuracy, completeness, concision, usefulness), error taxonomy with severity (omissions, hallucinations, wrong attributions, harmful errors), comparison against clinician-written notes, and time saved. Run pilots with close monitoring, track edit distance and the rate of serious errors caught in review, and define a rollback trigger. Clinical safety governance reviews changes (models, prompts, templates), includes a clinical safety officer, keeps a hazard log and monitors incidents. Test across specialties, languages, accents, and patient groups for equity of performance.

## A worked example

**Scenario:** a primary care visit about persistent cough, with the patient mentioning a new medication.

1. After consent, the assistant transcribes the conversation with clinician and patient separated and pulls the active medications and allergies from the EHR.
2. Extraction finds: cough for three weeks, no fever ("denies fever"), a recent start of an ACE inhibitor (patient-reported), exam findings dictated by the clinician, and a plan to switch the medication and review in two weeks.
3. The note is rendered in the clinic's SOAP template. Each statement links to transcript evidence; "denies fever" is correctly negated.
4. The verifier flags that the patient said "ten milligrams" but the transcript audio around the drug name is unclear; the draft shows "[drug: unclear, dose 10 mg: please confirm]" instead of guessing.
5. The clinician confirms the drug from the EHR, edits one sentence and signs. The edit and the flag resolution are logged; audio is deleted after 24 hours per policy.

## Enterprise practice (verified October 2026)

**Basics.** Capture the visit, transcribe, draft a structured note, let the clinician review and sign (steps above).

**Market and regulatory picture (secondary sources, October 2026; verify with counsel and the FDA text).**

- **Adoption is mainstream.** Doximity's 2026 survey reports **29% of physicians** using voice-based documentation tools (up from 20% in April 2025). Major EHR vendors now ship their own ambient scribe and at least one offers it at no charge to customers, so a build-versus-buy decision must compare against a bundled feature.
- **FDA.** Tools that only draft notes for clinician review are generally treated as workflow tools, not regulated devices. Features that suggest diagnoses, recommend treatment or **auto-populate billing codes without clinician review** can move the product toward Software as a Medical Device. The January 2026 final CDS guidance update is the document to read; keep the product on the documentation side of that line deliberately.
- **HIPAA.** An ambient tool that handles protected health information is a **business associate**; a signed BAA is required before any PHI flows, along with encryption, access control, audit logs and training. Model providers and every subprocessor in the chain need coverage.
- **Recording consent.** Class actions filed in 2026 allege ambient recording without valid consent under state wiretap laws (California CIPA exposure is reported at up to $5,000 per recording). Capture patient consent explicitly in the workflow and in two-party-consent states announce the recording.

**Enterprise pattern.** Clinician-in-the-loop sign-off with edit-rate tracking, source-linked notes (each statement traceable to transcript text), per-specialty evaluation by clinicians, hallucination audits on sampled notes, and an EHR write-back path through the vendor's supported APIs rather than screen automation.

## Common mistakes

- **Free-form generation** with no evidence linking or verification.
- **Guessing unclear audio** instead of flagging it.
- **Dropping negation and temporality** in extraction.
- **No clinician sign-off step**, or one designed so flags are easy to ignore.
- **Treating privacy as a vendor checkbox** rather than designing data minimisation and retention.
