---
title: "Cost Runaway Protection and Spend Circuit Breakers"
short_title: "Cost Runaway Protection"
tags: ["reliability", "cost-control", "llm-apis", "circuit-breakers"]
sources:
  - "OpenAI usage limits and billing documentation (platform.openai.com)"
  - "Anthropic Console spend limits documentation (docs.anthropic.com)"
  - "AWS Cost Anomaly Detection documentation (aws.amazon.com)"
---

## Why LLM spend runs away differently than typical cloud spend

Traditional infrastructure cost grows roughly with provisioned capacity — a runaway EC2 bill usually means someone forgot to shut down instances, and the ceiling is bounded by how many resources exist. LLM spend has no such natural ceiling: a single buggy retry loop, an unbounded agent that keeps calling tools, or a prompt-injection attack that gets a model to generate maximal-length output can multiply token consumption by orders of magnitude within minutes, and **cost scales directly with tokens processed**, not with any fixed resource count. A recursive agent loop that calls itself 500 times before a bug is noticed can produce a bill spike that would take a misconfigured VM fleet days to match.

The specific failure modes worth designing against:

- **Infinite or near-infinite agent loops** — an agentic system with a tool-calling loop that never satisfies its termination condition, especially common in ReAct-style agents without a hard step cap.
- **Retry storms** — a client retrying failed calls without backoff or a max-attempt cap, multiplying cost on every failure instead of just latency.
- **Prompt injection driving excessive generation** — untrusted input coercing the model into producing very long output or invoking expensive tools repeatedly.
- **Unbounded context growth** — a conversation or RAG pipeline that keeps appending to context without truncation, so every turn re-processes an ever-larger, ever more expensive prompt.

## Hard limits, not just monitoring

Dashboards and alerts are necessary but not sufficient — they tell you about a runaway after it's already cost money, often with enough delay (alert latency, on-call response time) that real damage is done before a human intervenes. The reliable pattern is a **spend circuit breaker**: an automated, code-enforced limit that halts further API calls once a threshold is crossed, with no human in the loop required to stop the bleeding.

Layer the limits:

- **Per-request caps** — `max_tokens` set explicitly on every call, never left to the model's default ceiling, bounding the worst case of any single response.
- **Per-session/per-user budgets** — a running token or dollar counter scoped to a conversation or user, rejecting further calls once exceeded; this contains both bugs and abuse to a single blast radius instead of the whole system.
- **Per-agent step limits** — a hard maximum number of tool-calling iterations in any agent loop, enforced in code, independent of whether the agent's own logic believes it should stop.
- **Organization-wide spend limits** — most providers support hard usage caps at the account level (OpenAI usage limits, Anthropic Console spend limits) that stop all API access once a monthly or daily ceiling is hit; set these even when they'd theoretically never be reached, since they're the last line of defense against a scenario nobody anticipated.

## Anomaly detection as the second layer

Hard caps prevent catastrophic bills but are usually set loose enough to allow legitimate peak usage, which leaves room for a slower-burning anomaly to slip through. **Rate-of-change monitoring** — alerting when spend in the last hour deviates significantly from the trailing baseline (a pattern analogous to AWS Cost Anomaly Detection's ML-based baseline comparison) — catches gradual runaways that a static threshold misses, such as a feature rollout that's technically within the daily cap but burning 10x the expected rate per user.

## Graceful degradation over hard failure

When a budget cap is hit, the system's response matters. Hard-failing every request the instant a limit trips turns a cost problem into an availability problem. Preferable: degrade to a cheaper model, disable non-essential LLM features (autocomplete, suggestions) while keeping core functionality alive on a stricter budget, or queue non-urgent work for the next budget window — the same tiered-response principle used in rate limiting, applied to dollars instead of requests.

## Common mistakes

- **Relying on billing dashboards alone.** Most provider dashboards update with a delay measured in hours, not real time — by the time the number moves, the runaway has already happened.
- **Setting `max_tokens` to the model's maximum "just in case."** This removes the cheapest and most direct per-request cost control for no real benefit in the common case.
- **No step limit on agent loops.** A ReAct-style agent without a hard iteration cap is one bad termination condition away from an unbounded bill.
- **Treating spend limits as a finance concern instead of an engineering one.** Circuit breakers need to be enforced in the code path that makes the API call, not just configured as an after-the-fact billing alert.
