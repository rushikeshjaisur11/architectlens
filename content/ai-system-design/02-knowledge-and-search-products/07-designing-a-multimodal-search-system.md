---
title: "Designing a Multimodal Search System"
short_title: "Multimodal Search"
tags: ["multimodal", "image-search", "embeddings", "clip", "design"]
sources:
  - "Radford et al., 'Learning Transferable Visual Models From Natural Language Supervision' (CLIP, 2021)"
  - "Public documentation of multimodal embedding models and vector databases"
  - "Johnson, Douze and Jégou, 'Billion-scale similarity search with GPUs' (2017)"
  - "Gemini Embedding 2 technical report (arXiv 2605.27295) and Qwen3-VL-Embedding (arXiv 2601.04720); embedding model comparison roundups, 2026 (secondary)"
banner:
  layout: line
  nodes:
    - [doc, "images+text"]
    - [model, "encoder"]
    - [db, "joint index"]
    - [user, "query"]
predict:
  question: "A shopper clicks \"find similar\" on a sneaker, then adds \"but in green\". What does the system do?"
  options: ["It reruns a text-only search for the word green", "It filters the similar shoes by OCR text containing green", "It blends the stored image embedding with the text embedding for green"]
  answer: 2
  why: "For image plus text queries the system combines the embeddings, a weighted sum, so results stay visually similar but shift toward green."
check:
  - q: "Why must a change of embedding model be run as a blue-green re-index?"
    options: ["Vectors only compare within one model version, so all are re-embedded", "Product quantization tables cannot be reused across model versions", "The reranker must be retrained before any new vectors are indexed"]
    answer: 0
    why: "Vectors from different models are not comparable, so you build and compare a second index offline, then switch."
  - q: "Why deduplicate near-identical images by perceptual hash or embedding distance?"
    options: ["Duplicates cannot be embedded by the image encoder", "Otherwise results are flooded by copies of one picture", "Duplicates break the metadata filters inside the search"]
    answer: 1
    why: "Without deduplication the top results can be the same image repeated, hiding other relevant items."
  - q: "Why embed images through an asynchronous queue instead of synchronously at upload?"
    options: ["Queued embedding produces better vectors than inline embedding does", "The text encoder must finish before the image encoder can start", "Embedding is costly, so uploads return fast and workers scale with the queue"]
    answer: 2
    why: "Embedding is GPU-heavy, so a queue keeps uploads fast and lets workers batch and scale independently."
---

## The problem

Users want to search a library of images, screenshots, product photos and video frames by describing them ("red sneakers with white soles") or by uploading an example. Filenames and tags are incomplete. A multimodal search system maps **text and images into a shared embedding space**, so a sentence and a matching picture land near each other.

## Step 1: Requirements

- **Query types:** text to image, image to image (find similar), image plus text refinement ("this, but in blue"), and optionally text within images.
- **Quality:** relevant results first, with exact filters (category, price, date) respected.
- **Scale (example):** 300 million images, 500 queries per second, new uploads searchable within minutes.
- **Latency:** results in under 300 ms.
- **Cost:** image embedding is far more expensive than text; ingestion must be efficient.

## Step 2: Shared embedding space

A dual-encoder model (the CLIP family) has an image encoder and a text encoder trained so matching pairs are close. This gives **cross-modal retrieval** with one index: embed every image once offline, embed queries online (text or image), and search nearest neighbours. Important properties:

- Embeddings are only comparable within the **same model version**; changing models means re-embedding everything.
- General models handle broad concepts well but struggle with fine-grained, domain-specific distinctions (specific part numbers, medical images), where fine-tuning or a domain model helps.
- Text queries should be short, descriptive phrases; long questions embed poorly, so rewrite them first.

## Step 3: Ingestion pipeline

1. **Upload and store** the original in object storage; produce thumbnails and normalised sizes.
2. **Extract features:** compute the image embedding on GPUs in batches; run OCR for text in the image; generate a **caption** and tags with a vision-language model for a lexical channel and for display.
3. **Metadata:** dimensions, upload time, owner, permissions, source, detected objects.
4. **Index:** upsert the vector, text fields and metadata into the search system.
5. **Deduplicate** near-identical images by perceptual hash or embedding distance so results are not flooded by copies.

Process asynchronously through a queue so uploads return immediately; GPU embedding workers scale with queue depth, and batch size is tuned for throughput.

## Step 4: Index and retrieval

At hundreds of millions of vectors use an approximate index, compressed with **product quantization** to fit memory, with the original vectors on SSD for rescoring top candidates. Shard by id and replicate for throughput. Combine channels with **hybrid retrieval**: vector search on the embedding plus keyword search over captions, OCR text and tags, fused by rank. Apply metadata filters **inside** the search (permissions, category) rather than after.

## Step 5: Query handling

- **Text query:** embed with the text encoder, search, then rerank.
- **Image query:** embed the uploaded image with the image encoder, search for neighbours; optionally crop to a region of interest the user selects.
- **Image plus text:** combine the embeddings (a weighted sum) or use a model trained for composed retrieval; expose the weight so users can steer.
- **Reranking:** a stronger vision-language model scores the top 50 for the query, improving precision where needed, at higher cost.

## Step 6: Quality, bias and safety

- Models inherit **bias** from training data: searches for people or occupations can return skewed results. Audit with test queries and apply diversity or filtering where appropriate.
- **Safety:** screen images at ingestion for illegal or harmful content before they become searchable, and respect consent and licensing metadata.
- **Privacy:** faces and personal data need policy; do not offer open-ended face search without clear legal basis.
- **Evaluation:** build labelled query-image relevance sets; measure recall@k and nDCG per query class, plus latency. Track "no good result" queries to find gaps.

## Step 7: Operations

Monitor embedding queue lag, GPU utilisation, index size per shard, query latency percentiles and recall on a canary set. Plan **model migrations** as blue-green re-indexing: embed everything with the new model into a second index, compare offline, then switch, as in the embedding drift lesson.

## A worked example

**Scenario:** an e-commerce user searches "retro trainers with a gum sole" and then clicks "find similar" on a result.

1. The text is embedded; hybrid search combines vector neighbours with keyword hits on the captions ("gum sole").
2. Filters limit results to in-stock footwear. The reranker promotes shoes whose soles actually look gum-coloured.
3. The user clicks an item, which sends its stored embedding as the next query: nearest neighbours return visually similar shoes, deduplicated by perceptual hash.
4. The user adds "but in green"; the system blends the image embedding with the text embedding for "green" and returns green variants.
5. Newly uploaded products from a supplier appear in results within five minutes thanks to the asynchronous embedding queue.

## Enterprise practice (verified October 2026)

**Basics.** Embed text and images (or transcripts) into vectors, search by similarity, rerank (steps above).

**Embedding options now (2026, secondary sources and papers).** **Natively multimodal embedding models** map text, images and in some cases video and audio into one space: Google's **Gemini Embedding 2** (reported released 10 March 2026, including audio without transcription), Cohere Embed v4 (text, images and mixed PDFs with charts and tables), Voyage multimodal-3.5 (visually rich documents, short video), and open models such as **Qwen3-VL-Embedding**, which reported 77.8 on the MMEB-V2 multimodal benchmark in January 2026. Text-only leaderboards (MTEB multilingual) show the top scores in the high 60s, with differences among leaders small, so model choice matters less than dimension, cost, multilingual coverage, licence and latency.

**Design decisions that matter more than the model.**

- **Page-as-image retrieval** (embedding rendered document pages) avoids lossy OCR for charts and layouts but costs more storage and compute; use it for visually rich corpora and keep text retrieval for the rest.
- **Hybrid first-stage plus multimodal reranker**, with filters on metadata and permissions.
- **Index lifecycle:** every embedding model change means re-embedding the corpus; store the model id and version with each vector and run old and new indexes side by side during migration.
- **Evaluate with your own queries**: build a labelled set of image-and-text queries and measure recall at k per modality; public benchmarks rarely resemble your content.

## Common mistakes

- **Mixing embeddings from different model versions** in one index.
- **Filtering after retrieval**, returning nothing for selective filters.
- **Embedding images synchronously** on upload, blocking users.
- **Ignoring near-duplicates**, so results are one picture repeated.
- **No bias or safety review** of a model trained on web data.
