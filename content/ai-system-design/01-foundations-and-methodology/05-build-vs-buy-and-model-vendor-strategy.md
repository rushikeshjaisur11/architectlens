---
title: "Build vs Buy and Model Vendor Strategy"
short_title: "Build vs Buy and Vendor Strategy"
tags: ["build-vs-buy", "vendor", "strategy", "lock-in", "procurement", "design"]
sources:
  - "Public pricing and licensing documentation of major model providers and open-weight model licences"
  - "Gartner-style guidance on generative AI sourcing options (publicly summarised)"
  - "Fowler, articles on evolutionary architecture and avoiding lock-in"
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

## Common mistakes

- **Building what is commodity** because engineers prefer it.
- **Buying without checking data terms** and residency.
- **No abstraction layer**, making vendor changes a rewrite.
- **Comparing sticker prices only**, ignoring operations and switching cost.
- **Choosing once and never revisiting** as prices and models shift.
