---
title: "Secrets, Encryption and Zero-Trust Architecture"
short_title: "Secrets, Encryption and Zero Trust"
tags: ["security", "secrets", "encryption", "zero-trust", "kms", "mtls"]
sources:
  - "NIST SP 800-207, Zero Trust Architecture (2020)"
  - "NIST SP 800-57 Part 1, Recommendation for Key Management"
  - "OWASP Application Security Verification Standard and Secrets Management Cheat Sheet, owasp.org"
---

## Perimeter security stopped working

The traditional model drew a boundary around the corporate network: inside is trusted, outside is not. Cloud, remote work, partners and microservices dissolved that boundary, and attackers who get one foothold (a stolen laptop, a vulnerable service) move freely inside. **Zero trust** replaces "trust the network" with "**never trust, always verify**": every request is authenticated, authorised and encrypted regardless of where it comes from, and access is granted per request with least privilege. NIST SP 800-207 defines the architecture: a policy engine decides, a policy enforcement point applies the decision at the resource, and decisions use identity, device posture and context.

## Identity for workloads, not just people

Services need identities too. Instead of a shared password in a config file, each workload has a **cryptographic identity** (an X.509 certificate or a signed token) issued automatically and rotated frequently: for example SPIFFE identities issued by a platform, or cloud provider workload identities. Service-to-service calls use **mutual TLS (mTLS)**: both sides present certificates, so each knows who the other is and the channel is encrypted. Authentication says who; **authorisation** says what they may do, and must be checked separately, ideally by policy as code (for example, "checkout may call payments, nothing else may").

## Secrets management

A **secret** is any credential: database passwords, API keys, signing keys, tokens. Hard rules:

- **Never in source control or images.** Scanners find leaked secrets in repositories within minutes of a push.
- **Central secret manager** (cloud secret services, HashiCorp Vault or equivalents): secrets are stored encrypted, access is authenticated and audited, and every read is logged.
- **Short-lived, dynamic credentials.** Rather than a static database password, the application requests a credential that expires in an hour; a leak has a short useful life.
- **Rotation**: automate it; design applications to reload credentials without restart, and to hold two valid versions during rotation.
- **Least privilege**: each service gets only the secrets it needs.
- **Break-glass access** with approval and alerting.

## Encryption in three places

- **In transit**: TLS 1.2 or 1.3 everywhere, including inside the data centre; mTLS between services; HSTS at the edge.
- **At rest**: disks, databases and object stores encrypted with keys managed outside the application.
- **In use / application-level**: for the most sensitive fields (card numbers, health data), encrypt in the application so that database administrators and backups see only ciphertext.

## Key management and envelope encryption

Encrypting terabytes directly with a master key in a key management service (KMS) is impractical. **Envelope encryption** solves it: generate a unique **data encryption key (DEK)** per object or per tenant, encrypt the data with the DEK locally, and encrypt the DEK with a **key encryption key (KEK)** held in the KMS or a hardware security module (HSM). Store the wrapped DEK next to the data. To read, call the KMS to unwrap the DEK. Benefits: the master key never leaves the KMS; rotating the KEK means re-wrapping small DEKs, not re-encrypting all data; **deleting a tenant's key crypto-erases their data**; every unwrap is audited.

## Layers of a zero-trust design

1. **Strong identity** for users (SSO, phishing-resistant MFA such as passkeys) and workloads.
2. **Device posture** checks for managed, patched devices.
3. **Micro-segmentation**: network policies that allow only declared flows.
4. **Per-request authorisation** with policy as code.
5. **Encryption everywhere** and managed keys.
6. **Continuous monitoring**: audit logs, anomaly detection, and fast revocation.

## A worked example

A payments service must read card data and call a bank.

1. Its pod receives a short-lived workload certificate on start; the mesh enforces mTLS and an authorisation policy that allows only the checkout service to call it.
2. Database credentials come from a secret manager as dynamic, one-hour credentials; the app refreshes them in the background.
3. Card numbers are encrypted in the application with a per-merchant DEK wrapped by a KMS key; the database stores ciphertext only.
4. When a merchant leaves, scheduling deletion of its KMS key renders its stored card data unreadable (crypto-erase), after the retention period required by law.
5. Every secret read and every key unwrap is logged centrally; an alert fires if the payments identity reads secrets outside its normal set.

## Common mistakes

- **Secrets in environment files committed to git** or baked into images.
- **Long-lived shared credentials** that are never rotated.
- **mTLS without authorisation**, so any authenticated service can call anything.
- **Encrypting with the key stored next to the data.**
- **No audit of secret and key access**, so a breach cannot be scoped.
