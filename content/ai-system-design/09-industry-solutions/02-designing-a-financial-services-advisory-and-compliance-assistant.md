---
title: "Designing a Financial Services Advisory and Compliance Assistant"
short_title: "Financial Services Assistant"
tags: ["finance", "banking", "advisory", "compliance", "audit", "suitability", "design"]
sources:
  - "Federal Reserve and OCC, SR 11-7 Guidance on Model Risk Management (2011)"
  - "Public regulator guidance on communications record-keeping and suitability obligations (for example FINRA and MiFID II overviews)"
  - "Regulation (EU) 2024/1689 (EU AI Act) overview of high-risk categories such as creditworthiness"
---

*Engineering patterns only; regulatory obligations vary by jurisdiction and product and must be confirmed with compliance and legal.*

## The problem

Banks and wealth managers want assistants that help **customers** (account questions, product explanations) and **staff** (relationship managers preparing meetings, compliance analysts reviewing communications). The environment is unforgiving: advice must be suitable and not misleading, communications are recorded and supervised, personal financial data is sensitive, and some uses (credit decisions) are classed as high risk. The design priority is **controlled, evidenced, auditable** assistance rather than open-ended chat.

## Step 1: Requirements

- **Use cases:** customer service (balances, transactions, fees), product information, advisor copilot (meeting prep, summaries, drafting), compliance surveillance, regulatory Q&A.
- **Accuracy and fairness:** figures come from systems of record; product information matches approved disclosures; no misleading or unsuitable recommendations.
- **Compliance:** supervision, record-keeping, approved language, disclosure rules, conflicts of interest.
- **Security and privacy:** strong authentication, least privilege, data residency, retention.
- **Auditability:** reconstruct who saw what, which sources and rules applied.
- **Scale (example):** 2 million customers, 8,000 staff.

## Step 2: Segment by risk

Not all assistance carries the same risk:

- **Informational and servicing** (what is my balance, explain this fee): low to medium risk; ground in systems of record and approved content.
- **Advisor productivity** (summarise a client file, draft a meeting note): medium risk; human advisor remains responsible and reviews.
- **Advice and recommendations** to customers: high risk; regulated; usually restricted to **human advisors** with the AI preparing, not delivering, advice, unless the product is a licensed, supervised robo-advice service with deterministic suitability logic.
- **Decisions about credit, pricing or eligibility:** high risk, subject to fairness and explainability rules; the model must not be the decision-maker.

Architect the system so higher-risk functions get stricter controls, or are excluded.

## Step 3: Grounding and numbers

Customer-facing statements about money must be **correct**. Fetch balances, transactions, rates and fees from the authoritative services at request time and render figures from structured data, not from model-generated text. Product explanations use retrieval over **approved, versioned content** (product guides, disclosures, terms) with citations and effective dates. For calculations (interest, projections), call deterministic tools; the model explains results, it does not compute them. If sources do not cover the question, route to a human with a summary.

## Step 4: Suitability and recommendation safeguards

Where recommendations are in scope:

- **Deterministic suitability engine:** an auditable rules or model-based component that checks the customer's profile, risk tolerance, objectives and product constraints; the LLM presents and explains its outputs rather than choosing products.
- **Required disclosures** inserted programmatically and verified present.
- **Prohibited content** filters: guarantees of returns, misleading comparisons, unapproved claims, tipping-off, market manipulation language.
- **Conflict and fairness controls:** no steering toward products for the firm's benefit contrary to the customer's interest; monitor recommendation distributions across customer groups.
- **Human sign-off** by a licensed advisor for advice.

## Step 5: Compliance and supervision

Treat the assistant's interactions as **regulated communications**:

- Store every customer interaction and every advisor-facing draft with timestamps, identities, sources and versions, in tamper-evident, retention-compliant storage, searchable for audits and complaints.
- **Surveillance:** run post-hoc and real-time monitors for risky patterns in assistant outputs and in advisor use (promissory language, off-channel behaviour, data leakage).
- **Approved-language libraries** for scripted situations (complaints, vulnerable customers), with escalation.
- **Supervisory review workflows** and sampling by compliance.
- **Vulnerable customer** detection and handling per policy.

## Step 6: Security and data protection

- Strong customer authentication before any account access; step-up for sensitive actions.
- **Per-request authorisation:** the assistant sees only the authenticated customer's data; staff assistants respect entitlements and information barriers (Chinese walls) between divisions.
- **Data minimisation and redaction** before model calls; private or region-bound deployments for regulated data; vendor controls and no training on customer data.
- Prompt-injection protection for content from emails and documents; tools limited to read-only unless a transaction flow with confirmation and authentication is explicitly designed.
- Transaction initiation (payments, transfers) is out of scope for free-form agents; if offered, use explicit confirmation screens and fraud controls, outside the model.

## Step 7: Model risk and governance

Apply the firm's **model risk management**: inventory the assistant, classify its tier, validate performance and fairness, document limitations, monitor in production and control changes, as in the model risk lesson. Maintain explainability suited to the use: citations for informational answers, rule-based reasons for suitability. Keep human oversight with measured override rates. Prepare for regulatory examinations with ready evidence packs.

## Step 8: Evaluation

Build golden sets from real queries with verified answers (numbers, policies, product facts), compliance-reviewed scenarios (what the assistant must refuse or escalate), adversarial tests (attempts to elicit advice or leak data), and fairness tests. Track factual accuracy, grounding, refusal correctness, escalation precision, complaint rates, satisfaction and compliance exceptions. Gate releases on these.

## A worked example

**Scenario:** an advisor copilot prepares a quarterly review meeting for a wealth client.

1. The advisor opens the client's file; the copilot, using the advisor's entitlements, retrieves the portfolio holdings, performance, recent communications and the documented risk profile.
2. It drafts a meeting brief: performance versus benchmark (figures rendered from the portfolio system, not generated), notable changes, topics raised in the last meeting, and open actions.
3. The advisor asks for talking points on a concentrated technology position. The copilot retrieves approved research and firm policy on concentration, and lists considerations with citations; it does not recommend a trade.
4. The suitability engine separately flags that the portfolio exceeds the client's stated risk limit in one asset class; the advisor sees this as a rules-based finding with the policy reference.
5. After the meeting, the copilot drafts the note and follow-up email using approved language and required disclosures; the advisor edits and approves, and everything is archived for supervision.

## Common mistakes

- **Model-generated numbers** in customer-facing responses.
- **Letting the assistant make or imply recommendations** outside a supervised suitability framework.
- **No records or surveillance** of AI-assisted communications.
- **Ignoring entitlements and information barriers** in staff tools.
- **Treating the assistant as exempt** from model risk governance.
