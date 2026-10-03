---
title: "Multi-Tenancy Patterns for SaaS"
short_title: "Multi-Tenancy Patterns"
tags: ["multi-tenancy", "saas", "isolation", "noisy-neighbour", "database"]
sources:
  - "AWS Well-Architected SaaS Lens and AWS whitepaper, 'SaaS Tenant Isolation Strategies'"
  - "PostgreSQL documentation, 'Row Security Policies' (row-level security)"
  - "Microsoft Azure Architecture Center, 'Multitenant SaaS database tenancy patterns'"
predict:
  question: "RLS is enforced on every table, and a developer forgets the WHERE tenant_id clause in a query. What does the query return?"
  options: ["Rows from every tenant, because RLS only applies to queries that mention tenant_id", "Only the current tenant's rows, because the policy filters every query automatically", "An error, because queries without a tenant filter are rejected at parse time"]
  answer: 1
  why: "A row-level security policy is enforced on every query, so a forgotten WHERE clause cannot return another tenant's rows. The tenant must be set from an authenticated claim."
check:
  - q: "Why do mature SaaS products tier tenants rather than choose a single isolation model for everyone?"
    options: ["Shared tables are insecure at any scale, so only large tenants may use them", "A dedicated stack per tenant is cheap enough once automation exists", "Small tenants stay cheap in pooled infrastructure while large or regulated ones get stronger isolation"]
    answer: 2
    why: "Shared tables scale cheaply to thousands of tenants but isolate weakly; silos cost the most. A tenant directory lets a tenant be promoted without code changes."
  - q: "Where should the tenant value used by an RLS policy come from?"
    options: ["An authenticated claim resolved at the edge, never from user input", "A request parameter, so clients can switch tenants without logging in again", "A cache key shared across tenants, to avoid a lookup on every request"]
    answer: 0
    why: "The tenant is resolved once from the token or domain and carried in the request context. Taking it from user input would let a caller choose another tenant's data."
  - q: "Why enforce rate limits per tenant instead of one global limit?"
    options: ["A global limit is too complex to implement at the gateway", "A global limit lets one tenant's burst eat the shared allowance and hurt everyone else", "Per-tenant limits remove the need for fair queueing in background jobs"]
    answer: 1
    why: "Without per-tenant limits one customer's burst becomes everyone's outage. Fair queueing is still needed separately so one tenant's job backlog cannot starve others."
---

## What multi-tenancy means

A **tenant** is a customer organisation using your software. **Multi-tenancy** means serving many tenants from shared infrastructure and one codebase, instead of deploying a separate copy per customer. It is the economic foundation of SaaS: shared resources are far cheaper than dedicated ones, and one release updates everyone. The engineering challenge is **isolation**: tenant A must never see tenant B's data (security), must not slow tenant B down (performance), and should be able to be backed up, restored, moved and deleted on its own (operations).

## The data isolation spectrum

From most shared to most isolated:

1. **Shared tables with a tenant column.** One database, one schema; every row has `tenant_id`. Cheapest and simplest to scale to thousands of tenants; weakest isolation, because a missing `WHERE tenant_id = ?` leaks data.
2. **Schema per tenant.** One database, a schema (namespace) per tenant. Better logical separation and per-tenant migrations; gets heavy at thousands of tenants (catalog size, migration time).
3. **Database per tenant.** Strong isolation, per-tenant backup and restore, easy to move a tenant, easy to meet residency requirements; high cost and operational overhead at scale.
4. **Dedicated stack per tenant ("silo").** Full isolation including compute; highest price, used for regulated or very large customers.

Most mature SaaS products are **tiered**: small tenants pooled in shared infrastructure, large or regulated tenants in dedicated databases or stacks, with the tier stored in a tenant directory so a tenant can be promoted without code changes.

## Making the shared model safe

- **Row-level security (RLS).** PostgreSQL can enforce a policy on every query ("rows are visible only when `tenant_id = current_setting('app.tenant')`"), so even a forgotten `WHERE` clause cannot return another tenant's rows. Set the tenant at connection or transaction start from an authenticated claim, never from user input.
- **Tenant context everywhere.** Resolve the tenant once at the edge (from the token or domain), carry it in the request context, and include it in cache keys, queue messages, search indexes, logs and metrics.
- **Test the boundary.** Automated tests that create two tenants with canary data and assert that no API, export, search or background job can cross between them.
- **Per-tenant encryption keys** allow crypto-erase when a tenant leaves and limit the damage of key exposure.

## The noisy neighbour

Shared resources mean one tenant's heavy workload can slow everyone. Controls:

- **Rate limits and quotas per tenant** at the API gateway and for background jobs.
- **Fair queueing**: scheduling that gives each tenant a share, so one tenant's 1 million queued jobs do not starve the others.
- **Resource isolation**: separate worker pools or database connection pools for large tenants; limit per-tenant query time and size.
- **Partitioning by tenant**: shard data so a hot tenant can be moved to its own shard.
- **Metering**: measure usage per tenant for billing, abuse detection and capacity planning.

## Tenant lifecycle operations

Design these on day one:

- **Onboarding**: automated provisioning (schema, keys, config, default data).
- **Per-tenant backup and restore**: shared-table designs make restoring one tenant hard; plan logical exports or point-in-time recovery per tenant.
- **Migration between tiers or regions**: moving a tenant to a dedicated database or to the EU requires tooling.
- **Offboarding and deletion**: erasing all of a tenant's data, including backups, caches, indexes and logs, within a defined time.
- **Customisation**: configuration and feature flags per tenant, not code forks.

## A worked example

A B2B analytics product has 4,000 tenants.

1. 3,900 small tenants share one PostgreSQL cluster partitioned by `tenant_id` hash, with RLS enforced on every table.
2. 100 larger tenants each get their own database (some regulated, some simply heavy); a tenant directory stores each tenant's connection details and tier.
3. The API gateway enforces 200 requests per second per tenant (adjustable by plan); a fair-queue scheduler runs export jobs with at most 2 concurrent jobs per small tenant.
4. A tenant that outgrows the pool is promoted: logical replication copies its rows to a new database, the directory entry flips, and the old rows are deleted after verification.
5. Nightly canary tests create two synthetic tenants and attempt cross-tenant reads through the API, search and exports; any success fails the build.

## Common mistakes

- **Relying on developers to add `WHERE tenant_id`** to every query.
- **Shared cache keys** without a tenant component, returning another tenant's data.
- **No per-tenant limits**, so one customer's burst becomes everyone's outage.
- **Unable to restore a single tenant** after an error.
- **Treating tenant deletion as an afterthought.**
