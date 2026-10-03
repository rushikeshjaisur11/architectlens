---
title: "Designing an Enterprise Search Copilot"
short_title: "Enterprise Search Copilot"
tags: ["enterprise-search", "copilot", "connectors", "permissions", "federated", "design"]
sources:
  - "Public documentation of enterprise search and workplace copilot products on connectors and permission models"
  - "Microsoft Graph and Google Workspace API documentation on access control lists and change notifications"
  - "Hybrid retrieval and reranking literature (see the semantic search lesson)"
---

## The problem

Company knowledge is scattered across email, chat, documents, wikis, tickets, CRM and code. An **enterprise search copilot** lets an employee ask a question and get an answer assembled from **everything they are allowed to see**, across all those systems, with sources. It combines federated ingestion, permission-aware search and generative answers, and its hardest problems are connector breadth, permission fidelity and relevance across very different content types.

## Step 1: Requirements

- **Coverage:** connectors for dozens of systems; both structured and unstructured content.
- **Permissions:** results respect each source system's access rules, including group membership, sharing links and revocations.
- **Relevance:** the right result for ambiguous queries ("Q3 plan"), using people, recency and context.
- **Answers:** grounded summaries with citations, plus classic ranked results.
- **Freshness:** changes visible within minutes; deletions and permission removals faster.
- **Scale (example):** 100,000 employees, 500 million items, 30 connected systems.

## Step 2: Architecture

- **Connectors:** per-source adapters that crawl and subscribe to changes, mapping content and ACLs into a common schema.
- **Normalisation:** convert to a unified document model: text, title, author, timestamps, type, source, URL, ACL, relationships.
- **Index:** a hybrid index (keyword and vector) with ACL and metadata filters, plus a **people and relationship graph**.
- **Query service:** understands the query, applies the user's identity, retrieves, reranks and assembles answers.
- **Answer generation:** LLM with retrieved passages and citations; guardrails and abstention.
- **Admin and governance:** connector status, audit, retention, sensitivity labels.

## Step 3: Connectors that last

Connectors are the bulk of the work. Each must handle authentication (service accounts or delegated OAuth), **incremental sync** via change feeds, rate limits, pagination, deletes, large files and schema quirks, and report health. Provide a framework with shared retry, backoff, checkpointing and monitoring so adding a source is mostly mapping fields. Support both **crawl-based** indexing (copy and index) and **federated** search (query the source live) for systems where copying is not allowed or content changes too fast; blend results by relevance.

## Step 4: Permissions, the central problem

An employee must never see content they cannot open in the source. Approaches:

- **Index ACLs with each document** (users, groups, and sharing links) and filter at query time using the user's resolved identity and groups. Needs a fast, current **group membership resolution** service and handling of nested groups.
- **Query-time permission check** against the source for candidate results (a verification step) to catch stale ACLs, at the cost of latency; use for sensitive sources.
- **Permission changes** (revocation, someone leaving a group) must propagate quickly; on doubt, deny.
- **Sensitivity labels and compliance:** honour data classification, legal holds and regional restrictions.

Test permissions continuously with canary documents and synthetic users.

## Step 5: Relevance across content types

Different sources have different signals. Combine:

- **Hybrid text and semantic matching** with reranking.
- **Source and type priors:** an official policy page may outrank a chat message.
- **Freshness and recency:** especially for projects and incidents.
- **People signals:** documents authored or recently viewed by the user and their team; "who knows about X" from authorship and activity.
- **Personalisation:** the user's role, department and projects, with privacy care.
- **Click and feedback learning:** learn from interactions where permitted.
- **Query understanding:** expand acronyms and internal jargon with a company glossary; detect intents like "find a person" or "find a file".

## Step 6: Answers and agents

For questions, retrieve top passages from multiple sources, generate a concise answer with citations, and show source cards. For ambiguous questions, show disambiguation. Consider **actions** (create a ticket, schedule a meeting) through governed tools with approval, while respecting the permission model. Conflicting sources should be shown with dates and authors rather than blended.

## Step 7: Operations and quality

Monitor sync lag, connector errors, index size, query latency, zero-result rate, answer citation accuracy and permission test results. Evaluate with judged queries from real users, stratified by source and query type; use click and reformulation signals; track "no answer" cases to find content or connector gaps. Provide admins with controls to exclude sources, set retention and review audit logs.

## A worked example

**Scenario:** a sales manager asks "what is the status of the Acme renewal and who's on the account team?"

1. The query is classified as a status question about an account entity, with a people component.
2. Retrieval runs across CRM records, the account's shared folder, recent email threads and chat messages, all filtered by the manager's identity; a restricted legal note about the account is invisible to them.
3. The CRM record (official stage: "negotiation"), a recent thread about pricing and a meeting note are ranked highest; the people graph identifies the account owner and two solution engineers from CRM roles and recent activity.
4. The copilot answers: "Renewal is in negotiation, with a decision expected by the 28th (CRM, updated yesterday; email thread with the customer). Account team: …" with citations to each source and a note that the CRM and a chat message disagree on the discount.
5. A nightly permission audit uses a synthetic user without access and confirms none of the account's restricted documents appear in any result.

## Common mistakes

- **Ignoring permissions** until the connector count is high.
- **Stale ACLs** after group or sharing changes.
- **One relevance model for every source**, ignoring source quality and recency.
- **No connector health monitoring**, so silent sync failures go unnoticed.
- **Blending conflicting sources** into one confident answer.
