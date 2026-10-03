---
title: "Designing an Intelligent Document Processing Pipeline"
short_title: "Intelligent Document Processing"
tags: ["idp", "extraction", "ocr", "validation", "human-in-the-loop", "design"]
sources:
  - "Public documentation of OCR, layout analysis and document understanding services"
  - "Xu et al., 'LayoutLM: Pre-training of Text and Layout for Document Image Understanding' (2020)"
  - "Public guidance on straight-through processing and confidence-based human review"
  - "Document parsing and OCR benchmark summaries, 2026 (secondary: reducto.ai, aimultiple.com, intuitionlabs.ai); vendor-run benchmarks"
  - "RealDocBench and PureDocBench (arXiv 2606.07401, 2605.07492)"
---

## The problem

Businesses run on documents: invoices, forms, contracts, claims, IDs, bank statements. Turning them into structured data by hand is slow and costly, and templates break when formats change. An **intelligent document processing (IDP)** pipeline classifies documents, extracts fields and tables, validates them against business rules and routes uncertain cases to people, aiming for high **straight-through processing** with auditable accuracy.

## Step 1: Requirements

- **Inputs:** scans, photos, PDFs, emails, in many layouts and languages.
- **Outputs:** structured records (fields, line items, tables) with confidence and source locations.
- **Accuracy:** field-level targets, high precision on critical fields (amounts, account numbers).
- **Straight-through rate:** the share handled with no human touch.
- **Latency:** seconds for interactive capture, minutes for batches.
- **Compliance:** audit trail, retention, redaction, access control.
- **Scale (example):** 2 million documents per month, 40 document types.

## Step 2: Pipeline stages

1. **Ingestion:** collect from email, uploads, scanners and APIs; deduplicate; store originals immutably.
2. **Pre-processing:** deskew, denoise, split multi-document bundles, detect orientation and language.
3. **OCR and layout analysis:** extract text with positions, detect tables, headers, key-value regions and handwriting; keep per-word confidence.
4. **Classification:** identify the document type and version (invoice, purchase order, ID).
5. **Extraction:** pull fields and tables using a layout-aware model or an LLM or vision-language model guided by a schema.
6. **Validation and enrichment:** apply business rules, cross-field checks, lookups against master data.
7. **Confidence scoring and routing:** auto-accept, send to review, or reject.
8. **Human review:** a UI showing the document beside the extracted values.
9. **Export and learning:** write to downstream systems; capture corrections as training data.

## Step 3: Choosing the extraction approach

- **Template and rule-based:** reliable for fixed formats, brittle to variation.
- **Layout-aware ML models:** trained on documents with positional features; strong on semi-structured documents; need labelled data per type.
- **LLM and vision-language extraction:** flexible, handle unseen layouts with a schema and instructions, fewer labels needed; cost, latency and hallucination risk require validation.
- **Hybrid:** use a cheap specialised model for common high-volume types, an LLM for the long tail and for hard cases, with consistent schemas and validators.

Always extract into a **typed schema** (JSON with types and formats), and return the **source location** of each value so reviewers and auditors can verify it.

## Step 4: Validation is where accuracy comes from

Raw extraction errors are caught by checks:

- **Format and type:** dates parse, amounts are numeric, IBANs pass checksums.
- **Cross-field consistency:** line items sum to the total, tax equals rate times net, dates are in a sensible order.
- **Reference data:** vendor exists, purchase order is open and amounts within tolerance, currency matches.
- **Duplicate detection:** same invoice number and vendor.
- **Anomaly detection** against history.

Failed checks lower confidence or trigger review. Validators are cheaper and more reliable than hoping the model is right.

## Step 5: Confidence and human review

Combine OCR confidence, model confidence, validation results and field criticality into a decision per document. Calibrate thresholds against human-labelled outcomes so that "high confidence" really means a target accuracy, such as 99.5 percent on amounts. Design the review tool for speed: highlight the source region, pre-fill fields, keyboard navigation, show only uncertain fields. Measure time per document and corrections per field. Sample auto-accepted documents for **quality audit** to detect silent errors.

## Step 6: Learning loop

Every correction is a labelled example. Feed them into evaluation sets and, where appropriate, fine-tuning or few-shot example selection. Track accuracy per document type, vendor and field, and prioritise improvement where volume and error rate are high. Detect **drift** such as a vendor changing layout, with alerts when confidence or validation failure rates move.

## Step 7: Architecture and scale

Process asynchronously on queues, with stages as independent workers that scale by queue depth. Use GPU workers for layout and OCR models, batched; cache by document hash to skip duplicates. Keep each document's state in a workflow so retries resume. Store originals, intermediate artifacts and results with lineage. Handle spikes (month-end invoices) with autoscaling and priorities.

## Step 8: Security and compliance

Documents contain personal and financial data: encrypt, restrict access by role, redact fields not needed downstream, set retention, and log all access. Where LLMs are used, apply data minimisation and provider agreements. Keep an **audit trail** linking each extracted value to its source region, model version, validation outcome and reviewer.

## A worked example

**Scenario:** an accounts-payable team processes supplier invoices.

1. An email arrives with a PDF bundle of three invoices; the splitter separates them and OCR returns text and positions.
2. The classifier identifies "invoice" and the supplier from the logo and header. The high-volume supplier has a specialised extraction model; an unfamiliar supplier goes to the LLM extractor with the invoice schema.
3. Validation: line items sum to 4,230.00 but the extracted total reads 4,280.00. The mismatch lowers confidence, and a character-level re-read of the total finds 4,230.00 (OCR had confused 3 and 8).
4. Vendor master lookup matches the supplier; the purchase order is open with remaining value above the invoice. Confidence is high; the invoice posts automatically.
5. A second invoice with a new bank account for a known vendor is flagged as an anomaly and routed to review, where a person confirms it with the vendor; the correction and decision are recorded for audit.

## Enterprise practice (verified October 2026)

**Basics.** Ingest, classify, extract fields, validate, route exceptions to humans (steps above).

**The extraction landscape in 2026 (benchmarks mostly run by vendors; verify on your documents).**

- **Vision-language models now compete with classic OCR.** Aggregators report frontier models (GPT-5.x, Claude, Gemini 3) matching or beating legacy OCR on handwriting (reported figures in the low to mid 90s percent for several models) and leading some invoice benchmarks (one 2026 comparison reported Gemini 3 Pro about 94.8% versus Azure Document Intelligence about 90.5%).
- **Tables are the hard part.** One vendor's open table benchmark (RD-TableBench, 1,000 complex tables) reported about 90% for its own parser versus roughly 83% Azure Document Intelligence, 81% AWS Textract and 65% Google Document AI, so ranking depends heavily on the benchmark owner and document type.
- **Research benchmarks now stress real regulated documents** (RealDocBench: field-level question answering and layout on real-world regulated documents; PureDocBench: clean, degraded and real-world settings), and papers ask whether separate OCR is still needed when multimodal models read pages directly.

**Enterprise pattern.** Choose the extractor by a bake-off on 200 of *your* worst documents (scans, stamps, multilingual, tables), scoring field-level accuracy. Use confidence and cross-checks: totals that must sum, dates that must parse, IDs checked against master data; send low-confidence fields to human review and feed corrections back as evaluation data. Keep the original page image and the extracted value side by side for audit, store model and version per extraction, and budget cost per page (a vision model on every page can be dearer than layout OCR plus a model only on hard pages).

## Common mistakes

- **Trusting model output without validation rules.**
- **Uncalibrated confidence**, so auto-accepted documents hide errors.
- **No source locations**, so reviewers and auditors cannot verify quickly.
- **Per-template engineering** that cannot cope with new layouts.
- **Ignoring the correction loop** as a source of training and evaluation data.
