---
title: "Designing an Autonomous Software Engineering Agent"
short_title: "Software Engineering Agent"
tags: ["coding-agent", "sandbox", "verification", "pull-requests", "design"]
sources:
  - "Jimenez et al., 'SWE-bench: Can Language Models Resolve Real-World GitHub Issues?' (2023)"
  - "Yang et al., 'SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering' (2024)"
  - "Public documentation of container sandboxes and CI systems"
  - "SWE-bench Pro (Scale AI) and SWE-bench Verified leaderboard summaries, October 2026 (secondary: benchlm.ai, morphllm.com)"
  - "Sandboxing and agent security guidance: OWASP Top 10 for Agentic Applications 2026, ASI05 Unexpected Code Execution"
banner:
  layout: loop
  nodes:
    - [doc, "issue"]
    - [model, "agent"]
    - [shield, "tests"]
predict:
  question: "After the fix, the broad test suite shows one unrelated flaky test. What does the agent do?"
  options: ["It reruns the test and notes the flake in the pull request", "It deletes the flaky test so the suite passes cleanly", "It silently ignores the failure and reports all tests green"]
  answer: 0
  why: "The worked example has the agent rerun the flaky test and note it in the PR."
check:
  - q: "Why give the agent purpose-built search and edit tools instead of a raw shell?"
    options: ["Raw shells cannot run tests inside a sandbox", "Concise results and lint feedback shrink context and catch mistakes immediately", "Purpose-built tools allow the agent to merge its own changes"]
    answer: 1
    why: "The lesson says good tools shrink context, give fast feedback and reduce errors more than prompt tweaks."
  - q: "Why rely on external checks such as tests rather than the model's confidence?"
    options: ["Model confidence is not available from the inference API", "Tests are quicker to run than the model is to answer", "Reliability comes from verifying results, not from how sure the model sounds"]
    answer: 2
    why: "The lesson says reliability comes from external checks; a change that passes no meaningful checks is reported as unverified."
  - q: "Why replay your own closed tickets instead of trusting public benchmark scores?"
    options: ["Scores do not predict performance on your repositories, tests and conventions", "Public benchmarks have been withdrawn by their authors", "Your own tickets are guaranteed free of contamination by training data"]
    answer: 0
    why: "The lesson says benchmark scores depend on the harness and do not predict performance on your own code."
---

## The problem

Given a ticket ("fix the failing date parsing for time zones"), an autonomous software engineering agent explores a repository, makes changes, runs the tests, and opens a pull request for human review. Unlike autocomplete, it acts over many steps with real tools, so the engineering centres on **sandboxing, verification and bounded autonomy**.

## Step 1: Requirements

- **Capability:** handle well-scoped issues: bug fixes, small features, refactors, dependency bumps.
- **Safety:** cannot damage production, leak secrets or exfiltrate code; every change goes through review.
- **Verifiability:** every PR comes with evidence: tests run, results and a summary.
- **Cost control:** bounded tokens and runtime per task.
- **Scale (example):** 5,000 tasks per day across thousands of repositories.

## Step 2: Architecture

- **Task intake:** from an issue tracker or chat; the agent restates the task and the acceptance criteria.
- **Orchestrator:** manages the task lifecycle, budgets and retries.
- **Sandbox:** an ephemeral container or microVM per task with a checkout of the repo, the project's toolchain, limited network and no production credentials.
- **Agent loop:** the model uses tools (read file, search, edit, run command, run tests) in the sandbox.
- **Verifier and reporter:** runs the full test suite and linters, collects the diff, writes the PR description, and posts results.

## Step 3: The tool interface matters enormously

Raw shell access is hard for models to use well. A purpose-built **agent-computer interface** helps:

- **Search tools** that return concise, ranked results with line numbers rather than megabytes of grep output.
- **Viewing** files in windows, not whole large files.
- **Editing** via structured, validated operations (replace a range, apply a patch) with immediate **syntax and lint feedback**, so mistakes are caught right away.
- **Test running** with summarised failures.

Good tools shrink the context, give fast feedback and reduce errors far more than prompt tweaks.

## Step 4: Finding the right code

Large repositories require navigation: use code search, symbol indexes, the language server, and an embedding index to locate relevant files. A repository map (a compact outline of files and symbols) in the prompt helps orientation. Encourage a **reproduce first** habit: write or locate a failing test before changing code, which both focuses the search and provides a verification target.

## Step 5: Verification as the core loop

The agent's reliability comes from external checks, not from the model's confidence:

1. Reproduce the failure with a test.
2. Make the change.
3. Run the targeted tests, then the broader suite, linters and type checks.
4. Iterate on failures for a bounded number of rounds.
5. Review its own diff for scope creep (unrelated edits) and leftover debugging code.

Where tests are missing, the agent can add them, but the PR must flag that. A change that passes no meaningful checks is reported as **unverified**.

## Step 6: Security and containment

- **Network egress** restricted to package mirrors and the repository host; no arbitrary internet.
- **Secrets** never present in the sandbox; scoped, short-lived tokens only for opening the PR.
- **Prompt injection** from issue text, code comments or dependencies is a real risk; the agent must not follow instructions found in repository content that conflict with the task, and cannot take destructive actions anyway.
- **Resource limits** (CPU, memory, time) and a kill switch.
- **Human review is mandatory** before merge; the agent cannot approve its own work.

## Step 7: Cost, scale and evaluation

Sandboxes are the main infrastructure cost: pre-built images per repository, warm pools, and caching of dependencies cut start-up from minutes to seconds. Token cost is controlled by compact tools and by stopping tasks that are not converging. Evaluate with **benchmark suites of real issues** (does the agent's patch make the hidden tests pass), plus production metrics: PR acceptance rate, review comments per PR, time to merge and revert rate. Analyse failed tasks by category (misunderstood issue, wrong file, flaky test) to guide improvements.

## A worked example

**Scenario:** an issue says "`parse_date` returns the wrong day for dates in UTC+13".

1. The orchestrator starts a sandbox from the repo's prepared image and gives the agent the issue and a budget.
2. The agent searches symbols, finds `parse_date`, and writes a failing test reproducing the bug with a UTC+13 input.
3. It fixes an off-by-one in the offset normalisation; the linter flags an unused import it had added, which it removes.
4. The targeted tests pass; the broad suite shows one unrelated flaky test, which the agent reruns and notes in the PR.
5. It opens a PR with the diff, the new test, the test results and a note on the flaky test, then waits for human review; a reviewer asks for a comment, the agent amends, and the PR merges.

## Enterprise practice (verified October 2026)

**Basics.** Clone the repo in a sandbox, plan, edit, run tests, iterate, open a pull request for review (steps above).

**How to read benchmark claims (secondary sources, October 2026).** **SWE-bench Verified** (500 human-validated Python tasks) is saturated: leaderboards now show scores in the mid-90s, and reports say OpenAI stopped using it in February 2026 over contamination concerns. **SWE-bench Pro** (Scale AI; about 1,865 tasks across 41 repositories in Python, Go, TypeScript and JavaScript, including private proprietary code) is the contamination-resistant alternative; the October 2026 leaderboard reportedly has the top model near **90%** and several others above 80%. Scores also depend heavily on the agent harness, not just the model. None of this predicts performance on your repositories, tests and conventions.

**Enterprise pattern.** Evaluate on **your own historical issues**: replay 100 or more closed tickets against the pre-fix commit and score by your test suite plus reviewer rating. Run each task in an ephemeral, network-restricted sandbox with no production credentials (OWASP ASI05: unexpected code execution), grant write access only to a branch, require human review for merge, cap tokens and wall-clock per task, and record the full trajectory for audit. Track merge rate, review-edit rate and revert rate, not just "tests pass".

## Common mistakes

- **Giving the model an unrestricted shell** instead of purpose-built tools.
- **No reproduction or test run**, so confidence replaces evidence.
- **Secrets or broad network access in the sandbox.**
- **Letting the agent merge its own changes.**
- **Counting tasks attempted** rather than accepted and not reverted.
