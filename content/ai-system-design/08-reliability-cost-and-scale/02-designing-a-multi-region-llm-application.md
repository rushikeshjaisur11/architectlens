---
title: "Designing a Multi-Region LLM Application"
short_title: "Multi-Region LLM Application"
tags: ["multi-region", "availability", "data-residency", "failover", "latency", "design"]
sources:
  - "Google SRE Book, chapters on managing critical state and load balancing"
  - "Public provider documentation on regional model endpoints and data residency"
  - "AWS and Google Cloud multi-region architecture guidance"
  - "AWS, 'Amazon Bedrock now supports global cross-Region inference' and cross-Region inference documentation (aws.amazon.com), via search results October 2026"
  - "Anthropic pricing documentation, data residency and regional endpoint premiums (fetched Oct 2026)"
banner:
  layout: fan
  nodes:
    - [lb, "global router"]
    - [cloud, "region A"]
    - [cloud, "region B"]
    - [cloud, "region C"]
---

## The problem

An AI product serves users around the world and must stay up when a region, a cloud zone or a model provider has trouble, while respecting rules about where data may be stored and processed. Multi-region design for classic web apps is well understood; LLM applications add **scarce regional model capacity, heavy per-request cost, large stateful indexes and data residency constraints**. The design must balance latency, availability, residency and cost.

## Step 1: Requirements

- **Availability:** survive the loss of a region or a provider; target a stated SLO (for example 99.9 percent).
- **Latency:** users routed to a nearby region; time to first token within budget.
- **Residency and compliance:** certain tenants' data must stay within a geography, including prompts, embeddings, logs and caches.
- **Consistency:** shared state (users, conversations, indexes) behaves predictably across regions.
- **Cost:** avoid paying for idle duplicate capacity everywhere.
- **Scale (example):** three regions (US, EU, APAC), 10,000 requests per second globally.

## Step 2: Topology choices

- **Active-passive:** one region serves, another stands by. Simple, cheaper, slower recovery, wasted standby capacity.
- **Active-active:** every region serves its nearby users and can absorb others' traffic. Best latency and resilience, hardest data and capacity management.
- **Regional silos with global control plane:** each region is self-contained for data and serving (ideal for residency), with a thin global layer for routing, identity and configuration.

Many LLM platforms choose **active-active with regional data silos**: users are pinned to a **home region** by data policy, traffic normally stays there, and failover is allowed only where policy permits.

## Step 3: Routing

Use geo-aware DNS or an anycast edge to send users to the nearest healthy region, honouring a per-tenant **home region** rule. Health-based failover removes a region from rotation when synthetic probes and real error rates degrade. For residency-bound tenants, failover targets are limited to other approved regions; if none exists, the product **degrades** (read-only, cached answers, a clear message) rather than violating policy.

## Step 4: The model layer across regions

Model access is often the scarcest resource:

- **Regional model endpoints:** call a provider endpoint in the same region as the application to cut latency and keep data in-region.
- **Capacity and quotas** are per region and per provider; one region can run out while another has headroom. The gateway tracks remaining capacity and **spills over** to another region or provider when allowed.
- **Multiple providers** per region, with fallback chains and evaluated equivalence of models.
- **Self-hosted capacity** in each region sized for the baseline, with provider APIs for bursts.
- **Cold-start planning:** a failover that sends a region's entire load to another must be backed by pre-provisioned or warm capacity, otherwise the survivor collapses.

## Step 5: State: databases, indexes and caches

- **Operational data** (users, settings, conversations): choose per-region primaries with replication to a permitted secondary region for disaster recovery, or a globally distributed database with region-aware placement. Decide the consistency you need and the staleness you can tolerate.
- **Vector indexes and search:** rebuilt per region from the same source documents (each region ingests independently), or replicated; indexes are large and rebuilding is slow, so replicate snapshots to standby regions.
- **Caches** are regional and disposable; never replicate caches that contain regulated data across borders.
- **Queues and jobs:** regional, with idempotent processing so failover replays are safe.
- **Configuration, prompts and policies:** replicated globally and versioned; applied identically everywhere.

## Step 6: Failure modes and degradation

Plan for graded failures, not just total outages:

1. A provider's regional endpoint is slow: shift traffic to another provider in the region.
2. A region's model capacity is exhausted: spill over to a permitted region, or queue and shed low priority work.
3. A whole region is down: fail over home-region users to the backup region where permitted, show reduced features otherwise.
4. The vector index is unavailable: fall back to keyword search or cached answers with a notice.

Make degradation modes explicit product behaviour with tests, and rehearse with **game days** that simulate region and provider loss.

## Step 7: Observability and operations

Track availability, latency and error rates **per region and per provider**, capacity headroom, failover events, replication lag, and the amount of traffic served outside its home region (a residency metric that should be near zero). Use synthetic probes from user locations. Roll out changes region by region with canaries, never everywhere at once. Document runbooks for failover and failback, including how to drain traffic safely and how to confirm data consistency afterwards.

## A worked example

**Scenario:** the EU region's primary model provider endpoint starts timing out during European business hours.

1. Health checks show the EU endpoint's error rate at 25 percent; the circuit breaker opens and the gateway shifts EU traffic to the second provider's EU endpoint, which has been evaluated as quality-equivalent.
2. That endpoint's quota is 70 percent used. To avoid exhausting it, the gateway queues batch jobs and keeps interactive traffic flowing.
3. Residency rules prevent spilling EU tenants' prompts to US endpoints; for a tenant with a US-allowed policy, overflow is sent to the US region with the data classification checked first.
4. The status page shows degraded latency, not an outage; the share of out-of-region traffic stays at 0.4 percent, all from permitted tenants.
5. When the primary recovers, traffic shifts back gradually, and the post-incident review adds a rule to pre-warm the second provider's quota before European mornings.

## Enterprise practice (verified October 2026)

**Basics.** Active-active regions, health-checked routing, replicated state, a fallback path for the model call (steps above).

**What managed platforms give you (October 2026).** Amazon Bedrock offers **geographic** cross-Region inference profiles (routing within a geography such as the US, EU, Australia or Japan) and **global** profiles (any supported commercial region). AWS states that on-demand users can see **up to 2x their in-region quota** and better resilience in demand spikes, and that customer-managed logs, knowledge bases and stored configuration stay in the **source region** while only the inference request travels over the AWS network. Reported breadth is large (a recent OpenAI model family on Bedrock is listed in more than 25 regions). Anthropic's first-party API supports `inference_geo: "us"` at **1.1x**, and Bedrock and Vertex regional or multi-region endpoints carry about a **10% premium** over global ones.

**Design implications.**

- **Choose data-residency and resilience together.** A global profile maximises capacity but may process data outside your jurisdiction; a geographic profile keeps residency but narrows failover. Make it a per-tenant policy.
- **Fail over across providers too**, not only regions: a gateway with a second model family behind the same interface handles provider-wide incidents. Keep prompts and evaluation results per model since behaviour differs.
- **State lives with the user's home region**: conversation memory, vector indexes and audit logs are region-scoped; route requests to the data, not the reverse.

## Common mistakes

- **Active-active in name only**, with no capacity to absorb a failover.
- **Violating residency during failover** through shared caches, logs or provider endpoints.
- **Assuming provider quotas** are global rather than per region.
- **Replicating huge indexes only at failover time.**
- **Never rehearsing failover**, discovering gaps during a real incident.
