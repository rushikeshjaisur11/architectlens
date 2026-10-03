---
title: "Build vs Buy and Model Vendor Strategy"
short_title: "Build vs Buy and Vendor Strategy"
tags: ["build-vs-buy", "vendor", "strategy", "lock-in", "procurement", "design"]
sources:
  - "Public pricing and licensing documentation of major model providers and open-weight model licences"
  - "Gartner-style guidance on generative AI sourcing options (publicly summarised)"
  - "Fowler, articles on evolutionary architecture and avoiding lock-in"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched Oct 2026)"
  - "Google Gemini API pricing (fetched Oct 2026)"
  - "Open-weight model and licence summaries, 2026 (secondary: digitalapplied.com, lushbinary.com)"
  - "AWS, Amazon Bedrock cross-Region inference documentation, via search results (October 2026)"
banner:
  layout: fan
  nodes:
    - [doc, "decision"]
    - [cloud, "buy API"]
    - [gpu, "self-host"]
    - [shield, "risk"]
predict:
  question: "A note summariser costs about $9,000 a month via API at 200,000 notes, versus about $14,000 in GPUs plus two engineers to self-host. What happens to the analysis when volume reaches 3 million notes a month?"
  options: ["It flips: bulk work moves to self-hosted inference, with a hosted model for hard cases", "It stays with the API because self-hosting never beats per-token pricing", "It flips fully to self-hosting with no hosted fallback kept"]
  answer: 0
  why: "Per-token API cost scales with volume while self-hosting is mostly fixed, so at 3 million notes the bulk moves in-house while a hosted frontier model stays for hard cases and fallback."
check:
  - q: "Why keep an internal gateway and a quarterly evaluation of three models on your own tasks?"
    options: ["It guarantees the lowest sticker price from each vendor", "It makes switching a measured decision instead of a rewrite", "It lets the vendor handle data retention on your behalf"]
    answer: 1
    why: "A thin abstraction plus continuous evaluation on your tasks means a vendor change becomes configuration backed by data."
  - q: "Why compare total cost of ownership rather than per-token sticker prices?"
    options: ["Sticker prices are rarely published by the vendors", "Self-hosting has no GPU cost once the model is downloaded", "Engineers, on-call and switching cost change the real comparison"]
    answer: 2
    why: "Self-hosting adds engineers, on-call, evaluation and safety work, and switching cost, so list price alone misleads."
  - q: "Why keep a fine-tuned open-weight model warm on a small cluster even though APIs win on cost?"
    options: ["It serves a hospital that demands on-premises and acts as an exit path", "It lowers the API price automatically through volume tiers", "It removes the need for a data-processing agreement"]
    answer: 0
    why: "An open-weight option covers customers needing private deployment and doubles as an exit path and negotiating lever."
---

## The problem

Every AI capability can be built in-house, bought as a product, consumed through an API, or assembled from open-source parts. Models improve and reprice constantly, vendors come and go, and regulations vary by region. A **sourcing strategy** decides what to own, what to rent and how to keep options open, so the company is neither paying for needless engineering nor trapped by a vendor.

## The sourcing spectrum

From least to most ownership:

1. **Buy a finished product:** a vertical SaaS (an AI support desk, a contract-review tool). Fast, least control, vendor-defined roadmap.
2. **Use a model API:** build your application on a hosted model. Fast to start, pay per token, data leaves your boundary under contract.
3. **Use a managed platform:** a cloud provider's service for hosting and customising models inside your cloud tenancy; more control over data and network.
4. **Self-host open-weight models:** run on your GPUs or rented ones. Control over data, latency and cost at scale, but you own operations and quality.
5. **Train or heavily adapt your own models:** maximal control, highest cost and expertise bar.

Most companies mix levels, choosing per use case.

## Decision criteria

- **Differentiation:** does this capability set you apart? Build or customise what differentiates; buy what is commodity.
- **Data sensitivity and residency:** regulated or confidential data may require private deployment, specific regions or contractual guarantees such as zero retention.
- **Quality and capability:** frontier tasks may only be reachable through the best hosted models; narrow tasks may be solved by small fine-tuned ones.
- **Cost at scale:** per-token pricing is cheap at low volume and large at high volume; self-hosting has fixed costs and falls per token with utilisation.
- **Latency and availability needs:** on-device or on-premises models can win on latency and offline use; vendor SLAs may or may not meet yours.
- **Team capability:** operating GPUs, evaluation and safety requires skills; count the people and on-call burden.
- **Speed to market:** buying or using APIs can ship in weeks.
- **Risk and compliance:** vendor security posture, certifications, auditability, indemnities.
- **Strategic control:** pricing power, roadmap dependence, concentration risk.

## Total cost of ownership

Compare honestly: API cost is tokens times price plus integration. Self-hosting is GPUs (or reserved cloud), utilisation, engineers for serving and on-call, evaluation and safety work, and the opportunity cost. Include **switching cost** and the **cost of being wrong**. Rerun the comparison as volume and prices change; a decision right at 1 million tokens a day may be wrong at 1 billion.

## Avoiding lock-in without over-engineering

Models and prices change quickly, so keep a thin **abstraction layer** (an internal gateway with a common request shape) so applications do not call vendor-specific APIs directly. Keep prompts, evaluation datasets and knowledge indexes in **your** systems in open formats. Evaluate models continuously against your own tasks so switching is a measured decision rather than a rewrite. Avoid deep coupling to proprietary features (special tool formats, hosted memory) unless the benefit is large and you accept the dependency.

## Multi-vendor and multi-model strategy

- **Primary and secondary providers** for resilience; fallback chains tested for quality.
- **Model tiers by task:** a small model for classification, a mid-size for most work, a frontier model for hard cases.
- **Regional endpoints** for residency.
- **Open-weight models** as a negotiating lever and as an exit path.
- **Negotiation:** committed-use discounts, rate-limit guarantees, data-processing agreements, and notice periods for model deprecation.

## Contract and risk points

Review: data usage and retention terms (no training on your data, zero retention options), security certifications, sub-processors and regions, incident notification, availability SLAs, IP indemnification for outputs, model deprecation policy, audit rights, and exit provisions including data return and deletion. Involve legal, security and privacy early.

## A worked example

**Scenario:** a healthcare software company wants an AI note summariser inside its product.

1. Differentiation: summarisation quality in their clinical context is core, so they plan to own the prompts, evaluation set and workflow, but not necessarily the model.
2. Data: patient data is regulated; the provider must offer a business associate agreement, zero retention and regional processing. Two hosted providers qualify; one open-weight option is available for private deployment.
3. Cost: at 200,000 notes a month, API cost is about $9,000; self-hosting a fine-tuned mid-size model would cost about $14,000 in GPUs plus two engineers, so APIs win for now.
4. Strategy: an internal gateway abstracts the vendors; the evaluation suite compares three models quarterly; a fine-tuned open model is kept warm on a small cluster for a hospital customer that demands on-premises.
5. When volume reaches 3 million notes a month the analysis flips: they move the bulk workload to self-hosted inference, keeping a hosted frontier model for hard cases and as a fallback.

## Enterprise practice (verified October 2026)

**Basics.** Compare build, buy and assemble on capability, cost, control, risk and time (steps above).

**Market facts for the decision (live-checked, October 2026).**

- **Prices moved and tiers multiplied.** Anthropic lists models from Haiku 4.5 at $1/$5 per million tokens through Sonnet 5.5 at $2/$10 and Opus 5.5 at $4/$20 to a top tier at $10/$50; Gemini lists a Flash model at $0.75/$3.75 (introductory through 31 December 2026, then double) and a Flash-Lite at $0.30/$2.50. Several providers discount batch work by 50% and cached input by about 90%, so list price alone misleads.
- **Distribution is multi-cloud.** The same model families are available through the vendor API and through Bedrock, Vertex AI and Azure marketplaces; Bedrock now routes across regions with geographic and global profiles, and Anthropic's own API offers US-only inference at a 1.1x multiplier. Regional endpoints on clouds carry about a 10% premium.
- **Open weights are credible** (Gemma 4, Qwen 3.x, Mistral Small 4 and Large 3, GLM-5, gpt-oss, DeepSeek V4, Llama 4), under licences from Apache 2.0 to custom community terms, which makes on-premises and sovereign deployments feasible.
- **Retirement is routine.** Older models are retired on a published schedule (some remain only on cloud marketplaces), so plan migrations.

**Enterprise pattern.** Keep a gateway abstraction and per-model evaluation so a swap is a configuration change; negotiate commitments only after measuring usage; weigh data-residency terms and indemnities; build what differentiates you (data, evaluation, workflow integration) and buy commodity layers (inference, vector store, observability), and revisit the split yearly.

## Common mistakes

- **Building what is commodity** because engineers prefer it.
- **Buying without checking data terms** and residency.
- **No abstraction layer**, making vendor changes a rewrite.
- **Comparing sticker prices only**, ignoring operations and switching cost.
- **Choosing once and never revisiting** as prices and models shift.
