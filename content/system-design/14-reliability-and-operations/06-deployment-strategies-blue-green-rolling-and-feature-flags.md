---
title: "Deployment Strategies: Blue-Green, Rolling and Feature Flags"
short_title: "Blue-Green, Rolling and Feature Flags"
tags: ["deployment", "release", "reliability", "operations", "feature-flags"]
sources:
  - "Humble and Farley, Continuous Delivery (2010)"
  - "Martin Fowler, articles on BlueGreenDeployment, CanaryRelease and FeatureToggle"
  - "Kubernetes documentation on Deployments and rolling updates"
---

## The goal: change production without hurting users

Every deployment is a controlled risk. The strategies below differ in how much of the system is exposed to a new version at once, how fast you can undo it, and how much extra capacity they need.

## Recreate (the baseline)

Stop the old version, start the new one. Simple, but there is downtime between the two. Acceptable for internal tools and maintenance windows, not for user-facing services.

## Rolling deployment

Replace instances gradually: take a few out of service, update them, return them, repeat. At any moment the fleet is a **mix of old and new versions**.

- **Pros:** no extra infrastructure, no downtime, built into most orchestrators.
- **Cons:** rollback is another rolling update, so it is slow; old and new versions run side by side, so they must be **compatible** with each other and with shared data; and a bad version reaches a growing share of users while it rolls out unless health checks halt it.

Key settings are how many instances can be unavailable at once and how many extra can be created temporarily (surge), trading speed against capacity.

## Blue-green deployment

Maintain **two full environments**. Blue serves live traffic; green holds the new version. After testing green with synthetic or internal traffic, the router flips all traffic to green in one step. Blue is kept idle as an instant rollback target.

- **Pros:** near-instant cutover and rollback, and the new version can be thoroughly verified before it sees users.
- **Cons:** double the infrastructure during the switch, and the cutover exposes **all users at once**. Database changes are the hard part, since both environments usually share one database.

## Canary release

Send a **small percentage of real traffic** (say 1 to 5 percent) to the new version, watch error rate, latency and business metrics against the old version, then widen in steps (5, 25, 50, 100) if healthy. If metrics regress, route everything back.

- **Pros:** limits the blast radius of a bad release to a small slice of users, using real traffic.
- **Cons:** needs good metrics and a router that can split traffic, and the automatic comparison must be reliable or you will promote bad builds or roll back good ones.

Canary and rolling can be combined: roll out gradually with automated checks between steps.

## Feature flags

A feature flag separates **deploying code from releasing a feature**. The new code ships to production switched off. A runtime configuration then turns it on for internal users, a percentage, a region or a specific customer.

Benefits: turn something off instantly without redeploying, run experiments, do gradual rollouts independent of the deployment mechanism, and merge unfinished work to the main branch safely (trunk-based development).

Costs to manage: flags are **debt**. Each one multiplies the combinations of behaviour that need testing. Remove flags after launch, keep an owner and expiry on each, and avoid nesting flags that depend on one another.

## The database is the hard part

All of these strategies run two versions of the code against one schema, at least briefly. The safe approach is the **expand and contract** pattern:

1. **Expand:** add the new column or table in a backward-compatible way. Old code ignores it.
2. **Migrate:** deploy code that writes to both or reads the new one; backfill data.
3. **Contract:** after no running version depends on the old structure, remove it.

Never ship a deploy that requires the schema change and the code change to happen at the exact same instant.

## Choosing a strategy

| Need | Good fit |
|---|---|
| Simple, low risk, small fleet | Rolling |
| Fast, clean rollback; can afford duplicate capacity | Blue-green |
| Limit blast radius with real traffic, mature metrics | Canary |
| Decouple release from deploy, control by user segment | Feature flags |

They are complementary: many teams deploy by canary and release behavior with flags.

## A worked example

**Scenario:** a new recommendation algorithm for a shopping site.

- The code ships behind a flag, **off**, via a normal canary deploy: 5 percent of servers get the build, error rates match, and it is promoted to all servers. Users see nothing different yet.
- The flag is enabled for employees, then 1 percent of users, then 10 percent, while dashboards compare click-through and latency between the flag-on and flag-off groups.
- At 10 percent, p99 latency of the flag-on group is 30 percent worse. The flag is turned off in seconds; no rollback deploy is needed. The team fixes a slow query and resumes.

## Common mistakes

- **Rolling deployments with incompatible old and new versions**, causing errors mid-rollout.
- **Blue-green with a destructive schema migration** that breaks the idle environment you wanted to roll back to.
- **Canaries with no automated comparison**, relying on someone watching a graph.
- **Flags left in forever**, creating untestable combinations.
- **Treating deploy and release as the same event**, forcing code freezes instead of controlled exposure.
