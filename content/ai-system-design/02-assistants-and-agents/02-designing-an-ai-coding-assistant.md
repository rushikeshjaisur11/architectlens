---
title: "Designing an AI Coding Assistant"
short_title: "AI Coding Assistant"
tags: ["coding-assistant", "latency", "context", "indexing", "design"]
sources:
  - "Public engineering write-ups on code completion latency, fill-in-the-middle training and repository indexing"
  - "Bavarian et al., 'Efficient Training of Language Models to Fill in the Middle' (2022)"
  - "Language Server Protocol specification"
---

## The problem

Developers want help inside their editor: inline completions as they type, a chat that understands their codebase, and edits applied across files. These are really **three products with different constraints** sharing one context layer. Completion must feel instant, chat must be accurate about the repository, and agentic edits must be safe.

## Step 1: Requirements

- **Inline completion:** suggestions within roughly 200 to 400 ms of a pause, tens of thousands of requests per second across users.
- **Chat:** answers about the codebase with file references; follow-ups.
- **Edits:** propose multi-file changes the user reviews and applies.
- **Constraints:** private code must stay private, respect ignore files and secrets, work offline-ish on flaky connections, and not drive up cost per developer.

## Step 2: Three paths, three model tiers

| Path | Latency budget | Model |
|---|---|---|
| Inline completion | ~300 ms | small, fast, fill-in-the-middle |
| Chat | seconds, streamed | larger general model |
| Multi-file edit / agent | tens of seconds | strongest model, tool use |

Using one big model for everything is too slow for completions and wasteful for chat. Route by feature.

## Step 3: Building the context

Quality depends mostly on **what is put in the prompt**.

- **Immediate context:** the text before and after the cursor (fill-in-the-middle), the current file, and recently edited files.
- **Related code:** symbols the file imports, definitions of functions being called (from the language server), and similar code found by search.
- **Repository index:** the codebase is chunked by function or class and indexed with embeddings plus keyword and symbol search. Update incrementally on save and on branch changes, keyed by file hash.
- **Rules and conventions:** project-level instructions files, style guides.

Context has a strict token budget. Rank candidates by relevance and recency, trim, and place the most important code nearest the cursor.

## Step 4: Latency engineering for completions

Completion is a latency game.

- **Debounce** keystrokes and **cancel** stale requests as the user types on.
- **Stream** and show the first tokens quickly; stop early at a natural boundary (end of statement or block).
- **Cache** results keyed by the prefix, and reuse the model's processed prompt state where the prefix is shared.
- **Speculation:** short, high-confidence completions can be served from a small local model or cache.
- **Edge placement:** inference regions near users, persistent connections to avoid handshakes.
- **Acceptance rate** is the north-star metric, not only latency: a fast wrong suggestion is noise.

## Step 5: Indexing the repository

A background indexer watches the workspace. It splits files with a syntax-aware parser so chunks follow function boundaries, computes embeddings (often on the server, with only hashes and chunk text sent), and stores them in a per-repository index. Respect `.gitignore` and secret scanners: never index credentials. For large monorepos, index lazily by directory and by what the developer has touched.

## Step 6: Safe edits

Agentic edits change real files, so they need guardrails:

- Produce a **diff**, not silent writes; the user reviews and accepts.
- Run in a **sandbox** (worktree or container) for tests, with network and secrets restricted.
- Use the **language server and tests** as verifiers: if the proposed change does not compile or tests fail, feed the errors back for a bounded number of retries.
- Limit scope: files touched, commands allowed, and time.

## Step 7: Privacy and trust

Offer modes: no code retained, no training on customer code, and an option for self-hosted models. Send the minimum context needed. Filter secrets before they leave the machine. Log metadata (latency, acceptance) without code content unless the user opts in.

## Step 8: Evaluation

Measure **acceptance rate** and **characters kept** for completions, pass rates on held-out tasks for edits (does the generated change make the repo's tests pass), and retrieval quality for chat (was the right file in the context). Compare models and prompts using real, anonymized telemetry plus a fixed benchmark of repository tasks.

## A worked example

**Scenario:** a developer pauses mid-way through writing a function that parses dates.

1. The client debounces 150 ms, then sends the text before and after the cursor plus the file's imports.
2. The context service adds the signature of a helper `normalize_tz` found in the repo index and the project's test style.
3. The small completion model returns the next 40 tokens in 180 ms; the first token shows at 90 ms.
4. The developer keeps typing, which cancels an in-flight request for a stale prefix; a new request fires.
5. The suggestion is accepted; acceptance and latency are logged for the model comparison dashboard.

## Common mistakes

- **One model for every feature**, ignoring very different latency budgets.
- **Dumping whole files into the prompt** instead of ranking and trimming.
- **Indexing secrets and ignored files.**
- **Applying agent edits silently**, with no diff or test verification.
- **Optimising latency while ignoring acceptance rate.**
