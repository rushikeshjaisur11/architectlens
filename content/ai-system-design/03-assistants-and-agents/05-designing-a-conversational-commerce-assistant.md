---
title: "Designing a Conversational Commerce Assistant"
short_title: "Conversational Commerce Assistant"
tags: ["commerce", "recommendations", "catalog", "grounding", "personalization", "design"]
sources:
  - "Public product documentation of retail and marketplace shopping assistants"
  - "Public documentation on product search, catalog enrichment and structured product data standards"
  - "Garcia-Molina and Salem, 'Sagas' (SIGMOD 1987) for multi-step order flows"
  - "Agentic commerce protocol comparisons, 2026 (secondary: digitalapplied.com, crossmint.com, mintmcp.com, wetheflywheel.com)"
banner:
  layout: line
  nodes:
    - [user, "shopper"]
    - [model, "assistant"]
    - [db, "catalog"]
    - [lock, "checkout"]
predict:
  question: "A shopper wants a waterproof jacket under $150, preferably green, but only two of the four best matches are green. What does the assistant do with the colour?"
  options: ["It treats green as a soft constraint, ranks green higher and notes the other options", "It hides every non-green jacket because the shopper named a colour", "It asks the shopper to restate the request until all four are green"]
  answer: 0
  why: "In the worked example colour is a soft constraint: green items are ranked up but not required, and the reply notes that only two are green."
check:
  - q: "Why render product cards from structured data instead of letting the model write prices and links?"
    options: ["Model-written text is slower to stream than rendered cards", "Cards let the model remember the catalogue between sessions", "Prices and links cannot be hallucinated when they come straight from data"]
    answer: 2
    why: "The lesson renders cards from structured records so that prices and links are never model-generated text."
  - q: "Why should the model propose purchase actions while deterministic services execute them?"
    options: ["Services validate parameters and apply confirmation, fraud and idempotency checks", "Models are unable to produce valid JSON for checkout calls", "Execution by the model would exceed the latency budget for a session"]
    answer: 0
    why: "The lesson says the model proposes and deterministic services execute with validated parameters, after explicit confirmation."
  - q: "Why evaluate on return rate as well as conversion?"
    options: ["Return rate is the only metric the checkout protocols report", "Conversion alone can reward pushy or unsupported claims that damage trust", "Returns measure catalogue coverage of attributes more directly"]
    answer: 1
    why: "The lesson warns that optimising only for conversion damages trust through pushy or unsupported claims."
---

## The problem

Shoppers describe what they want in words ("a waterproof jacket for light hiking under $150") and expect good recommendations, comparisons and help checking out. A conversational commerce assistant sits on top of catalogue search, inventory, pricing and orders. The danger is **making things up**: a non-existent product, a wrong price, a promise of stock that is gone. The assistant must be grounded in live commerce data and handle money-moving actions with care.

## Step 1: Requirements

- **Functional:** natural-language product discovery, comparison, questions about specs and policies, cart and order help, order status and returns.
- **Accuracy:** every product, price, availability and policy statement grounded in current data.
- **Business:** respect merchandising rules, sponsored placements disclosure, regional pricing and promotions.
- **Experience:** fast, concise, visual (product cards), with escalation to humans.
- **Trust and safety:** no unsafe product advice, no manipulative claims, honest comparisons.
- **Scale (example):** 5 million sessions a day, a catalogue of 30 million products.

## Step 2: Architecture

- **Dialogue orchestrator:** manages the conversation, intent, state and tool calls.
- **Product search service:** hybrid (keyword and semantic) retrieval with filters and facets over the catalogue.
- **Catalogue and attribute store:** normalised product data, enriched attributes, images, reviews summary.
- **Pricing, promotion and inventory services:** the **sources of truth**, queried live.
- **Recommendation and personalisation:** behavioural signals and user profile.
- **Cart, checkout and order tools:** transactional services.
- **Policy knowledge base:** returns, shipping, warranties, with citations.
- **Guardrails and analytics:** safety checks, logging, experimentation.

## Step 3: Grounding in catalogue data

The model should never "remember" products. Retrieve candidates from the search service, then present only those, reading **live** price, stock and promotions from the transactional services at response time. Provide the model with structured product records (title, key attributes, price, availability, rating) and require responses to reference product ids; render product cards from the structured data rather than from model-generated text, so prices and links cannot be hallucinated. Validate that every product mentioned exists and is in the retrieved set.

## Step 4: Understanding the shopper

- **Query understanding:** extract attributes and constraints (category, budget, size, brand, use case) into a structured search request; handle vague terms through clarifying questions ("what temperatures will you hike in?") only when needed.
- **Conversation state:** keep the evolving constraints, shown products, preferences expressed ("not too bulky") and cart contents as structured state rather than relying on transcript alone.
- **Personalisation:** use history and profile within privacy rules, with transparency.
- **Multimodal:** accept photos ("find something like this") using image embeddings.

## Step 5: Retrieval and ranking

Combine semantic retrieval for intent with keyword and attribute filters for precision; rerank by relevance, availability, margin or merchandising rules as policy allows, balanced against user value. Diversify results across price points and brands where appropriate. Fall back gracefully when constraints are too tight: offer the nearest options and say which constraint was relaxed.

## Step 6: Comparison and advice

For comparisons, generate from structured attributes and review summaries, citing the data. Avoid unsupported claims ("the best"); present trade-offs honestly. Handle sensitive categories (supplements, children's products, electrical goods) with safety rules and disclaimers. Disclose sponsored placements clearly and keep them separate from organic advice, following advertising standards.

## Step 7: Transactions

Cart and order actions go through the same APIs as the website, with identity and authorisation. For purchases, **require explicit confirmation** showing items, total, shipping and payment method; use idempotency keys; and apply fraud and risk checks. Multi-step flows (payment, inventory reservation, order creation) follow saga-style compensation. The model proposes actions; deterministic services execute them with validated parameters.

## Step 8: Evaluation and monitoring

Measure **business and quality outcomes**: relevance of recommendations (human-judged), conversion and add-to-cart rates versus control, average order value, deflection of support, but also **grounding accuracy** (price and availability correctness), hallucinated product rate, policy accuracy and complaint rates. Run online experiments with guardrails; review transcripts of abandoned conversations to find gaps. Monitor latency, cost per session and catalogue coverage of attributes.

## A worked example

**Scenario:** a shopper writes "a waterproof jacket for light hiking, under $150, in green if possible".

1. The orchestrator extracts: category jacket, feature waterproof, activity light hiking, budget 150, preferred colour green (soft constraint).
2. The search service returns 40 candidates; filters apply the budget and waterproof attribute; green items are ranked up but not required.
3. Live checks remove two out-of-stock items and update a promotional price on another; the structured records for the top four are passed to the model.
4. The assistant replies with four product cards (rendered from data) and a short comparison: weight, waterproof rating and price, noting that only two are green and one is a better value in black.
5. The shopper picks one; the assistant confirms size availability, summarises the return policy with a citation, and on "buy it" shows the order summary for explicit confirmation before calling checkout.

## Enterprise practice (verified October 2026)

**Basics.** Understand intent, search the catalogue, recommend, build a cart, hand off to checkout (steps above).

**Standards emerging in 2026 (secondary sources; confirm against each spec).** Four overlapping protocols address different layers: **ACP (Agentic Commerce Protocol)**, from Stripe and OpenAI, covers checkout, cart, orders, payment delegation and MCP integration (reported latest spec dated 2026-04-17); **AP2 (Agent Payments Protocol)**, from Google, handles payment authorisation with cryptographic *mandates* that record what the user allowed the agent to buy (reported contributed to the FIDO Alliance in April 2026); **UCP (Universal Commerce Protocol)** covers discovery, cart, checkout and post-purchase; **x402** targets stablecoin-style machine payments. They are described as layers rather than rivals: checkout through one, proof of consent through another. One reported data point on market volatility: a flagship in-chat checkout built on ACP was reportedly shut down in March 2026 while the protocol continued, a reminder not to couple your business to one surface.

**Enterprise pattern.** Keep the catalogue and pricing API as the source of truth: the model may rank and explain but must never state a price, stock level or delivery date that was not just returned by a tool. Make purchase an explicit, confirmed step with a visible summary (item, price, shipping, return terms) and store the consent record (an AP2-style mandate where available). Handle refunds, substitutions and fraud checks as server-side workflows, evaluate on conversion *and* return rate, and expose structured product feeds so third-party shopping agents can reach you too.

## Common mistakes

- **Letting the model state prices or stock** from memory.
- **Free-text product mentions** with no validation against the catalogue.
- **Placing orders without explicit confirmation.**
- **Optimising only for conversion**, damaging trust through pushy or unsupported claims.
- **Ignoring structured state**, so constraints are forgotten mid-conversation.
