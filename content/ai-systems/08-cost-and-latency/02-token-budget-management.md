---
title: "Token Budget Management Across Multi-Step Pipelines"
short_title: "Token Budget Management"
tags: ["cost", "token-budget", "pipelines", "llm"]
sources:
  - "Anthropic prompt caching and context window documentation (docs.anthropic.com)"
  - "LangChain / LangGraph documentation on context management (python.langchain.com)"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched October 2026)"
  - "Anthropic documentation, extended and adaptive thinking (fetched October 2026)"
predict:
  question: "A RAG pipeline retrieves 20 chunks \"to be safe\" when 5 would answer the query. How does this affect input tokens in the downstream calls?"
  options: ["It costs about 4x the input tokens on every downstream call that carries those chunks", "It costs the same, because only the final answer step pays for retrieved chunk tokens", "It costs about 2x, since retrieval overhead is paid once and later steps reuse the cache"]
  answer: 0
  why: "20 chunks versus 5 is 4x the input tokens, paid by every downstream call, not just the retrieval step."
check:
  - q: "Why does an agent loop that appends every tool result to its context cost far more than per-step estimates suggest?"
    options: ["Each new call re-processes the full history, so total tokens grow quadratically over the session", "Tool results are priced at the output rate, which multiplies the cost of each appended result", "The model re-reads only the latest result, but the framework bills every earlier call again"]
    answer: 0
    why: "Step n's prompt includes steps 1 through n-1, which compounds across the run."
  - q: "Why set a hard total-run ceiling on tokens or steps for an agent, not just per-step caps?"
    options: ["Per-step caps are ignored by providers, so only a run ceiling is enforced by the API", "A stuck loop could otherwise consume unbounded cost with no user-facing signal until the bill", "A run ceiling raises answer quality, because agents reason better with fewer total steps"]
    answer: 1
    why: "Per-step caps don't bound how many steps happen; a run-level ceiling with a forced termination path does."
  - q: "Why track input and output tokens separately rather than a single total?"
    options: ["Providers only report totals, so separating them requires estimating from prompt length", "Output tokens are priced several times higher, so a total hides where the dollars actually go", "Input tokens are free in most pipelines, so only output tokens need to be counted"]
    answer: 1
    why: "Different pricing means a combined total obscures which step drives the real cost."
---

## The core problem

A single LLM call's token cost is easy to reason about. A multi-step pipeline — agentic loops, RAG with re-ranking, chained summarization, tool-calling agents — compounds token usage in ways that aren't visible from any one step: each step's output often becomes the next step's input, context windows accumulate across turns, and a naive implementation re-sends the entire growing history on every call. A 5-step agent loop with no budget discipline can burn 10-50x the tokens of the "obvious" per-step estimate, because step *n*'s prompt includes everything from steps 1 through *n-1*.

**Token budget management** is the practice of treating tokens as an explicit, finite resource allocated per step and per pipeline run — not an unbounded byproduct of "just let the model see everything."

## Where the budget leaks

- **Unbounded context accumulation.** An agent loop that appends every tool call, tool result, and intermediate reasoning step to the running context grows quadratically in total tokens processed across a multi-turn session, since each new call re-processes the entire history.
- **Over-fetching in retrieval steps.** A RAG pipeline that retrieves 20 chunks "to be safe" when 5 would answer the query pays for 4x the input tokens on every downstream call in the pipeline, not just the retrieval step.
- **Verbose intermediate outputs.** A summarization step that produces a 500-token intermediate summary when the next step only needs 100 tokens of signal wastes budget that compounds across every subsequent step that reads it.
- **Re-sending static context.** System prompts, tool definitions, and reference documents that don't change turn-to-turn but get re-sent as full text on every call instead of being cached (see prompt caching) waste both cost and the token budget itself.

## Techniques

- **Per-step token caps.** Set an explicit `max_tokens` ceiling on each step's output based on what the next step actually consumes, not a generic default. A classification step producing a label needs tens of tokens, not thousands.
- **Context pruning / summarization between steps.** In long agent loops, periodically compress or drop earlier tool results and intermediate reasoning once they're no longer needed, rather than keeping the full transcript. Frameworks like LangGraph expose explicit state-trimming hooks for this.
- **Sliding window with anchoring.** Keep the most recent N turns verbatim plus a running summary of everything older, instead of the full history — bounds growth to roughly constant per-turn cost instead of linear/quadratic growth over a session.
- **Budget-aware retrieval (top-k tuning).** Treat retrieval count as a tunable cost parameter, not a fixed default — measure whether k=5 answers as well as k=20 on your eval set before paying for the larger context.
- **Total-run budget enforcement.** For agentic pipelines with unbounded step counts (an agent that keeps calling tools until it decides it's done), set a hard ceiling on total tokens or total steps per run, with a forced termination/summarization path when the ceiling is hit — otherwise a stuck loop can consume unbounded cost with no user-facing signal until the bill arrives.

## Measuring it

Track **tokens per pipeline run**, not just tokens per call — the run is the unit a user or business actually pays for. Logging per-step token counts (input/output separately, since they're priced differently) makes it possible to see which step in a 6-step pipeline is actually driving 70% of the cost, which is rarely obvious from looking at the pipeline's logic alone.

## Current practice (verified October 2026)

Budget more than prompt length: thinking tokens are billed as output and count against `max_tokens` (the fixed `budget_tokens` mode is deprecated on Claude 4.6 and rejected on 4.7 and later in favour of adaptive thinking with an effort level); tool definitions add hundreds to thousands of tokens per request; web search results become input tokens on that turn and every later turn that keeps them; and newer Claude tokenizers produce about 30% more tokens for the same text. Track input, cached, output, thinking and tool tokens separately per feature and set per-run caps.

## Common mistakes

- **Budgeting at the call level, not the pipeline level.** Optimizing one expensive-looking call while an accumulating context across 10 cheap-looking calls is the real cost driver.
- **No hard ceiling on agent loops.** A tool-calling agent with a bug that causes it to loop indefinitely has no natural stopping point without an explicit max-steps or max-tokens guard.
- **Treating retrieval count as fixed.** Defaulting to a round number like top-20 without testing whether the task needs it.
- **Not separating input and output token accounting.** Since output tokens are priced several times higher than input tokens, a budget that only tracks total tokens obscures where the real dollar cost is coming from.
