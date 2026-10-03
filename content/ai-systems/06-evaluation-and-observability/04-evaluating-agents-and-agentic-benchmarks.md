---
title: "Evaluating Agents: Trajectories, Reliability and Agentic Benchmarks"
short_title: "Evaluating Agents"
tags: ["evaluation", "agents", "benchmarks", "reliability", "trajectories"]
sources:
  - "Agent benchmark overviews, 2026: Terminal-Bench 2.0, GAIA, tau-bench, OSWorld, SWE-bench Pro; Holistic Agent Leaderboard (secondary summaries and arXiv 2602.16666, 'Towards a Science of AI Agent Reliability')"
  - "SWE-bench Pro (Scale AI) and SWE-bench Verified leaderboard summaries, October 2026 (secondary)"
---

## Why agents need their own evaluation

Evaluating a single model call means comparing one output with a reference. An agent produces a **trajectory**: a sequence of reasoning steps, tool calls and observations ending in a final state. Two agents can reach the same correct answer, one in four clean steps and one in forty with three dangerous side effects. Output-only scoring misses that. It also hides **variance**: the same agent on the same task succeeds on one run and fails on the next because sampling, tool latency or a page layout differs.

## Three questions to measure

1. **Did it achieve the goal?** Outcome correctness, checked against the *final state* of the world where possible: the ticket is closed, the file exists, the tests pass, the database row is correct. State checks are more robust than reading the agent's own claim.
2. **How did it get there?** Steps, tool errors, repeated calls, cost, time, and whether it stayed within permissions. A correct answer reached by calling a forbidden tool is a failure.
3. **How reliably?** Run each task several times. Report pass rate over repeats, and the stricter "passes *every* time" rate, since a customer experiences each run.

## Reliability is multiplicative

If an agent succeeds on 95% of individual steps and a task needs 10 steps, task success is about 0.95^10, near 60%. Per-step accuracy that sounds high produces low task success on long horizons, which is why agents that look good in demos disappoint in production and why shortening trajectories (better tools, fewer steps) helps as much as a better model. Reliability research for 2026 makes the same point: consistency across repeated runs should be reported separately from average accuracy.

## The benchmark landscape (2026, secondary summaries)

- **SWE-bench Verified**: 500 human-validated Python tasks; now saturated, with top scores in the mid-90s and reports that at least one major lab stopped relying on it over contamination concerns.
- **SWE-bench Pro** (Scale AI): about 1,865 tasks across 41 repositories in several languages, including private code to resist contamination; top models are reported near 80 to 90%.
- **Terminal-Bench 2.0**: around 89 terminal tasks scored deterministically by exit codes, file diffs or output.
- **GAIA**: 466 general-assistant tasks needing browsing, file reading and tools.
- **tau-bench**: tool-using customer-service tasks under a policy manual (retail, airline); reports of top results near 85 to 90%.
- **OSWorld**: desktop tasks via screenshots.
- **Holistic Agent Leaderboard**: aggregates nine benchmarks across coding, web, general assistance and customer service.

Scores depend heavily on the **harness** (prompting, tools, retries) as well as the model, so quoted numbers are not comparable across harnesses. None predicts your results.

## Building an evaluation for your agent

1. **Collect real tasks** from logs and tickets; include easy, typical and hard ones.
2. **Make each task a runnable environment**: a sandboxed copy of the system with a known start state and an automatic checker for the end state.
3. **Score on several axes**: success, safety violations, cost, steps.
4. **Run K repeats** (5 is common) and report mean and "all K" success.
5. **Log full trajectories** so failures can be classified: wrong tool, bad arguments, misread result, gave up early, looped.
6. **Gate releases** on the set and add every production failure as a new case.

## A worked example

A procurement agent is tested on 60 tasks, 5 runs each.

- Mean success: 82%. Success on all 5 runs: 58%.
- 7% of runs called the "approve" tool without the required quote check (a safety failure the outcome score missed).
- Median 14 steps; a prompt change that merges two lookup tools cuts it to 9 steps, success rises to 87%, and cost per task falls 30%.
- The release gate becomes: all-5-runs success at least 60%, zero safety violations, cost per task under budget.

## Common mistakes

- **Reporting a single run** per task.
- **Scoring the final answer only**, missing unsafe or wasteful paths.
- **Trusting the agent's claim of success** instead of checking state.
- **Quoting public benchmark numbers** as expected production performance.
- **Evaluations that share state**, so one task's leftovers change the next.
