---
title: "Designing AI Security Architecture and Threat Modeling"
short_title: "AI Security Architecture"
tags: ["security", "threat-modeling", "owasp", "zero-trust", "defense-in-depth", "design"]
sources:
  - "OWASP Top 10 for Large Language Model Applications"
  - "MITRE ATLAS (Adversarial Threat Landscape for Artificial-Intelligence Systems)"
  - "NIST AI RMF 1.0 and NIST SP 800-207 (Zero Trust Architecture)"
  - "OWASP Top 10 for LLM Applications 2025, genai.owasp.org/llm-top-10 (fetched Oct 2026)"
  - "OWASP Top 10 for Agentic Applications 2026 (published December 2025), via secondary summaries"
predict:
  question: "In the email assistant, reading and sending run in separate sessions and the reading session has no send tool. A malicious email says to forward the last ten messages to an attacker. What happens?"
  options: ["The reading session has no send tool, so the injection has nothing to act on", "The model refuses because the system prompt forbids forwarding mail", "The mail is forwarded, and a later alert flags the unusual recipient"]
  answer: 0
  why: "Splitting the sessions breaks the lethal trifecta: the session that sees untrusted content has no outbound channel."
check:
  - q: "Why design as if the model can be fooled rather than rely on a hardened system prompt?"
    options: ["Injection is rare enough that code-level controls are not justified", "Prompts alone are not security, so the model is treated as untrusted", "Hardened prompts block direct injection but cost too many tokens"]
    answer: 1
    why: "The lesson treats the model as an untrusted component, so a successful injection must not be able to cause serious harm."
  - q: "What does breaking the lethal trifecta mean in practice?"
    options: ["Avoid combining private data, untrusted content and an outbound channel in one session", "Encrypt private data, untrusted content and outbound traffic separately", "Run three redundant classifiers over every prompt, retrieval and tool call"]
    answer: 0
    why: "An injected instruction needs all three legs to exfiltrate data; removing one in a session removes the path."
  - q: "Where should authorisation, rate limits and schema validation live?"
    options: ["In the system prompt, where the model can apply them contextually", "In code at the tool and API boundary, outside the model", "In the output classifier that screens final responses"]
    answer: 1
    why: "Deterministic enforcement belongs in code at the tool and API boundary, because the model can be fooled."
---

## The problem

LLM applications introduce a new attack surface: instructions and data share the same channel, models follow text from anywhere, and agents act with real permissions. Traditional controls (authentication, network security, input validation) still matter but are not enough. A secure AI architecture starts with an explicit **threat model** and layers controls so that no single failure, especially a model being fooled, leads to a breach.

## Step 1: Map assets, actors and trust boundaries

**Assets:** customer and employee data, proprietary documents and prompts, model endpoints and credentials, tools that act on systems, the evaluation data, the reputation of the brand, and money (compute budgets). **Actors:** legitimate users, malicious users, external content authors (web pages, emails, documents), compromised insiders, third-party providers and supply-chain components. **Trust boundaries:** user to application, application to model provider, retrieved content to prompt, model output to tools, tool to external system, tenant to tenant.

Draw a data flow diagram and mark where untrusted data crosses into trusted contexts: retrieval results, tool outputs, uploaded files and web content all enter the prompt.

## Step 2: Threat catalogue

Use established lists (OWASP LLM Top 10, MITRE ATLAS) and adapt:

- **Prompt injection (direct and indirect):** instructions in user input or in retrieved content hijack behaviour.
- **Sensitive information disclosure:** the model reveals system prompts, other users' data, secrets or training data.
- **Excessive agency:** an agent has more tools or permissions than needed, and an injected instruction misuses them.
- **Insecure output handling:** model output is rendered or executed downstream (cross-site scripting, SQL injection, command execution).
- **Data and model poisoning:** malicious content in the knowledge base, feedback or training data alters behaviour.
- **Supply-chain risk:** compromised models, packages, plugins, or datasets.
- **Denial of wallet and service:** crafted inputs that burn tokens, GPU time or rate limits.
- **Model theft and extraction:** copying a model through its API.
- **Cross-tenant leakage:** shared indexes, caches or memory exposing one tenant's data to another.
- **Overreliance:** humans accepting wrong outputs without checks.

## Step 3: Architectural principles

- **Assume the model can be fooled.** Design so that a successful injection cannot cause serious harm: the model is an untrusted component.
- **Least privilege everywhere:** narrow tool scopes, per-user delegated credentials, read-only by default, separate agents with separate permissions.
- **Break the lethal trifecta:** do not combine access to private data, exposure to untrusted content and an outbound channel in one agent session without strong controls.
- **Separate instructions from data:** delimit and label untrusted content, but do not rely on prompts alone for security.
- **Deterministic enforcement outside the model:** authorisation, rate limits, schema validation and allow-lists live in code at the tool and API boundary.
- **Defence in depth:** classifier rails, output filters, sandboxing, approvals and monitoring layered so one failure is survivable.
- **Fail safe and fail closed** for high-risk paths.

## Step 4: Control layers

- **Identity and access:** strong authentication, per-tenant isolation, delegated short-lived tokens for agent actions, scoped keys for model providers, secrets in vaults never in prompts.
- **Input controls:** size limits, rate limiting, content classification, injection detection, file scanning, redaction of sensitive data.
- **Retrieval controls:** permission-aware retrieval, source trust levels, provenance, protection of the indexing pipeline from poisoned content, and review for high-impact sources.
- **Tool controls:** allow-lists, argument validation, idempotency, spending and rate limits, human approval for impactful actions, sandboxed execution for code and browsers with no secrets and restricted egress.
- **Output controls:** encode and sanitise output before rendering; never execute model output without validation; block data exfiltration channels such as arbitrary URLs and markdown images that call external hosts.
- **Data controls:** encryption in transit and at rest, retention limits, tenant-scoped caches and vector indexes, logging with redaction.
- **Network controls:** private connectivity to providers where available, egress filtering, segmentation of the inference and tool environments.
- **Supply chain:** pin and scan dependencies and model artifacts, verify provenance and signatures, review plugins and tools.

## Step 5: Detection and response

Log prompts, retrieved sources, tool calls and decisions (with redaction), and monitor for anomalies: unusual tool sequences, repeated injection patterns, spikes in token use, access to unusual resources, large outbound data. Maintain **AI-specific incident runbooks**: how to disable a tool or an agent, rotate credentials, purge a poisoned document or cache, and notify affected parties. Run **red-team exercises** regularly with realistic attack chains and feed findings into regression tests.

## Step 6: Governance and assurance

Include AI systems in the standard security lifecycle: design review with threat modelling, penetration testing that covers prompt-level attacks, dependency scanning, and compliance mapping (for example SOC 2, ISO 27001, sector rules). Classify applications by risk tier to scale the controls. Track security metrics: injection block rate, red-team success rate over time, mean time to contain, and coverage of tools with least-privilege scopes.

## A worked example

**Scenario:** threat-modelling an email assistant that summarises a user's inbox and can draft and send replies.

1. Assets: the user's mail, contacts, calendar. Untrusted content: every incoming email body and attachment. Capabilities: read mail (private data), send mail (outbound channel).
2. Threat: a malicious email contains hidden instructions to forward the last ten messages to an attacker. This combines all three legs of the trifecta.
3. Controls: reading and sending run in **separate sessions**; the reading session has no send tool. Drafted replies are shown to the user for approval with the exact recipients highlighted; the send token is issued only after approval, bound to that message.
4. Output handling: summaries are rendered as text only, with links shown but not auto-fetched, to prevent exfiltration through image URLs.
5. Detection: an alert fires when an approved send includes recipients never seen in the thread; the red-team suite includes 40 injection payloads that run in CI against the agent.

## Enterprise practice (verified October 2026)

**Basics.** Treat the model as an untrusted component: separate instructions from data, validate output, limit tool reach (steps above).

**Use the current OWASP lists as your threat checklist.** The official 2025 LLM list is: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption. Three entries are new or reshaped since 2023 and matter for design: **System Prompt Leakage** (never put secrets or authorisation rules in the prompt), **Vector and Embedding Weaknesses** (RAG stores need access control and poisoning defences, see multi-tenant RAG), and **Unbounded Consumption** (cost and denial-of-wallet are security issues; rate limits and budgets belong in the gateway).

The December 2025 **Agentic Applications Top 10** adds agent-specific risks: Agent Goal Hijack, Tool Misuse, Identity and Privilege Abuse, Agentic Supply Chain, Unexpected Code Execution, Memory and Context Poisoning, Insecure Inter-Agent Communication, Cascading Failures, Human-Agent Trust Exploitation and Rogue Agents.

**Enterprise pattern.** Build a threat model per use case: list assets, trust boundaries (user, retrieved content, tool output, other agents), and map each OWASP item to a control and an owner. Run adversarial evaluation (prompt-injection suites, tool-abuse scenarios) in CI and as periodic red teaming; keep results as audit evidence. Pin and scan models, datasets, MCP servers and plugins as supply-chain artefacts.

## Common mistakes

- **Relying on a system prompt** to prevent injection.
- **Agents with broad permissions** and no per-action authorisation.
- **Rendering or executing model output** without sanitising.
- **Ignoring the indexing pipeline** as an entry point for poisoned content.
- **No red-teaming**, so controls are never tested against real attacks.
