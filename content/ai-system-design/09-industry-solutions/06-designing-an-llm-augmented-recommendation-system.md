---
title: "Designing an LLM-Augmented Recommendation System"
short_title: "LLM-Augmented Recommendations"
tags: ["recommendations", "two-tower", "ranking", "cold-start", "explanations", "design"]
sources:
  - "Covington, Adams and Sargin, 'Deep Neural Networks for YouTube Recommendations' (RecSys 2016)"
  - "Public documentation and papers on two-tower retrieval models and approximate nearest neighbour serving"
  - "Public research on using large language models for recommendation, explanation and cold start"
---

## The problem

Recommendation systems decide what millions of users see: products, videos, articles. Classical systems learn from behaviour (clicks, purchases) and are very effective but struggle with **new items and users (cold start), long-tail tastes, explainability and conversational preferences**. Large language models add semantic understanding of content and natural-language interaction. The practical design keeps the proven **retrieve, rank, re-rank** architecture and uses LLMs where they add value, without putting a slow, costly model in the hot path of every request.

## Step 1: Requirements

- **Relevance and business value:** engagement, conversion, satisfaction and long-term retention, not clicks alone.
- **Latency:** feed or page recommendations within roughly 100 to 200 ms.
- **Scale (example):** 100 million users, 50 million items, 50,000 requests per second.
- **Freshness:** new items recommendable within minutes; user actions reflected quickly.
- **Diversity, fairness and safety:** avoid filter bubbles, harmful content and unfair exposure.
- **Explainability and control:** why am I seeing this; let users steer.
- **Cost:** serving cost per thousand requests.

## Step 2: The classical funnel

A staged architecture narrows billions of possibilities:

1. **Candidate generation (retrieval):** from tens of millions of items, fetch a few thousand plausible ones using multiple sources: a **two-tower model** (user tower and item tower producing embeddings, with approximate nearest neighbour search), collaborative filtering, popularity, recent-interest and content-based retrieval.
2. **Ranking:** a heavier model scores hundreds to thousands of candidates with rich features (user, item, context, cross features), predicting multiple objectives (click, watch time, purchase, return).
3. **Re-ranking:** apply diversity, freshness, business rules, fairness constraints and policy filters to produce the final list.

Features and embeddings come from a feature and embedding store; training uses logged impressions and outcomes with point-in-time correct features.

## Step 3: Where LLMs help, offline first

Calling an LLM per request at this scale is too slow and costly. Use them **offline or asynchronously** to enrich data the fast models consume:

- **Item understanding:** generate rich descriptions, tags, attributes and embeddings from text and images, especially for new items with no interaction history.
- **User understanding:** summarise histories into interest profiles (with privacy care) used as features.
- **Cold start:** embed new items by content so they enter retrieval immediately; map new users' stated preferences to initial recommendations.
- **Synthetic labels and training data:** judge relevance or generate training examples for sparse domains, validated against real behaviour.
- **Semantic IDs and content-aware embeddings** to improve generalisation to the long tail.

The results are stored as features and vectors, and served by the existing low-latency stack.

## Step 4: Where LLMs help, online selectively

- **Conversational recommendation:** a user says "something light and funny for a family movie night"; an LLM parses intent into structured constraints and retrieval queries; the recommender fetches and ranks candidates; the LLM presents and explains them. The LLM is in the loop only for explicit conversational requests, where latency of a second or two is acceptable.
- **Explanations:** generate short, grounded "because you watched…" reasons from the actual signals, validated against the data so they do not invent causes.
- **Re-ranking small lists:** an LLM can re-rank or diversify the final handful using semantic judgement, for premium surfaces or sampled traffic, with strict latency budgets and fallback to the baseline.
- **Query and catalogue understanding for search-like recommendation.**

## Step 5: Evaluation

Offline metrics (recall at k, NDCG, calibration) are necessary but unreliable predictors of online impact. Use **online A/B tests** on primary business and user-value metrics, with guardrails on diversity, latency, complaints and long-term retention; watch for **novelty effects** and short-term versus long-term trade-offs. For LLM components also measure: grounding of explanations, hallucinated items (recommending something that is not in the catalogue), conversational satisfaction, cost per session and safety. Evaluate across segments (new versus returning users, regions, languages) for fairness and cold-start performance.

## Step 6: Responsible recommendation

Optimising engagement can amplify harmful or low-quality content. Add: content safety filters and policy-based demotion, diversity and exposure controls, protection for minors, avoidance of sensitive-attribute inference without consent, and transparency and controls (not interested, why this, reset history). Audit for feedback loops where the system's own exposure shapes the data it learns from, and use exploration to avoid popularity lock-in.

## Step 7: Serving and operations

Serve candidate embeddings with a vector index and a feature store with p99 latencies in single-digit milliseconds, rank on CPU or GPU with batching, cache popular lists briefly, and degrade gracefully (fall back to popularity or last known recommendations) if components fail. Monitor feature freshness, model drift, retrieval recall, latency by stage, and business metrics. Retrain on schedules and when drift triggers, with shadow and canary deployments for new models. Keep LLM-derived features versioned like any other so they can be rolled back.

## A worked example

**Scenario:** a streaming service wants better recommendations for new releases and a "describe what you want" feature.

1. Offline, an LLM generates descriptions, themes and audience tags for every title from synopsis and subtitles, and an embedding model creates content vectors. New titles are added to the item index immediately, solving cold start; retrieval gains a content-based source.
2. The two-tower retrieval still supplies most candidates; the ranker uses the new content features and improves new-title click-through by 9 percent in an A/B test, with no latency change.
3. In the conversational feature, a user types "a gentle mystery with great cinematography, nothing violent". An LLM converts it into filters (genre, mood, maturity rating) plus a semantic query; retrieval and ranking return candidates in 80 ms; the LLM writes one-line reasons using each title's real attributes.
4. A guard verifies every title in the response exists in the catalogue and is available in the user's region; the explanation text is checked against the metadata for unsupported claims.
5. Monitoring shows the conversational surface adds 1.8 seconds at p95 and 0.3 cents per session; it is enabled only for opt-in users, with the standard feed as fallback.

## Common mistakes

- **An LLM call in the hot path of every request.**
- **Judging by offline metrics alone**, without online experiments.
- **Explanations not grounded in actual signals**, inventing reasons.
- **Recommending items not in the catalogue or unavailable to the user.**
- **Optimising short-term engagement** and ignoring diversity, safety and long-term value.
