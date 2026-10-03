---
title: "Agent Memory Architectures: Short-Term, Long-Term, and Episodic"
short_title: "Agent Memory Architectures"
tags: ["agents", "memory", "llm", "context"]
sources:
  - "LangChain documentation on memory types for agents"
  - "MemGPT paper: Packer et al., 'MemGPT: Towards LLMs as Operating Systems' (2023)"
---

## Why "memory" for an agent is a real design problem, not just context history

This track's context-windows lesson covered managing conversation history within a single session. Agents that need to operate across multiple sessions, or over long-running tasks that outlast any single context window, need memory that persists and is selectively retrieved beyond what fits in one context window at a time — genuinely different from simply keeping a conversation history, since it requires deciding what's worth remembering long-term, how to store it, and how to retrieve the relevant parts back into context when needed later.

## Short-term (working) memory: the current context window

The most basic form — everything currently in the active context window (the ongoing conversation, recent tool results, the current task's intermediate state) — is what this track's context-windows and agent-loops lessons already cover. This is inherently bounded by the context window's size and lost once the session ends, unless explicitly persisted elsewhere.

## Long-term memory: persisting knowledge across sessions

**Long-term memory** stores information that should be available to the agent in future sessions, beyond the current conversation — user preferences learned over time, facts established in past interactions, or task-relevant knowledge accumulated across many prior sessions. This is architecturally similar to the RAG pattern from this track's RAG fundamentals lesson: information is stored externally (often in a vector store, enabling semantic retrieval), and relevant pieces are retrieved into context when needed for the current interaction, rather than every past interaction's full detail being kept permanently in the active context window (which would quickly exceed any context window's size across enough sessions).

The design question long-term memory raises that plain RAG over static documents doesn't: what should actually be written to long-term memory in the first place, and when. Writing everything indiscriminately (every message, every tool result) produces a noisy memory store where genuinely important facts are hard to retrieve accurately among a flood of low-value detail; writing nothing loses useful context that should have carried forward. Production agent memory systems typically use an explicit "memory writing" step — often its own LLM call, evaluating whether a given interaction contains something worth persisting (a stated user preference, a resolved decision, a significant fact) before committing it to long-term storage, rather than treating every interaction as equally memory-worthy by default.

## Episodic memory: remembering specific past experiences, not just facts

A related but distinct category: **episodic memory** stores specific past experiences or interactions (not just extracted facts) that the agent might want to reference or learn from — "the last time I tried this approach to solve a similar problem, here's what happened." This is useful for agents that benefit from precedent (a coding agent recalling how a similar bug was previously fixed, a customer support agent recalling how a similar prior case was resolved) — retrieved via similarity to the current situation, much like RAG retrieval, but over a store of past episodes/experiences rather than static reference documents.

## The context-window-as-constraint problem, and paging strategies

Even with well-curated long-term and episodic memory, an agent handling a long-running, complex task can accumulate more relevant context than fits in one context window at once. Some agent memory architectures (MemGPT being a notable example) draw an explicit analogy to operating system virtual memory: treating the context window as a limited "physical memory" and the full long-term memory store as "virtual memory," with an explicit mechanism (sometimes itself agent-controlled, via a dedicated memory-management tool call) to page relevant information in and out of the active context window as the task's needs shift — rather than a fixed, one-time context assembly at the start of a task that can't adapt as the task progresses and different information becomes relevant.

## A worked example

**Scenario:** a personal assistant agent needs to remember a user's stated preferences (dietary restrictions, preferred meeting times) across many separate conversations over months, without needing the user to re-state them every time.

- **Long-term memory writing**: after each conversation, a dedicated memory-extraction step (a separate LLM call, evaluating the conversation for anything preference-relevant) identifies and writes any newly-stated or updated preferences to a persistent store — not logging the entire raw conversation, specifically to keep the memory store precise and retrievable rather than accumulating noise that would make genuinely relevant preferences harder to find later via similarity search.
- **Retrieval at the start of each new conversation**: rather than including the user's entire preference history in every new session's initial context (which could grow unboundedly over months of use), a targeted retrieval step pulls only the preferences relevant to the current conversation's apparent topic (dietary preferences retrieved for a restaurant-recommendation request, scheduling preferences retrieved for a meeting-booking request) — directly analogous to RAG's targeted retrieval rather than indiscriminate inclusion.
- **Episodic memory for a support-style use case layered in**: if the assistant also handles troubleshooting requests, a separate episodic store of past resolved issues (this specific user's or a broader pool's) can be retrieved when a similar-sounding new issue arises, informing the agent's approach with precedent rather than starting from scratch each time.

## Common mistakes

- **Writing every raw interaction to long-term memory indiscriminately**, producing a noisy store where retrieval quality degrades as genuinely important facts get lost among a large volume of low-value logged detail — an explicit memory-writing/curation step, deciding what's actually worth persisting, is what avoids this.
- **Including a user's full historical memory in every new session's context regardless of relevance**, rather than retrieving only what's relevant to the current interaction — this wastes context window budget and cost (per this track's cost-and-latency lesson) and risks the lost-in-the-middle effect diluting the actually-relevant retrieved memories among irrelevant ones.
- **Conflating short-term conversational context with long-term persistent memory as if they were the same mechanism.** They serve genuinely different purposes (immediate task state versus durable cross-session knowledge) and typically need different storage, retrieval, and curation strategies — treating them identically tends to produce a system that does neither job well.
