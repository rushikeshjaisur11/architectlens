---
title: "RAG Evaluation: Faithfulness, Context Precision/Recall, and RAGAS"
short_title: "RAG Evaluation"
tags: ["rag", "evaluation", "ragas", "foundations"]
sources:
  - "RAGAS: Automated Evaluation of Retrieval Augmented Generation (Es et al., 2023) and ragas.io documentation"
  - "LlamaIndex Evaluation documentation (Faithfulness, Relevancy, Correctness evaluators)"
  - "\"Retrieval-Augmented Generation for Large Language Models: A Survey\" (Gao et al., 2023) — evaluation section"
  - "TruLens RAG Triad documentation"
---

## Why RAG evaluation needs its own metrics

A RAG pipeline has two independently failing components — the retriever and the generator — and end-to-end answer quality alone can't tell you which one broke. An answer can be wrong because retrieval missed the relevant document, because retrieval found it but buried it under noise, or because the generator had the right context but ignored or misread it. RAG-specific evaluation frameworks decompose quality into metrics that isolate each stage, so a failing pipeline points you at the component to fix rather than leaving you to guess.

## The core metrics

**Faithfulness** (also called groundedness) measures whether the generated answer is actually supported by the retrieved context — it catches hallucination even when the retrieved context was correct. It's typically computed by decomposing the answer into individual claims and checking, per claim, whether it's inferable from the retrieved context (RAGAS implements this with an LLM-as-judge that extracts and verifies claims); a low faithfulness score with good context retrieval means the generator is the problem, not the retriever.

**Answer relevancy** measures whether the generated answer actually addresses the question asked, independent of whether it's grounded — an answer can be perfectly faithful to the retrieved context and still fail to answer the question if the retrieved context was off-topic. RAGAS estimates this by generating several synthetic questions the answer would plausibly address and computing their embedding similarity to the original question.

**Context precision** measures whether the retrieved chunks that are actually relevant to the question are ranked near the top of the retrieved set — high precision means the retriever isn't burying good chunks under irrelevant ones, which matters directly because of context-window/lost-in-the-middle effects downstream.

**Context recall** measures whether the retriever found *all* the context needed to answer the question, typically by checking whether each sentence of a reference (ground-truth) answer can be attributed to something in the retrieved context. Low recall means the retriever is missing necessary information regardless of what the generator does with what it got — this is a chunking/indexing/retrieval-depth problem, not a prompting problem.

Together, faithfulness and answer relevancy evaluate the **generation** stage; context precision and context recall evaluate the **retrieval** stage — this is the core structure behind what TruLens calls the "RAG triad" (context relevance, groundedness, answer relevance) and what RAGAS formalizes as its primary metric set.

## RAGAS

**RAGAS** (Retrieval Augmented Generation Assessment, Es et al., 2023) is the most widely adopted open-source framework implementing these metrics. Its key design choice is that most of its core metrics are **reference-free** — faithfulness and answer relevancy don't require a human-written ground-truth answer, only the question, the retrieved context, and the generated answer, computed via LLM-as-judge prompting. This matters practically because collecting ground-truth answers at scale is expensive; RAGAS lets teams evaluate continuously on production traffic without a labeled eval set, reserving reference-based metrics (like context recall, which does need a ground truth to check completeness against) for a smaller curated eval set. RAGAS also supports **synthetic test set generation** — given a corpus, it generates diverse question/answer/context triples (including multi-hop and conversational variants) automatically, which addresses the common bottleneck of not having enough hand-labeled eval examples to trust an aggregate score.

## Using these metrics in practice

Because LLM-as-judge metrics have their own noise, treat scores as directional and relative, not absolute ground truth: use them for **regression testing** (did this retriever/chunking/prompt change move faithfulness or context recall up or down on a fixed eval set) rather than as an absolute quality certificate, and validate the judge itself periodically against human ratings on a sample. A common production pattern is a two-tier eval: a small hand-labeled golden set with reference-based metrics (context recall, answer correctness) run on every pipeline change, plus reference-free metrics (faithfulness, answer relevancy) run continuously on live traffic to catch drift the golden set doesn't cover.

## Common mistakes

- **Evaluating only end-to-end answer quality.** Without decomposing into retrieval vs. generation metrics, a failing pipeline gives no signal about which component to fix.
- **Trusting LLM-as-judge scores as precise, absolute numbers.** These are noisy estimates with model-specific biases (judges tend to favor longer or more confident-sounding answers); use them comparatively across pipeline versions, not as a single trustworthy score.
- **Never building a golden eval set because reference-free metrics exist.** Reference-free metrics catch groundedness and relevance but can't catch recall failures (missing information the answer never mentions needing) — that requires a reference answer to compare completeness against.
- **Evaluating once at launch and never again.** Corpus drift, embedding model updates, and chunking changes all shift retrieval quality silently; RAG eval should run as a regression check on every pipeline change, not a one-time validation.
