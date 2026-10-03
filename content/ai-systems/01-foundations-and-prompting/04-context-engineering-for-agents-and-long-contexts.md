---
title: "Context Engineering: Deciding What the Model Sees at Every Step"
short_title: "Context Engineering"
tags: ["context-engineering", "agents", "context-window", "compaction", "memory"]
sources:
  - "Anthropic Engineering, 'Effective context engineering for AI agents' (September 2025), anthropic.com/engineering (fetched October 2026)"
  - "Liu et al., 'Lost in the Middle: How Language Models Use Long Contexts' (2023)"
  - "Anthropic pricing documentation, prompt caching and long-context pricing (fetched October 2026)"
---

## From prompts to context

**Prompt engineering** asks how to word an instruction. **Context engineering** asks a larger question: of everything the model *could* be shown (instructions, tool definitions, retrieved documents, conversation history, tool results, memory), which tokens give the best chance of the behaviour you want, right now? Anthropic's engineering team defines it as curating and maintaining the optimal set of tokens during inference. The shift matters because agents run in loops: every turn appends tool results and reasoning, so the context grows, and what you leave in or take out is a design decision made dozens of times per task.

## Why more context is not better: context rot

A bigger window is not free capacity. As the number of tokens grows, the model's ability to recall any one fact from the context tends to fall, a pattern often called **context rot**. Anthropic ties it to the way attention works (every token relates to every other, so the budget of attention is spread thinner) and to training data, where short sequences dominate. Earlier research found a related position effect: facts in the middle of a long prompt are used less reliably than those at the start or end.

A concrete way to feel this: give a model a 2,000-token prompt with one instruction that must be followed, and it will follow it almost every time. Bury the same instruction inside 150,000 tokens of tool output and it will sometimes be ignored. Same model, same instruction; only the surrounding noise changed.

Long windows still have value, and on current rate cards a 1M-token window is billed at the standard per-token price. But cost per query, latency and recall all argue for a **small, high-signal context** rather than a full one.

## The anatomy of a good context

- **System instructions at the right altitude.** Too rigid (a brittle list of if-then rules) and the model fails on anything unplanned; too vague and it guesses. Aim for the minimal set of information that fully outlines the expected behaviour, organised under clear headings or XML tags.
- **Lean tools.** Each tool definition costs tokens on every request. If a human engineer could not say which of two tools to use, the model cannot either. Return only what is needed from a tool (a 40-line summary, not a 4,000-line log).
- **Canonical examples.** A few diverse, representative examples beat a long list of edge cases.
- **Just-in-time retrieval.** Instead of pre-loading every possibly relevant document, keep lightweight references (file paths, URLs, query strings) and let the agent fetch what it needs when it needs it, the way a developer uses `grep` and `head` instead of reading a whole repository.

## Techniques for long tasks

When a task outlives one context window, three techniques recur:

1. **Compaction.** When the history nears the limit, summarise it (decisions made, open problems, key facts) and start a fresh context seeded with the summary. Tune the summary prompt for *recall* first (losing a requirement is worse than keeping a redundant line), then trim.
2. **Structured note-taking.** The agent writes progress notes to a file or memory store outside the window and reads them back later. A task log such as "done: schema migration; next: backfill; blocker: lock timeout" lets work resume after a compaction or a crash.
3. **Sub-agents.** A coordinator delegates a focused job (search this codebase, research this question) to a sub-agent with a clean context; the sub-agent may burn tens of thousands of tokens exploring and returns a condensed summary of roughly 1,000 to 2,000 tokens.

## A worked example

A coding agent fixes a failing test in a large repository.

1. **Naive:** load 30 files (90,000 tokens) up front, then run tests and append 6,000 tokens of output each time. By turn 8 the context holds 140,000 tokens, mostly stale output; the agent starts repeating earlier mistakes.
2. **Engineered:** the context starts with 3,000 tokens (task, repo map, rules). The agent searches, opens only the two relevant files (4,000 tokens), runs the test and keeps just the failing assertion and stack frame (300 tokens, not 6,000), and writes a three-line note after each step. At turn 8 the context is about 12,000 tokens, and a sub-agent investigated an unrelated module without polluting it.

With a stable prefix (rules, tools) placed first and cached, the repeated 3,000 tokens also cost about a tenth of normal input price after the first turn.

## Practical rules

- Put stable content first and variable content last, so prompt caching works.
- Trim tool outputs at the tool, not in the prompt.
- Keep decisions and constraints verbatim in summaries; drop narration.
- Measure: log context size per turn and the share that is tool output; treat growth as a defect.
- Test long-horizon behaviour on real long tasks, because short evaluations hide context rot.

## Common mistakes

- **Stuffing the window** because the limit allows it.
- **Loading every tool** the agent might ever need instead of a task-relevant set.
- **Lossy compaction** that drops constraints stated early in the session.
- **Treating context as append-only** instead of curating it each turn.
- **Putting changing data at the top** and breaking the cache on every request.
