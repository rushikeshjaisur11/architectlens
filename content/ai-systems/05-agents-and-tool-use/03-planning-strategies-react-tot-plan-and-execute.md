---
title: "Planning Strategies: ReAct, Tree-of-Thought, and Plan-and-Execute"
short_title: "Agent Planning Strategies"
tags: ["planning", "react", "tree-of-thought", "plan-and-execute", "agents"]
sources:
  - "ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2022, arXiv:2210.03629)"
  - "Tree of Thoughts: Deliberate Problem Solving with Large Language Models (Yao et al., 2023, arXiv:2305.10601)"
  - "Plan-and-Solve Prompting (Wang et al., 2023, arXiv:2305.04091)"
  - "Anthropic documentation, extended and adaptive thinking (fetched October 2026)"
banner:
  layout: loop
  nodes:
    - [model, "plan"]
    - [server, "act"]
    - [doc, "observe"]
predict:
  question: "A team replaces a single ReAct pass with Tree-of-Thought over its whole agent loop. What happens to token cost?"
  options: ["It stays near the same because pruning offsets the branching", "It roughly doubles, from one added evaluation pass per step", "It can rise 5 to 30 times, since candidates are generated and scored per node"]
  answer: 2
  why: "Cost multiplies by branching factor and depth, which is why ToT is reserved for bounded sub-tasks."
check:
  - q: "Why does plan-and-execute without a replan step fail?"
    options: ["The agent keeps executing a stale plan after an early step fails", "The executor's context grows with every step in the history", "The planner model is too weak to produce an ordered task list"]
    answer: 0
    why: "An immutable plan is run against a changed world, so replanning must be an explicit step after each execution."
  - q: "Why is Tree-of-Thought a poor fit for half-finished customer support resolutions?"
    options: ["Support tasks need a larger branching factor than ToT supports", "There is no cheap way to score partial states, so search becomes sampling", "ToT cannot call tools, so it cannot touch support systems"]
    answer: 1
    why: "Without an evaluator for partial states, the search degenerates into expensive random sampling."
  - q: "What is the common production way to combine the strategies?"
    options: ["Run ToT over the full loop and ReAct only for the final answer", "Run ReAct at the top level and plan-and-execute for each tool call", "Plan-and-execute at the top, ReAct per sub-task, ToT for combinatorial bits"]
    answer: 2
    why: "This gets an auditable plan and reactive execution while limiting ToT's cost to sub-tasks that are cheaply evaluable."
---

## Why planning strategy is a separate design choice

An agent loop needs a policy for deciding what to do next given the current state. The three dominant strategies — ReAct, Tree-of-Thought, and plan-and-execute — trade off latency, cost, and robustness to error differently, and picking the wrong one for the task shape is a common source of both runaway cost and poor task completion.

## ReAct: interleaved reasoning and acting

ReAct (Yao et al., 2022) has the model alternate **Thought → Action → Observation** steps in a single loop: reason briefly about what to do, call a tool, read the result, reason again. The key property is that each action is conditioned on the *actual* observation from the previous one, not a plan made in advance — so it adapts naturally when a tool call returns unexpected data (an empty search result, an API error).

- **Strength:** cheap per-step, reactive to real-world feedback, simple to implement as a single system prompt with a scratchpad.
- **Weakness:** no lookahead. It can commit to a locally-reasonable action that's globally wrong (e.g., booking the first flight found instead of comparing options) because it never explicitly considers alternatives before acting. It also accumulates the full thought/action/observation history in context, which grows linearly with steps and eventually crowds out the context window on long-running tasks.
- **Best fit:** tasks where the next best action genuinely depends on fresh tool output — research, debugging, multi-turn tool chains where early steps inform later ones.

## Tree-of-Thought: explicit search over reasoning paths

Tree-of-Thought (Yao et al., 2023) treats reasoning as a search problem: at each step, the model generates *multiple* candidate next-thoughts (a branching factor, e.g., 3-5), a separate evaluation step scores or prunes them (self-evaluation prompting, or a value function), and the search proceeds via BFS or DFS over the surviving branches until a solution is found or a depth limit hit.

- **Strength:** materially better on tasks with a well-defined success criterion and combinatorial structure — the original paper demonstrates large gains on Game of 24 and creative writing tasks where single-path generation gets stuck in local minima.
- **Weakness:** cost multiplies by the branching factor and search depth — a ToT run can be 5-30x more expensive in tokens than a single ReAct pass, since multiple candidates are generated and scored at every node. It also needs a way to *evaluate* partial states, which is straightforward for puzzles with checkable answers and much harder for open-ended agentic tasks (how do you score a half-finished customer support resolution?).
- **Best fit:** bounded, evaluable problems — planning under constraints, code generation with test-based verification, puzzle-like tasks — not open-ended tool-use loops.

## Plan-and-execute: decouple planning from acting

Plan-and-execute (and the related Plan-and-Solve prompting) splits the loop into two roles: a **planner** produces an explicit ordered task list upfront (often with a dedicated, more capable model), and an **executor** carries out each step, one tool call or sub-task at a time, optionally replanning if a step fails or new information invalidates the rest of the plan.

- **Strength:** the upfront plan is auditable and interruptible — a human can review or edit it before execution starts, which matters for high-stakes actions. It also keeps the executor's context window smaller per step, since it only needs the current sub-task, not the full reasoning history.
- **Weakness:** the initial plan can be wrong in ways that only surface mid-execution, and naive implementations don't replan — they execute a stale plan against a changed world. Production systems (e.g., LangGraph's plan-and-execute pattern, BabyAGI's task-queue loop) address this by making replanning an explicit step after each execution, not an afterthought.
- **Best fit:** tasks decomposable into a known, mostly-stable sequence of sub-tasks — multi-step data pipelines, structured workflows, tasks where a human wants to approve the plan before any action is taken.

## Choosing and combining

These aren't mutually exclusive: a common production pattern is plan-and-execute at the top level (decompose the goal into ordered sub-tasks) with a ReAct loop executing each individual sub-task (react to that sub-task's tool results). Reserve Tree-of-Thought for the specific sub-tasks that are genuinely combinatorial and cheaply evaluable — running it over the entire agent loop is usually cost-prohibitive relative to the accuracy gain.

## Current practice (verified October 2026)

Reasoning models change how much explicit planning scaffolding you need. With adaptive thinking and an effort setting, the model decides per request how much to reason, and interleaved thinking lets it reason between tool calls inside one turn, so a ReAct-style loop can be shorter. Keep explicit plan-and-execute structure where you need auditability, resumability (a stored plan survives a crash) or parallel sub-tasks; use model-internal reasoning for local decisions. Measure steps and cost per task, not just success.

## Common mistakes

- **Using ReAct for tasks that need lookahead** (e.g., multi-step financial planning) and getting locally-greedy, globally-suboptimal action sequences.
- **Using Tree-of-Thought on tasks with no cheap evaluator** — without a way to score partial states, the "search" degenerates into expensive random sampling.
- **Plan-and-execute without a replan step** — treating the upfront plan as immutable causes the agent to keep executing steps that no longer make sense after step 2 fails.
