---
title: "Designing a Guardrails Service"
short_title: "Guardrails Service"
tags: ["guardrails", "safety", "moderation", "policy", "latency", "design"]
sources:
  - "OWASP Top 10 for Large Language Model Applications"
  - "Public documentation of open-source guardrail frameworks and safety classifier models"
  - "Inan et al., 'Llama Guard: LLM-based Input-Output Safeguard for Human-AI Conversations' (2023)"
  - "NVIDIA NeMo Guardrails documentation and NVIDIA developer blog on guardrail latency (via secondary summaries, October 2026)"
  - "Meta Llama Guard 4 model card (12B multimodal safety classifier), via secondary summaries"
  - "OWASP Top 10 for LLM Applications 2025 (LLM01, LLM05, LLM06)"
---

## The problem

Every AI feature needs protection against the same things: prompt injection, jailbreaks, leakage of personal data, toxic or off-policy output, and misuse of tools. Each team building its own filters leads to gaps and inconsistency. A **guardrails service** is a shared, configurable layer that screens inputs and outputs (and sometimes tool calls) against policy, fast enough not to ruin the product experience, and measurable enough to tune.

## Step 1: Requirements

- **Coverage:** input checks (injection, jailbreak, PII, banned topics), output checks (toxicity, PII, policy violations, groundedness, format), and tool-call checks.
- **Configurability:** policies per application, tenant and data class, versioned and testable.
- **Latency:** adds tens of milliseconds, not seconds; streaming outputs checked incrementally.
- **Observability:** every decision logged with the reason and policy version.
- **Tunability:** measurable precision and recall, with controls for the false-positive and false-negative trade-off.
- **Scale (example):** 10,000 checks per second.

## Step 2: Where it sits

Integrate as a library or sidecar, or as a step inside the LLM gateway. The flow is **pre-call checks** (input rails), the model call, **post-call checks** (output rails), and **action checks** before tools run. Placing the service in the gateway enforces it uniformly, while a library permits application-specific rails. Many systems do both: baseline rails in the gateway, custom ones in the app.

## Step 3: Layered detectors

No single detector is enough, so combine cheap and expensive checks in a **cascade**:

1. **Rules and patterns:** regexes for secrets, card numbers, banned terms; microsecond cost, high precision on what they cover.
2. **Small classifiers:** fine-tuned models for toxicity, injection, topic; milliseconds, good recall.
3. **LLM-based judges:** a safeguard model reads the conversation against a written policy for nuanced cases; slower and costlier, used only when earlier layers are uncertain or the risk is high.

Run independent detectors **in parallel** and combine their verdicts; short-circuit when one is conclusive.

## Step 4: Policy as code

Express policies declaratively: which detectors run for which route, thresholds, and the **action** for each outcome: allow, block, redact, rewrite, escalate to a human, or log only. Version policies, review changes, test them against a dataset of known good and bad inputs before rollout, and deploy gradually. Distinguish **hard blocks** (clearly harmful) from **soft interventions** (add a disclaimer, ask a clarifying question).

## Step 5: Handling streaming

Waiting for a full response defeats streaming. Options: check the **prompt** before generation, then check the output in **chunks** (every sentence or N tokens), cutting the stream and replacing it with a safe message if a violation appears. Buffering a small window lets the checker see context. The trade-off: stricter holdbacks give safer output but add latency.

## Step 6: Failure and bypass considerations

- **Fail open or closed?** If the service is down, high-risk applications should fail closed (block), low-risk ones may fail open; make it a per-policy decision with alerts.
- **Adversarial robustness:** attackers probe for gaps with encodings, other languages and multi-turn tricks; red-team continuously and feed new attacks into the test set.
- **Do not rely on guardrails alone:** they reduce risk but cannot prove safety. Combine with least-privilege tools, sandboxing and human approval for high-impact actions.
- **Rails can be attacked too:** the content being screened may include text aimed at the safeguard model, so treat it as untrusted data inside its prompt.

## Step 7: Measuring and tuning

Maintain labelled datasets per category and report **precision, recall and false-positive rate** per detector and policy version. Sample blocked requests for human review to find over-blocking, which harms users as much as under-blocking harms safety. Track block rates by route and over time as a signal of attacks or regressions. Let teams choose thresholds based on their risk tolerance, with the metrics visible.

## A worked example

**Scenario:** a user asks a finance assistant to "summarise this email thread" and the thread contains hidden text telling the assistant to forward the user's account numbers.

1. The input rail runs a PII detector (account numbers found, masked before the model sees them) and an injection classifier in parallel.
2. The injection classifier scores the hidden instruction at 0.93, above the policy's threshold of 0.8; the action is "strip the flagged span and log".
3. The model summarises the cleaned thread. The output rail checks for PII and policy compliance; it finds none.
4. The decision log records the detectors, scores and policy version; a daily report shows the injection block rate trending up for this route, which triggers a red-team review.
5. The tool allow-list for this assistant does not include any email-sending tool, providing a second line of defence even if the rail had missed it.

## Enterprise practice (verified October 2026)

**Basics.** Input checks, output checks, tool-call checks, with a fail-safe default (steps above).

**Current tooling (secondary sources; benchmark on your own traffic).** NeMo Guardrails (NVIDIA, open source) structures five rail types: input, dialog, retrieval, execution and output, with policies written in Colang and integrations for LangChain, LangGraph and LlamaIndex. Reported overhead is roughly **20 to 80 ms** per classifier-based rail, and about half a second when several safety microservices are chained. **Llama Guard 4** is a 12B natively multimodal safety classifier that can screen both prompts and responses on a single GPU; small prompt-injection classifiers (Prompt Guard class, tens of millions of parameters) run in tens of milliseconds. NVIDIA's Nemotron safety models add multilingual, policy-conditioned moderation.

**What to design around.**

- **Classifiers are probabilistic.** They reduce risk; they do not enforce authorisation. Hard controls (what tools may do, which data a user may see) stay in deterministic code, which is why OWASP puts *Excessive Agency* (LLM06) and *Improper Output Handling* (LLM05) next to injection.
- **Latency budget.** Run input checks in parallel with retrieval; stream output only after the streaming-safe rails pass, or buffer sentences and check them in windows.
- **Per-tenant policy.** A bank and a children's education product need different thresholds; store policy as versioned config, not code.
- **Measure both error types.** Track block rate, false-positive rate on benign golden prompts and miss rate on an attack suite that you refresh as new jailbreaks appear.

**Enterprise pattern.** Guardrails as a shared service behind the gateway, with decisions logged (rule id, score, action) for audit and a documented override path for false positives.

## Common mistakes

- **One detector as the only defence.**
- **Running all checks serially** and adding seconds of latency.
- **No measurement of false positives**, so over-blocking goes unnoticed.
- **Unversioned policy changes** pushed straight to production.
- **Treating guardrails as a substitute** for least-privilege design.
