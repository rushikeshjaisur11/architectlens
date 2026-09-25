---
title: "Fanout Strategies for News Feeds: Push vs. Pull"
short_title: "Fanout Strategies"
tags: ["feeds", "realtime", "fanout", "social"]
sources:
  - "Twitter/X engineering blog, posts on timeline architecture and fanout"
  - "Facebook engineering blog, posts on News Feed backend architecture"
---

## The core problem a social feed has to solve

A news feed shows each user a timeline of content from people or things they follow, ordered roughly by recency (or relevance). The naive implementation — at read time, query "all posts from everyone this user follows, sorted by time" — is a join across potentially thousands of followed accounts, computed fresh on every single feed load. This is the problem fanout strategies solve: deciding *when* the work of assembling a feed gets done, not just how.

## Fanout-on-write (push model)

When a user posts, the system immediately writes that post into the precomputed timeline of every one of their followers. Reading a feed then becomes a fast, simple lookup — the user's timeline is already assembled and sitting in storage, ready to serve.

**Strength:** feed reads are fast and cheap, which matters enormously since feeds are read far more often than posts are created (a classic read-heavy access pattern).

**Weakness:** it doesn't scale to accounts with very large follower counts. A celebrity with 50 million followers posting once means 50 million writes — fanning out a single post takes real time and resources, and can create a backlog where followers don't see a new post for a noticeable delay after it's published. This is often called the **celebrity problem** in feed architecture literature.

## Fanout-on-read (pull model)

Posts are stored once, indexed by author. When a user loads their feed, the system queries all followed authors' recent posts at read time and merges them into a timeline on the fly.

**Strength:** posting is cheap and instant regardless of follower count — a celebrity's post is one write, full stop.

**Weakness:** reads become expensive, especially for a user following many accounts, since assembling a feed means querying and merging across all of them on every load — the exact cost the push model was designed to avoid, just shifted from write time to read time.

## The hybrid approach almost every large-scale feed actually uses

Because push and pull have opposite strengths and weaknesses, and follower-count distribution in real social graphs is extremely skewed (most accounts have modest follower counts; a tiny number have millions), production systems typically use both, chosen per-author based on follower count:

- **Regular accounts (below some follower threshold): fanout-on-write.** Their posts get pushed to followers' precomputed timelines immediately, keeping reads fast for the overwhelming majority of accounts.
- **High-follower accounts (celebrities, above the threshold): fanout-on-read.** Their posts are *not* pushed to millions of timelines; instead, when a follower loads their feed, the system separately fetches recent posts from any celebrities they follow and merges them in at read time, alongside the precomputed portion from regular accounts.

This hybrid gets the fast-read benefit for the common case while avoiding the celebrity-post write storm for the rare, expensive case — a direct application of designing for the actual shape of the access-pattern distribution rather than a single strategy applied uniformly.

## Where the precomputed timeline actually lives

Fanout-on-write's precomputed timelines are typically stored in a fast key-value store or cache (Redis, or a similar low-latency store) keyed by user ID, holding a bounded-length list of recent post IDs (not full post content, which is fetched separately by ID when the feed is rendered) — bounding the list length keeps the per-user storage cost predictable regardless of how long the user has had an account, with older entries trimmed or aged out.

## A worked example

**Scenario:** a social app with 100 million users, where 0.01% of accounts (10,000 of them) have over 1 million followers each.

- **Threshold-based hybrid fanout**: accounts under 1 million followers use fanout-on-write, pushing new posts into followers' precomputed Redis timeline lists immediately on post creation — this covers the overwhelming majority of the 100 million accounts and keeps their followers' feed reads fast.
- **The 10,000 celebrity accounts** are excluded from push fanout entirely; their posts are stored normally but not pushed anywhere. When any user's feed is assembled, the read path separately checks which celebrities (if any) that user follows and fetches their recent posts directly, merging them with the precomputed portion.
- **Why this specific threshold matters**: without it, a single post from a 10-million-follower account would trigger 10 million writes, potentially delaying delivery to followers of *every* account in the write queue behind it — the threshold isolates the expensive case so it can't degrade the common case's performance.

## Common mistakes

- **Using pure fanout-on-write without a celebrity threshold**, and discovering the write-queue backlog problem only once a high-follower account actually appears on the platform and posts something that goes viral — by which point the fix is an urgent production incident rather than a planned design decision.
- **Using pure fanout-on-read for a mostly-normal-follower-count user base**, paying an unnecessary per-read merge cost on every single feed load when the vast majority of accounts would have been well served by cheap precomputed timelines.
- **Forgetting that precomputed timelines need bounding and eventual trimming.** An unbounded per-user timeline list grows indefinitely with account age and follow count, quietly increasing storage cost and lookup size — most production systems cap it at a few hundred to a couple thousand recent entries, relying on fanout-on-read-style fallback queries for anything older that a user scrolls back to.
