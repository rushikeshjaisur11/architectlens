---
title: "Recommendation Systems: Collaborative Filtering and Content-Based Approaches"
short_title: "Recommendation Systems"
tags: ["recommendations", "matching", "collaborative-filtering"]
sources:
  - "Netflix Technology Blog, posts on recommendation system architecture"
  - "Koren, Bell & Volinsky, 'Matrix Factorization Techniques for Recommender Systems' (2009)"
---

## The core problem: predicting what a user hasn't told you they'd like

A recommendation system predicts which items (products, videos, songs, articles) a user is likely to want, without the user explicitly searching for them — the system needs to infer preference from indirect signals (past behavior, ratings, similarity to other users or items) rather than an explicit query. This is a genuinely different problem from search (covered in this track's search and retrieval lesson), which answers an explicit query; recommendation answers an implicit one, often without any query at all.

## Collaborative filtering: "users like you also liked..."

**Collaborative filtering** predicts a user's preferences based on patterns across many users' behavior, without needing to understand anything about the items' actual content:

- **User-based collaborative filtering** — find users with similar past behavior to the target user, and recommend items those similar users liked that the target user hasn't yet interacted with. Intuitive, but computing user-to-user similarity across a large user base is expensive, and similarity computed this way can be noisy for users with sparse interaction history.
- **Item-based collaborative filtering** — instead of finding similar users, find items similar to ones the target user has already liked, based on the pattern of which other users liked both items together. Generally more stable in practice than user-based approaches, since item-to-item similarity tends to change more slowly over time than user preferences do, and item similarity can often be precomputed and cached rather than recomputed per-request.
- **Matrix factorization** — represents users and items as vectors (latent factors) in a shared low-dimensional space, learned from the sparse user-item interaction matrix (most users have only interacted with a small fraction of all items) such that a user's predicted preference for an item is approximated by the similarity (often a dot product) between their respective vectors. This is a more scalable, mathematically grounded generalization of the intuition behind both user-based and item-based approaches, and was a key technique behind the winning solution to the well-known Netflix Prize recommendation competition.

The key strength of collaborative filtering broadly: it can surface genuinely surprising, serendipitous recommendations, since it doesn't need any understanding of *why* users with similar behavior like similar things — it just needs the behavioral pattern to exist in the data. The key weakness is the **cold-start problem**: a brand-new user with no interaction history, or a brand-new item with no ratings yet, has no collaborative signal to work from at all.

## Content-based filtering: recommending by item similarity

**Content-based filtering** recommends items similar in *content* (genre, description, attributes, or an embedding of the item's actual text/features) to items a user has previously liked, without relying on other users' behavior at all. This directly solves collaborative filtering's cold-start problem for new items — a newly added item with rich content attributes can be recommended based on its content similarity to items a user already likes, even with zero interaction history of its own — but has its own limitation: it tends to recommend items very similar to what a user already likes, producing a narrower, less serendipitous set of recommendations than collaborative filtering can surface, since it has no mechanism to suggest something genuinely different that other similar users happened to enjoy.

## Hybrid approaches: combining both to cover each other's weaknesses

Because collaborative and content-based filtering have close to complementary strengths and weaknesses, most production recommendation systems combine both — using content-based signals specifically to handle cold-start cases (new users, new items) where collaborative signal doesn't yet exist, while relying on collaborative filtering's stronger, more serendipitous signal once sufficient interaction history has accumulated. The specific blend (a weighted combination, or a staged approach that falls back to content-based recommendations only when collaborative signal is too sparse) is tuned against actual engagement metrics, similar in spirit to the relevance-tuning methodology from this track's search lesson.

## A worked example

**Scenario:** a video streaming platform needs to recommend content to both established users (with substantial watch history) and brand-new users (who just signed up, with no history yet), while also handling newly-added content with no view history.

- **Established users with rich watch history** → primarily collaborative filtering (item-based or matrix factorization), since there's now enough behavioral signal to find genuinely relevant, sometimes serendipitous recommendations based on patterns across the broader user base — the approach's core strength.
- **Brand-new users** → the system falls back to content-based recommendations initially (based on genre/category preferences collected during onboarding, or popularity-weighted defaults), specifically because there's no interaction history yet for collaborative filtering to work from — this is the cold-start problem being addressed directly by content-based filtering's independence from other users' behavior.
- **Newly-added content** → boosted via content-based similarity to already-popular items in the same genre/category initially, until it accumulates enough of its own view history for collaborative signals about it to become reliable — a staged transition from content-based to collaborative-driven recommendation as data accumulates for that specific item.

## Common mistakes

- **Relying purely on collaborative filtering without a cold-start strategy**, leaving new users and new items with poor or generic recommendations until enough interaction data accumulates — a real, common gap that content-based filtering (or a simpler popularity-based fallback) exists specifically to cover.
- **Relying purely on content-based filtering**, producing an overly narrow, "more of the same" recommendation experience that never surfaces the kind of unexpected-but-relevant discovery collaborative filtering's cross-user pattern signal enables.
- **Treating a recommendation algorithm choice as a one-time decision rather than an ongoing, metric-driven tuning process.** Like search relevance (per this track's search lesson), recommendation quality benefits from continuous evaluation against real engagement data, not a single configuration chosen at launch and left unexamined as user behavior and the item catalog evolve.
