---
title: "Case Study: The AWS DynamoDB DNS Outage in US-EAST-1 (October 2025)"
short_title: "AWS DynamoDB DNS Outage 2025"
tags: ["case-study", "dns", "race-condition", "cascading-failure", "control-plane", "incident"]
sources:
  - "Amazon Web Services, 'Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region' (October 2025), aws.amazon.com/message/101925 (fetched October 2026)"
  - "Press and engineering analyses of the incident (secondary: The Register and others)"
predict:
  question: "A slow Enactor finishes applying an old plan after a faster one applied a newer plan and cleaned up old plans. What happens?"
  options: ["Its newer-than-applied check fails and the write is rejected", "The stale plan overwrites the newer one and cleanup then empties the record", "The newer plan wins because the Planner re-sends it at once"]
  answer: 1
  why: "The freshness check was made at the start and was stale when acted on, so the old plan was applied and then deleted, leaving an empty DNS record."
check:
  - q: "Why did EC2 launches stay broken after DynamoDB's DNS was restored?"
    options: ["Cached DNS records stayed wrong for the following several hours", "Route 53 needed each endpoint reconfigured by hand afterward", "Lease checks had timed out and the backlog took hours to clear"]
    answer: 2
    why: "EC2's internal control system depended on DynamoDB, so recovery of the fault lagged well behind recovery of the root cause."
  - q: "What made the Enactor's check-then-act a race?"
    options: ["The newer-plan check was stale by the time it acted", "No check was ever made before plans were applied", "The Planner issued two conflicting plans at the same time"]
    answer: 0
    why: "A decision made at the start of a long operation must be re-validated at the moment of action, for example with compare-and-swap."
  - q: "Why were health-check failovers a problem during the cascade?"
    options: ["They were too slow to remove the unhealthy capacity", "They removed healthy capacity and made the overload worse", "They never triggered because the health checks passed"]
    answer: 1
    why: "Failures in propagating network configuration triggered automatic failovers, hence the velocity limits AWS planned."
---

## What happened

Beginning at **11:48 PM PDT on 19 October 2025**, customers saw rising error rates when calling Amazon DynamoDB in the **US-EAST-1** (Northern Virginia) region. By about **12:38 AM** engineers had identified the cause as DynamoDB's DNS state, and by **2:25 AM** DNS information was restored and clients could resolve the regional endpoint again as cached records expired. But the incident did not end there: dependent services struggled for hours. Amazon EC2 instance launches recovered by about **1:50 PM** and Network Load Balancer issues were resolved around **2:09 PM**, so the full disruption lasted roughly **15 hours**, affecting a long list of services and many customers' applications built on them.

## The mechanism: automation that managed DNS

DynamoDB maintains very large numbers of DNS records (hundreds of thousands) so that clients reach a heterogeneous, constantly changing fleet of load balancers. Two components managed them:

- A **DNS Planner** watches load-balancer health and capacity and produces **plans**: the desired set of DNS records for the regional endpoint.
- Several redundant **DNS Enactors** (one per availability zone) apply plans to **Amazon Route 53**.

## The race condition

AWS's report describes a latent timing bug:

1. One Enactor began applying an older plan but ran **unusually slowly** (long delays on some endpoints).
2. Meanwhile another Enactor applied a **newer plan** quickly and completed it.
3. On completion, the second Enactor ran **cleanup of old plans**, deleting plans many generations older.
4. The slow Enactor then finished and **applied its stale plan over the newer one**, because the check "is this plan newer than what is applied?" had been made at the start of its run and was **stale by the time it acted** (the check-then-act gap).
5. The cleanup process then deleted that very (old) plan, which removed **all IP addresses for the regional endpoint**: an empty DNS record.

The system was left in an inconsistent state that **no Enactor could repair automatically**, because every later update depended on the state that had been corrupted. Human operators had to intervene.

## The cascade

DynamoDB is a dependency of many internal systems. With its endpoint unresolvable:

- **EC2's internal control system** (the droplet workflow manager that tracks leases on physical hosts) depends on DynamoDB; its lease checks timed out, so **new instances could not launch** even after DynamoDB itself recovered, and the backlog took hours to work off.
- **Network Load Balancer health checks** failed because of delays in propagating network configuration for new instances, triggering **automatic failovers** that removed healthy capacity and made things worse.
- Many other services (serverless functions, container services and more) relied on those layers.

## The lessons

- **Check-then-act on stale data is a race.** A decision made at the start of a long operation must be re-validated (compare-and-swap, versioned writes, fencing tokens) at the moment of the action.
- **Cleanup automation is dangerous.** A garbage collector that can delete the *live* state needs invariants ("never delete the plan currently applied") enforced independently of timing.
- **Make automation self-healing, or provide a safe manual path.** The state was not repairable by the same automation; operators needed tools and runbooks for exactly this class of failure, and AWS disabled the automation globally pending fixes.
- **Shared dependencies create correlated failure.** One regional service underpinned launches, health checks and more; **cell-based and static-stability designs** (data planes that keep working without the control plane) limit this.
- **Recovery can be slower than the fault.** Backlogs, leases, throttles and health-check feedback loops can extend an outage long after the root cause is fixed; design controls such as **velocity limits** (do not remove too much capacity too fast) and recovery throttling.
- **DNS is a distributed cache with TTLs.** Even after records were fixed, clients took minutes to see them.

## What AWS said it would change

Per its published summary: fix the race condition, add protections that validate DNS plans before they are applied, introduce velocity controls so that load-balancer health checks cannot remove too much capacity at once, expand EC2 scale testing, and improve throttling during recovery.

## What customers can learn

- **Know your dependencies**: a "regional" service may have a hidden single-region dependency; map them.
- **Multi-region designs must avoid control-plane dependence during failover**: if failing over requires calling the failed region's control plane, it will not work.
- **Test the failure of your cloud provider's core services** in game days and keep fallbacks (cached data, degraded modes, another region) that do not rely on the same service.
- **Retry with backoff and jitter**, because a recovering service flooded by retries recovers more slowly (see the retries lesson).

## A worked exercise

Sketch a compare-and-swap version of the Enactor. Each applied plan carries a generation number stored with the DNS record set. An Enactor applies plan N only if the current generation is less than N, as an atomic conditional write; cleanup deletes only plans older than the *current applied generation minus K* and never the current one. With these two rules, the slow Enactor's stale write is rejected, and cleanup cannot remove live state.

## Common mistakes this case illustrates

- **Validating once at the start** of a slow operation.
- **Cleanup jobs with no protection for current state.**
- **One shared dependency under many services.**
- **Auto-remediation (health-check failover) that removes capacity during overload.**
