---
title: "Context Windows and Token Economics"
short_title: "Context Windows and Tokens"
tags: ["tokens", "context-window", "llm", "foundations"]
sources:
  - "OpenAI and Anthropic documentation on tokenization and context window limits"
  - "Hugging Face tokenizers documentation"
---

## What a token actually is

An LLM doesn't process text character by character or word by word — it processes **tokens**, sub-word units produced by a tokenizer trained to balance vocabulary size against sequence length. Common English words are often single tokens; rarer words, unusual names, and non-English text frequently split into multiple tokens. This isn't a minor implementation detail — it directly determines cost (most APIs price per token) and how much content fits in a model's context window, and it means "word count" is a poor proxy for either.

A rough rule of thumb for English text: about 4 characters per token, or roughly 0.75 tokens per word — but this varies meaningfully by content type. Code, non-English text, and text with unusual formatting or lots of punctuation often tokenize less efficiently (more tokens per character) than plain English prose, which matters when estimating cost or context budget for those content types specifically.

## The context window is a hard, not soft, limit

Every model has a maximum context window — the total number of tokens it can process in a single call, covering the system prompt, conversation history, any retrieved or injected content, and the model's own output, all combined. This is a hard architectural limit, not a soft guideline: a request exceeding it doesn't degrade gracefully, it fails outright (or gets silently truncated, depending on the API), which is why applications with unbounded or growing input (long conversations, large documents) need an explicit strategy for staying under the limit, not an assumption that it won't be hit.

## Why a bigger context window doesn't eliminate the need for careful context management

It's tempting to treat a large context window (increasingly common in modern models) as removing the need to think carefully about what goes into the prompt — "just include everything, there's room." Two things complicate this:

- **Cost scales with tokens used**, regardless of window size — filling a 200K-token window on every call is expensive even if the window technically allows it, especially for high-volume applications where that cost multiplies across every request.
- **"Lost in the middle" effects** (covered in this track's prompting fundamentals lesson) mean a model's ability to find and use a specific piece of information degrades as it's buried deeper within a very long context, even when the window technically has room for it — a large context window increases what *can* fit, not necessarily what the model will *reliably use well*.

This means the practical design question is rarely "does it fit" once context windows got large — it's "should it be here," since relevance and cost both argue for deliberate curation over maximal inclusion, independent of whether the window technically has room.

## Managing context in long-running conversations

A chat application that keeps sending the full conversation history on every turn will eventually hit the context window limit as the conversation grows, and will pay increasing cost per turn even before hitting it (since token count, and therefore cost, grows with every exchange). Common strategies:

- **Sliding window** — keep only the most recent N turns, dropping older ones. Simple, but loses information from earlier in the conversation that might still be relevant ("as I mentioned earlier..." references can break).
- **Summarization** — periodically compress older turns into a shorter summary, replacing the verbose original exchange with a condensed version that preserves the gist at a fraction of the token cost. Retains more information than a hard sliding window cutoff, at the cost of some fidelity loss and the complexity of a summarization step.
- **Retrieval over history** — treat conversation history like a RAG problem (per this track's RAG lesson): store the full history externally, and retrieve only the turns relevant to the current message rather than including everything chronologically. Useful for very long-running sessions where most of the history is irrelevant to any given turn.

## A worked example

**Scenario:** a coding assistant that needs to maintain context across a long pair-programming session, potentially spanning hours and many file references, without blowing through the context window or the per-request cost budget.

- **Static, reusable content** (the system prompt defining the assistant's behavior, and any consistently-relevant project context like a style guide) is placed early in the prompt and kept stable across calls, positioned specifically to benefit from prompt caching (covered in this track's cost-and-latency lesson) — reducing both cost and latency for the portion of the context that doesn't change turn to turn.
- **Conversation history** uses a hybrid approach: the most recent several turns are kept verbatim (since recent context is usually most relevant to the current request), while older turns are periodically summarized into a compact running summary rather than dropped entirely or kept in full — balancing context window budget against not losing useful earlier context.
- **File contents** referenced during the session aren't kept in the conversation history indefinitely once discussed — instead, the assistant re-reads a file when it becomes relevant again, rather than paying to keep every previously-viewed file's full content in context for the entire session regardless of continued relevance.

## Common mistakes

- **Estimating cost or context usage in words instead of tokens.** Given the roughly 0.75 words-per-token ratio for English (and worse ratios for code or non-English text), word-based estimates can be meaningfully off from actual token counts, especially for content types that tokenize inefficiently.
- **Assuming a large context window means context curation doesn't matter.** As covered above, cost and the lost-in-the-middle effect both persist regardless of window size — a large window changes what's technically possible, not what's advisable.
- **No strategy for growing conversation history until the context limit is actually hit in production.** By the time a real user's long conversation fails outright, the fix is an urgent patch rather than a planned design decision — history management needs to be designed in from the start for any application with open-ended conversation length.
