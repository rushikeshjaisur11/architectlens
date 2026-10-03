---
title: "Cell-Based Architecture and Blast-Radius Control"
short_title: "Cell-Based Architecture"
tags: ["resilience", "cells", "blast-radius", "isolation", "availability"]
sources:
  - "Amazon Builders' Library, 'Workload isolation using shuffle-sharding' and AWS Well-Architected guidance on cell-based architecture"
  - "Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region, aws.amazon.com/message/101925 (fetched October 2026)"
  - "CrowdStrike, Channel File 291 Incident Root Cause Analysis (August 2024), crowdstrike.com"
---

## The problem with one big shared system

A single large deployment serving every customer has a simple failure property: when something goes wrong, **everyone** is affected. A bad deploy, a poison request, a noisy tenant or a corrupted configuration reaches all users at once. Adding capacity does not help, because the failure is correlated, not caused by load. The question for large systems is therefore not only "how do we scale?" but "how much of the world can one failure break?" That quantity is the **blast radius**.

## What a cell is

A **cell** is a complete, independent copy of the service stack (compute, data, queues, caches) serving a **subset** of customers. Cells share nothing at runtime. A thin **routing layer** maps each customer (or tenant, or shard key) to exactly one cell. If you run 20 cells and one fails, about 5% of customers are affected, not 100%.

Properties of a good cell design:

- **Independent**: no cell calls into another cell on the request path; no shared database.
- **Bounded size**: each cell has a maximum capacity; you grow by adding cells, not by growing cells, so each cell stays well-tested at a known scale.
- **Uniform**: all cells run the same code and configuration shape, so one cell is a faithful canary for the rest.
- **Thin router**: the router is the one shared component; keep it extremely simple and highly available, because it is now the critical dependency.

## Cells versus availability zones and regions

Availability zones protect against *infrastructure* failure (a data centre loses power). Cells protect against *software and data* failure (a bug, a bad config, a poison tenant) that replicates across zones. They are complementary: each cell can itself span zones.

## Deployment and change safety

Cells make staged deployment natural: deploy to one small cell first, watch health metrics for a bake time, then proceed in waves (1 cell, 3 cells, 10 cells, all). Any failing wave stops the rollout, limiting damage to the cells already touched. Two real incidents show the cost of lacking this:

- **CrowdStrike (July 2024).** A content update (Channel File 291) was delivered to all sensors globally with no staged rollout; a template with 21 input fields defined but 20 supplied caused an out-of-bounds read, crashing roughly 8.5 million Windows machines within about 78 minutes. CrowdStrike's own root-cause analysis lists "template instances deployed globally without staged rollout" among six gaps and commits to staged canary deployments and customer control of update timing.
- **AWS DynamoDB, US-EAST-1 (October 2025).** A latent race condition in the automation that manages DynamoDB's DNS records left the regional endpoint with an empty record at 11:48 PM PDT on 19 October; DNS was restored by 2:25 AM, but dependent services (EC2 instance launches, load-balancer health checks) took until the afternoon to recover, a total of about 15 hours. Beyond the specific race, the lesson is about shared control planes and the cascading dependency on one regional service.

## Shuffle sharding: smaller blast radius from the same fleet

If every customer shares every server, a poison customer can take down all. If each customer is pinned to one cell, you get isolation but low utilisation. **Shuffle sharding** assigns each customer a small random *subset* of workers (say 2 of 8). A bad customer degrades only their subset; another customer shares *both* workers with them with probability 1 in 28. With 100 workers and 5 per customer, the chance that two customers share all 5 workers is about 1 in 75 million.

## Costs and trade-offs

- **Cross-cell features** (global search, analytics, cross-customer operations) need an explicit, asynchronous path.
- **Rebalancing**: moving a customer between cells requires data migration tooling.
- **Operational overhead**: N cells means N deployments to observe; automate everything.
- **Small customers and huge customers**: very large customers may need a dedicated cell; many tiny ones share.

## A worked example

A SaaS platform with 6,000 tenants moves from one cluster to 12 cells of 500 tenants.

1. A router (a small, replicated key-value map from tenant id to cell) sends each request to its cell.
2. A faulty release is deployed to cell 1 (about 500 tenants). Error rate jumps from 0.1% to 9% within 4 minutes; the automated rollout halts and rolls back. Impact: 8% of tenants for 11 minutes, instead of 100% for an hour.
3. A tenant runs a runaway export job that saturates its cell's database; the other 11 cells are unaffected, and the tenant is moved to a dedicated cell the next day.

## Common mistakes

- **Cells that secretly share a database** or cache, which restores the shared failure mode.
- **A complex router** that becomes the new single point of failure.
- **Deploying to all cells at once** and calling it a cell architecture.
- **No bake time** between waves.
- **Ignoring shared control planes** (DNS, configuration, deployment systems) that sit above the cells.
