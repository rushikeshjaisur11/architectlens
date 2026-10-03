---
title: "Service Discovery, Service Mesh and Sidecars"
short_title: "Service Discovery and Service Mesh"
tags: ["service-discovery", "service-mesh", "sidecar", "mtls", "kubernetes", "istio"]
sources:
  - "Istio documentation, 'Ambient mode' (ztunnel and waypoint proxies; GA in Istio 1.24, November 2024), istio.io (via search results, October 2026)"
  - "Kubernetes documentation, Services, EndpointSlices and Gateway API, kubernetes.io"
  - "Service mesh comparisons, 2026 (secondary: reintech.io, dev.to, zylos.ai)"
predict:
  question: "A platform with 120 services moves to Istio ambient mode and wants layer-7 canary routing for 20 of them. What does it add?"
  options: ["Nothing extra, since the per-node ztunnel handles all layer-7 features", "Waypoint proxies for those 20, while ztunnel covers layer-4 mTLS for everyone", "A sidecar added back to every pod across all 120 services"]
  answer: 1
  why: "ztunnel covers layer-4 duties per node, and waypoint proxies provide layer-7 features only for services that need them."
check:
  - q: "Why shouldn't a team adopt a mesh for five services?"
    options: ["Libraries, an ingress and network policies suffice, so a mesh is mostly overhead", "A mesh cannot issue workload identities unless the cluster has dozens of nodes", "Sidecar proxies only support clusters that already run over a hundred services"]
    answer: 0
    why: "A mesh is justified for dozens of services; for a handful, cheaper building blocks avoid its operational cost."
  - q: "Retries are configured in both the mesh and the application. What goes wrong?"
    options: ["Retries cancel each other out, so failed calls are never retried", "The mesh ignores application retries, so only the mesh's settings apply", "Attempts multiply across layers, amplifying load on an already struggling service"]
    answer: 2
    why: "Each layer retries independently, so the total attempts are the product of both settings."
  - q: "A mesh enforces mTLS between services. Why is that not authorisation?"
    options: ["mTLS encrypts traffic but cannot identify the caller, so policy is separate", "Identity proves who is calling, not what they may do, so policy is still needed", "mTLS authorises every call by default, so extra policy only duplicates it"]
    answer: 1
    why: "mTLS gives each workload a cryptographic identity, but rules such as only checkout may call payments are separate policy."
---

## How does service A find service B?

In a monolith, a function call finds the callee. In a system of many services running on machines that come and go (autoscaling, deploys, failures), IP addresses change constantly, so hard-coded addresses fail. **Service discovery** is the mechanism by which a caller obtains the current set of healthy addresses for a service name.

- **Client-side discovery.** The caller asks a registry (Consul, etcd, Eureka) for instances and picks one, performing its own load balancing. Flexible and efficient, but every language needs a client library.
- **Server-side discovery.** The caller sends to a stable name or virtual IP, and a load balancer or proxy picks an instance. Simpler for callers.
- **DNS-based.** Names resolve to a set of addresses. Kubernetes gives each Service a stable name and virtual IP, maintained from EndpointSlices of healthy pods, with health checks (readiness probes) removing unready pods. DNS caching and TTLs mean changes can take time to propagate, so clients must tolerate stale answers and retry.

## Cross-cutting concerns that every service needs

Once you have dozens of services, every one must implement the same network behaviours: encryption and mutual authentication (mTLS), retries and timeouts, load balancing, circuit breaking, traffic splitting for canaries, rate limits, metrics and traces. Putting that in each service's code, in each language, is repetitive and drifts. A **service mesh** moves these concerns into the infrastructure layer.

## Sidecars and the mesh architecture

A mesh has a **data plane** (proxies that carry traffic) and a **control plane** (a service that configures them). In the classic **sidecar** model, a proxy (typically Envoy, or Linkerd's Rust proxy) runs next to every service instance and intercepts its inbound and outbound traffic. The control plane pushes routing and security policy to all proxies. Benefits: uniform mTLS identity per workload, consistent telemetry, traffic policy without code changes. Costs: an extra proxy per pod (CPU, memory, added latency per hop), operational complexity, and upgrade coordination.

## Sidecar-less designs

Reported reaction to sidecar cost produced new models:

- **Istio ambient mode** (GA in Istio 1.24, November 2024) splits the data plane: a per-node **ztunnel** handles layer-4 duties (mTLS, identity, simple authorisation, telemetry) for all pods on the node, and optional **waypoint proxies** handle layer-7 features (HTTP routing, retries, rich policy) only for services that need them. Secondary reports put ztunnel-only overhead at a small fraction of sidecar overhead (one benchmark summary reported about 14 vCPU of sidecar overhead versus about 5 vCPU of ztunnel for a 70-pod cluster), and multi-cluster support arrived in 2026 releases.
- **Cilium** uses eBPF in the kernel for networking and mesh features, with mTLS and L7 handled with per-node or per-service proxies; it is the default network plugin on several managed Kubernetes services.
- **Linkerd** keeps a small, simple sidecar mesh, favoured by teams that want a mesh without operating a large control plane.

## Do you need one?

A mesh is justified when many services (rule of thumb: dozens, across teams and languages) need uniform security and traffic control. It is overkill for a handful of services where a library, an ingress and Kubernetes network policies suffice. Cheaper building blocks: Kubernetes Services and DNS, an ingress or the Gateway API for edge routing, per-language resilience libraries, and a gateway for north-south traffic.

## A worked example

A platform with 120 services across three clusters needs: mTLS between all services, canary releases for 20 of them, and per-service latency metrics.

1. It adopts ambient mode: ztunnel on each node gives every workload a cryptographic identity and encrypted traffic with no changes to the services.
2. For the 20 canary-release services, it adds waypoint proxies, and uses Gateway API routes to send 5% of traffic to the new version.
3. Authorisation policy at layer 4 states that only the `checkout` identity may call `payments`; layer 7 rules (allowed HTTP methods) are enforced at the waypoint.
4. Metrics from ztunnel and waypoints feed dashboards; the team measures overhead before and after (CPU and added p99 latency) and keeps the sidecar model for one legacy cluster where ambient is not yet supported.

## Common mistakes

- **Adopting a mesh for five services.**
- **Retries configured in the mesh and in the application**, multiplying attempts (see the retries lesson).
- **Treating mTLS as authorisation**: identity proves who is calling, not what they may do.
- **Ignoring DNS caching** and stale endpoints.
- **No plan for the control plane**: if it is down, existing traffic should continue, and you must know how config changes behave.
