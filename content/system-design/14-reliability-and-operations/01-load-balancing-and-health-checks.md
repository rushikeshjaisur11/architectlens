---
title: "Load Balancing and Health Checks"
short_title: "Load Balancing and Health Checks"
tags: ["reliability", "load-balancing", "operations", "availability"]
sources:
  - "NGINX documentation on load balancing algorithms"
  - "Google SRE Book, chapter on load balancing at the frontend and backend"
---

## What a load balancer is actually for

A load balancer sits between clients and a pool of backend servers, distributing incoming requests across them. This buys two things at once: **scale** (spreading load across multiple servers instead of overwhelming one) and **availability** (if one server fails, the load balancer stops sending it traffic and the rest keep serving — a single server failure doesn't mean the whole service is down).

## Load balancing algorithms

- **Round robin** — requests are distributed to servers in a fixed rotating order. Simple, and works well when all servers have similar capacity and requests have similar cost.
- **Least connections** — routes to whichever server currently has the fewest active connections. Better than round robin when request processing time varies significantly, since it naturally avoids piling more work onto a server that's still busy with a slow request.
- **Weighted variants** of either — assigning servers different weights (e.g., a more powerful server gets more traffic) when the backend pool isn't uniform in capacity, which is common when a fleet mixes hardware generations or instance sizes.
- **Consistent hashing** — routes requests with the same key (often a session ID or user ID) to the same backend server consistently, useful when a server holds request-specific state (an in-memory cache, a sticky session) that would be lost or need re-fetching if the same user's requests bounced between different servers on every request.

The right choice depends on whether backend servers are uniform and stateless (round robin or least-connections both work fine) or whether request routing needs to be sticky for correctness or performance reasons (consistent hashing).

## Health checks: how a load balancer knows a server is actually usable

Without health checks, a load balancer keeps sending traffic to a server that's crashed, hung, or degraded, until a human notices and manually removes it — turning a single server failure into ongoing failed requests for whatever fraction of traffic keeps landing there. Health checks let the load balancer detect and route around bad servers automatically:

- **Passive health checks** — the load balancer observes real traffic; if a server starts returning errors or timing out on actual requests, it's marked unhealthy and temporarily removed from rotation. No extra traffic generated, but detection only happens after real requests have already failed.
- **Active health checks** — the load balancer periodically sends a dedicated health-check request (often to a specific `/health` endpoint) independent of real traffic, and removes a server from rotation if it fails to respond correctly. Catches problems before they affect real user requests, at the cost of some extra background traffic.

A well-designed `/health` endpoint should check more than "is the process running" — it should verify the server can actually do its job (e.g., its database connection is live, a critical dependency is reachable), since a server that's up but can't reach its database is functionally unhealthy even though the process itself hasn't crashed. Overly shallow health checks (just returning 200 unconditionally) defeat the purpose, since they can't detect the failure modes that actually matter.

## Layer 4 vs. Layer 7 load balancing

- **Layer 4 (transport layer)** — routes based on IP address and port, without inspecting the actual content of the request. Faster and simpler, but can't make routing decisions based on the request's content (e.g., routing `/api/v2/*` differently from `/api/v1/*`).
- **Layer 7 (application layer)** — inspects the actual HTTP request (path, headers, cookies) to make routing decisions, enabling content-based routing, SSL termination at the load balancer, and more sophisticated health-check logic — at the cost of more processing overhead per request than Layer 4's simpler packet-level routing.

Most modern application load balancers (AWS ALB, NGINX in HTTP mode) operate at Layer 7, since the flexibility to route based on request content is usually worth the modest overhead, while Layer 4 balancers remain common for raw TCP traffic that isn't HTTP at all.

## A worked example

**Scenario:** an API service behind a load balancer, running on a fleet of 10 backend servers, where one server develops a slow memory leak that eventually causes it to hang under load.

- **Active health checks** hitting a `/health` endpoint every few seconds catch this server once its response time or error rate on the health check itself degrades — removing it from the rotation automatically, before it accumulates enough failed real requests to meaningfully hurt users.
- **Least-connections routing** among the remaining 9 healthy servers ensures the temporarily reduced capacity is distributed evenly rather than round-robin blindly sending equal load to servers that might already be handling longer-running requests.
- **Passive health checks** act as a backstop — even if the active `/health` endpoint doesn't perfectly capture the memory-leak symptom, real request failures against that server will eventually trigger passive removal too, giving the system two independent detection paths rather than relying on one.
- Once the leaking server is restarted (by an auto-remediation process or manual intervention) and passes health checks again, it's automatically added back into rotation — the whole cycle requiring no manual load-balancer reconfiguration.

## Common mistakes

- **A health-check endpoint that only checks "is the process alive"** rather than the actual dependencies the service needs to function — missing the far more common failure mode of "the process is up but can't do its job" (a dead database connection, an exhausted connection pool).
- **No active health checks, relying purely on passive detection.** This means every unhealthy server has to actually fail real user requests before being removed — a strictly worse outcome for users than catching the problem via a dedicated health-check path first.
- **Sticky routing (consistent hashing) applied to genuinely stateless services** where it's not needed — this can create uneven load distribution (some backend keys naturally get more traffic than others) for no actual benefit, since a stateless service doesn't need requests from the same client routed to the same backend in the first place.
