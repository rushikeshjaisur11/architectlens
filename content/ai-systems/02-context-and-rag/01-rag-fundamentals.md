---
title: "RAG Fundamentals: Grounding LLM Outputs in Retrieved Context"
short_title: "RAG Fundamentals"
tags: ["rag", "retrieval", "llm", "context-engineering"]
sources:
  - "Lewis et al., 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks' (2020)"
  - "OpenAI and Anthropic documentation on retrieval and context injection"
---

## The problem RAG solves

An LLM's knowledge is frozen at training time and bounded by its context window — it can't know about your private documents, yesterday's data, or anything too large to fit in a single prompt. Retrieval-Augmented Generation (RAG) works around both limits: at query time, you search an external knowledge base for the passages most relevant to the user's question, inject those passages into the prompt, and ask the model to answer using them.

This turns "does the model know this?" into "can we find this?" — a search problem, which is far more tractable to keep current than retraining or fine-tuning a model every time underlying data changes.

## The basic pipeline

1. **Ingest.** Source documents are split into chunks (paragraphs, sections, or fixed-size windows) small enough to be individually relevant but large enough to retain context.
2. **Embed.** Each chunk is converted into a vector via an embedding model, capturing its semantic content as a point in high-dimensional space.
3. **Index.** Vectors are stored in a vector database or index (see the retrieval and vector search lessons in this track) that supports fast nearest-neighbor search.
4. **Retrieve.** At query time, the user's question is embedded the same way, and the index returns the chunks whose vectors are closest — i.e., most semantically similar to the question.
5. **Augment and generate.** The retrieved chunks are inserted into the prompt (typically in a clearly delimited context section), and the model is instructed to answer using them.

## Why chunking strategy matters more than people expect

A chunk that's too large dilutes relevance — the embedding represents an average of several ideas, so a search for one specific fact may not surface it even if it's present somewhere in the chunk. A chunk that's too small loses context — a sentence fragment retrieved in isolation may be technically the closest match but unusable without its surrounding paragraph.

Two adjustments matter more in practice than picking the "ideal" chunk size:

- **Overlap between chunks** (e.g., each chunk shares 10-20% of its content with its neighbor) so a fact sitting near a chunk boundary isn't split across two chunks and effectively lost to both.
- **Structure-aware chunking** — splitting on natural boundaries (headings, paragraphs, code blocks) rather than a blind fixed-token window, so a chunk doesn't cut a table or a function definition in half.

## Why retrieval quality is the real bottleneck

A common failure mode: the generation step looks broken (the model gives a wrong or incomplete answer), but the actual defect is upstream — the retrieval step never surfaced the passage that had the answer. Debugging RAG systems means checking retrieval and generation separately:

- **Retrieval failure**: the correct chunk exists in the index but wasn't returned in the top-k results. Fixes: better embeddings, hybrid search (combining semantic and keyword search — see this track's retrieval lesson), re-ranking, or better chunking.
- **Generation failure**: the correct chunk *was* retrieved and is present in the prompt, but the model didn't use it correctly — ignored it, misread it, or hallucinated despite having the right context. Fixes: prompt structure (make the provided context impossible to miss), explicit instructions to only answer from provided context, or a smaller/more targeted context window so the right passage isn't buried among irrelevant ones.

Logging both the retrieved chunks and the final answer separately — not just the final answer — is what makes this distinction possible to diagnose at all.

## A worked example

**Scenario:** a support chatbot answering questions from a 500-page product manual.

Naive approach: embed the whole manual as one giant document, retrieve nothing, and stuff the entire text into the context window every time. This breaks down fast — the manual likely exceeds the context window, and even if it didn't, burying the relevant paragraph among 500 pages of unrelated text degrades the model's ability to find and use it (the "lost in the middle" effect covered in this track's prompting lesson).

RAG approach: chunk the manual by section (each chunk covering one feature or procedure, ~300-500 tokens, with heading context prepended to each chunk so a retrieved fragment still says what feature it's about). Embed and index each chunk. On a user question like "how do I reset the device," retrieve the top 3-5 chunks whose embeddings are closest to the question, and pass only those into the prompt alongside the question.

The result: the model sees a few hundred tokens of directly relevant material instead of 500 pages, answers are grounded in the actual manual text (reducing hallucination), and updating the manual only requires re-indexing the changed sections, not retraining anything.

## Common mistakes

- **Treating retrieval as a solved, one-time setup.** Chunking strategy, embedding model choice, and top-k value all need tuning against real queries and failure cases — a RAG pipeline that was never evaluated against actual user questions is likely mis-tuned somewhere.
- **Retrieving too many chunks "to be safe."** More context isn't strictly better — irrelevant retrieved chunks compete for the model's attention and can degrade answer quality even when the right chunk is also present.
- **Not instructing the model to say "I don't know" when retrieval comes up empty or irrelevant.** Without that instruction, a model will often generate a plausible-sounding answer from its training data instead of admitting the provided context doesn't cover the question — defeating the grounding purpose of RAG in the first place.
