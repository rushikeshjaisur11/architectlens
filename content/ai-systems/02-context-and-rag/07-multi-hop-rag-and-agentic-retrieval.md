---
title: "Multi-Hop RAG and Agentic Retrieval"
short_title: "Multi-Hop RAG and Agentic Retrieval"
tags: ["rag", "multi-hop", "agentic-retrieval", "retrieval"]
sources:
  - "Trivedi et al., 'Interleaving Retrieval with Chain-of-Thought Reasoning for Knowledge-Intensive Multi-Step Questions' (2023, IRCoT)"
  - "LangChain and LlamaIndex documentation on agentic and multi-step retrieval patterns"
banner:
  layout: loop
  nodes:
    - [model, "plan"]
    - [db, "retrieve"]
    - [doc, "evidence"]
predict:
  question: "A user asks for the revenue growth rate of the company that acquired Company X in 2023. Why is one similarity search on that question unlikely to work?"
  options: ["The question is too long for any embedding model to turn into a vector", "The query does not name the acquirer yet, so no passage matches both facts", "The index holds only revenue passages, so acquisition facts are never retrieved"]
  answer: 1
  why: "The acquirer must be found first, and that intermediate fact then drives the second retrieval hop."
check:
  - q: "A pipeline always does exactly two retrieval hops. What is the weakness?"
    options: ["It underperforms on questions needing 3+ hops and wastes cost on 1-hop ones", "It is cheaper than agentic retrieval but cannot answer any question needing 2 hops", "It lets the model stop early, which risks answers built on too little evidence"]
    answer: 0
    why: "A rigid hop count ignores real question complexity, whereas agentic retrieval lets the model judge when it has enough."
  - q: "Why route simple questions to single-shot RAG and not run multi-hop on every query?"
    options: ["Multi-hop retrieval cannot answer questions that live in a single passage", "Multi-hop adds LLM calls and latency that most questions do not need", "Single-shot RAG is always more accurate than multi-hop for every question type"]
    answer: 1
    why: "Multi-hop earns its cost only for questions that connect information across sources. A cheap classification step can route them."
  - q: "A multi-hop system returns a wrong answer. Why log every hop's query, retrieved content and reasoning?"
    options: ["Per-hop logs make the final answer shorter and cheaper to generate", "Hop logs are required by the retriever to choose the next query", "It shows which hop failed: retrieval, intermediate reasoning, or final synthesis"]
    answer: 2
    why: "Each failure location needs a different fix, and only a per-hop trace can tell them apart."
---

## Why single-shot retrieval fails on genuinely multi-step questions

Basic RAG (per this track's RAG fundamentals lesson) retrieves relevant chunks once, based directly on the user's original query, then generates an answer from them. This works well when the answer lives in a single retrievable passage. It breaks down for questions that genuinely require connecting information across multiple documents in sequence — "what was the revenue growth rate of the company that acquired [Company X] in 2023" requires first finding who acquired Company X, *then* retrieving that acquiring company's revenue data — a single embedding-similarity search against the original question is unlikely to directly retrieve a passage containing both pieces of connected information, since the query itself doesn't mention the acquiring company by name yet.

## Multi-hop RAG: retrieving iteratively, informed by intermediate reasoning

**Multi-hop RAG** addresses this by interleaving retrieval and reasoning across multiple steps rather than retrieving once upfront: an initial retrieval and partial reasoning step identifies an intermediate fact needed to answer the question (who acquired Company X), and that intermediate fact is used to formulate a *new* retrieval query for the next hop (that acquiring company's revenue data), repeating until enough information has been gathered to answer the original question. This is conceptually similar to the ReAct pattern from this track's agent loops lesson — reasoning interleaved with action, where the "action" here is specifically a retrieval query rather than an arbitrary tool call — applied specifically to the retrieval problem rather than general tool use.

## Agentic retrieval: giving the model control over the retrieval process itself

A further generalization treats retrieval itself as a tool the model can call agentically (directly applying the tool-use pattern from this track's agents lesson), rather than a fixed, pre-determined pipeline step that always runs once before generation. The model can decide, based on its own assessment of what it's retrieved so far, whether it has enough information to answer or needs to issue another retrieval query — and can formulate that next query itself, informed by what the previous retrieval returned, rather than following a rigid fixed number of hops decided in advance.

This is more flexible than a fixed multi-hop pipeline (which might always do exactly 2 or 3 retrieval steps regardless of the specific question's actual complexity) — a simple question can be answered after one retrieval, while a genuinely complex one can trigger several, with the model itself judging when enough information has been gathered, rather than a pipeline design forcing a fixed number of hops on every query regardless of whether it's actually needed.

## Why this adds real cost and complexity, and when it's actually needed

Multi-hop and agentic retrieval both require multiple LLM calls and multiple retrieval operations per user question, meaningfully increasing latency and cost compared to single-shot RAG — directly connecting to this track's cost-and-latency lesson's point about matching technique sophistication to actual need. For the (common) case where most user questions are answerable from a single relevant passage, single-shot RAG remains the right default — multi-hop retrieval earns its added cost specifically for question types that genuinely require connecting information across multiple sources, and a system serving a mix of simple and complex questions often benefits from routing (similar to the model-routing pattern from the cost-and-latency lesson): a fast classification step determines whether a question likely needs single-hop or multi-hop retrieval, rather than paying multi-hop's cost on every request regardless of actual need.

## Why evaluation is harder, and more important, for multi-hop systems

Debugging a wrong answer from a multi-hop system is a more involved version of the tracing problem covered in this track's evaluation lesson: a wrong final answer could stem from a wrong intermediate retrieval at any hop, a wrong intermediate reasoning conclusion drawn from a correct retrieval, or a wrong final synthesis despite all intermediate steps being individually correct. Full tracing of every hop's retrieval query, retrieved content, and intermediate reasoning — not just the final answer — is what makes it possible to identify which specific hop introduced the error, directly applying the multi-step tracing methodology from the evaluation lesson to this specific case.

## A worked example

**Scenario:** a research assistant over a corpus of company filings needs to answer both simple factual questions ("what was Company A's revenue last year") and genuinely multi-step ones ("which of Company A's competitors had the highest revenue growth last year").

- **Routing**: a lightweight classification step (or the retrieval-agent's own initial assessment) determines whether a question is answerable from a single retrieval — the simple factual question is, and gets handled with fast, single-shot RAG, avoiding unnecessary multi-hop cost for a question that doesn't need it.
- **Multi-hop path for the complex question**: the first hop retrieves Company A's list of named competitors; a second hop retrieves revenue growth figures for each named competitor; a final synthesis step compares them and answers — three separate retrieval operations chained together, each informed by the previous step's result, rather than one retrieval attempt trying (and likely failing) to directly match the full compound question.
- **Full-trace logging**: every hop's retrieval query and retrieved content is logged, so if the final answer turns out wrong, the team can determine whether the competitor list itself was incomplete (a first-hop retrieval issue), a specific competitor's revenue figure was wrong (a second-hop issue), or the comparison logic itself was flawed despite correct inputs (a synthesis issue) — each requiring a different fix.

## Common mistakes

- **Applying multi-hop or agentic retrieval to every query by default**, paying its latency and cost overhead even for the (often majority) of questions that single-shot RAG would answer correctly and far more cheaply.
- **Fixing the number of retrieval hops rigidly in the pipeline design**, rather than letting the actual question's complexity determine how many hops are needed — a rigid 2-hop pipeline underperforms on questions needing 3+ hops and wastes cost on questions needing only 1.
- **Debugging a multi-hop system's wrong answer by only looking at the final output**, missing the ability to isolate exactly which hop introduced the error — full per-hop trace logging (per this track's evaluation and observability lesson) is what makes multi-hop RAG systems debuggable at all, and skipping it turns every quality issue into extensive manual investigation.
