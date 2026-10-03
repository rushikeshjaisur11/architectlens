---
title: "Failure Recovery, Retries, and Self-Correction Loops in Agentic Systems"
short_title: "Failure Recovery & Self-Correction"
tags: ["error-handling", "retries", "self-correction", "reliability", "agents"]
sources:
  - "Reflexion: Language Agents with Verbal Reinforcement Learning (Shinn et al., 2023, arXiv:2303.11366)"
  - "Self-Refine: Iterative Refinement with Self-Feedback (Madaan et al., 2023, arXiv:2303.17651)"
  - "AWS Well-Architected: retry and backoff patterns (docs.aws.amazon.com)"
---

## Failures compound differently in agent loops than in normal software

A single LLM call failing (malformed JSON, a hallucinated tool argument, an API 500) is recoverable the same way any distributed-systems failure is. What's different in agent loops is that failures happen *inside* a multi-step reasoning chain the model itself is driving — an uncaught bad tool result doesn't just break one operation, it becomes an observation the model reasons from in the next step, and the model will confidently build further incorrect actions on top of it unless the failure is surfaced back into the loop explicitly.

## Layered recovery: mechanical retries first

Not every failure needs the model involved. Transient infrastructure failures (network timeout, rate limit, 5xx) should be retried mechanically, below the agent's reasoning layer, with **exponential backoff and jitter** — the standard distributed-systems pattern (AWS's guidance: base delay, doubling per attempt, capped, randomized to avoid thundering-herd retries against a struggling backend). This layer never involves the LLM; it's plain retry middleware around the tool-execution step. Reserve a hard cap (e.g., 3-5 attempts) and then surface the failure upward as a genuine error, rather than retrying indefinitely and burning latency/cost on a dependency that's actually down.

## Tool-level errors: return structured failures, not exceptions

When a tool call fails for a reason the model can plausibly fix — invalid argument, resource not found, permission denied — return that as a **structured tool result marked as an error**, not a thrown exception that aborts the run. Both OpenAI's and Anthropic's tool-use APIs support an explicit error flag on tool results for exactly this reason: it lets the model see "this call failed, here's why" as an observation and decide how to adapt (fix the argument and retry, try a different tool, ask the user for clarification) — the same self-correction ReAct-style loops already do for unexpected observations, just applied to failures instead of successes.

## Self-correction: model-driven reflection

For failures that are logical rather than mechanical — a generated answer that's wrong, code that doesn't pass its own tests, a plan step that turns out to be infeasible — two named patterns dominate:

- **Self-Refine** (Madaan et al., 2023): the model generates an output, then generates feedback on its own output, then revises based on that feedback, iterating a fixed number of rounds or until the feedback signals "no further issues." Works within a single task instance, no external verifier needed — but is only as good as the model's ability to critique its own work, which is weaker for tasks it couldn't verify in the first place (it can catch a syntax error it can also catch by re-reading, but not a subtly wrong business assumption).
- **Reflexion** (Shinn et al., 2023): after a failed attempt at a task (verified externally — a failing test, a wrong final answer, an environment signal), the agent generates a *verbal* reflection on why it failed, stores that reflection in an episodic memory buffer, and retries the task with the reflection included in context. This is meaningfully different from plain retry-with-error-message because the reflection is a distilled, model-generated diagnosis, not just the raw error — closer to how a person debugs by writing down "what went wrong" before trying again. Reported gains are largest on tasks with a clear pass/fail verifier (coding benchmarks, decision-making environments); it's markedly less effective without one, since there's nothing external to confirm the reflection was even correct.

## Bounding the loop

Self-correction loops need an explicit exit condition or they either loop forever or silently degrade — the model can "fix" a failing test by weakening the assertion instead of fixing the code, especially under repeated pressure to make an error go away. Production systems bound this with: a max retry/reflection count, a step budget or token budget for the whole task, and ideally an external verifier the model can't game (a real test suite run in a sandbox, not the model's own judgment of correctness) as the actual pass/fail signal rather than the model self-reporting success.

## Common mistakes

- **Swallowing tool errors silently** (returning an empty result instead of an error-flagged one) — the model has no signal that something went wrong and proceeds as if the empty result were valid data.
- **Retrying model-caused logical errors with mechanical backoff** — re-running the exact same prompt against the exact same failure produces the same failure; only reflection or corrected input breaks the loop.
- **No retry cap on self-correction**, letting a stuck agent burn tokens indefinitely or, worse, "fix" the problem by relaxing the success criterion instead of the underlying issue.
