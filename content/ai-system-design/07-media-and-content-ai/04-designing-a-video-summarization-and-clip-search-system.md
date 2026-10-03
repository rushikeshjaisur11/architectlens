---
title: "Designing a Video Summarization and Clip Search System"
short_title: "Video Summarization and Clip Search"
tags: ["video", "multimodal", "summarization", "search", "indexing", "design"]
sources:
  - "Public documentation of video understanding models and scene detection tools"
  - "Radford et al., 'Robust Speech Recognition via Large-Scale Weak Supervision' (Whisper, 2022)"
  - "Public documentation of multimodal embedding models and vector search"
  - "Google Gemini API documentation on video understanding, ai.google.dev/gemini-api/docs/video-understanding, and reports on September 2026 agentic video understanding (secondary)"
  - "TwelveLabs pricing calculator, twelvelabs.io (via search results)"
predict:
  question: "An hour of video has about 100,000 frames. The pipeline detects scenes and captions only 41 key frames. What happens to cost?"
  options: ["Cost is unchanged because every frame is still embedded", "Cost rises because scene detection needs extra GPU passes", "Cost stays around a few cents per hour of video"]
  answer: 2
  why: "Scene-based key frame selection keeps processing to a few cents per hour of video."
check:
  - q: "Why index at the segment level instead of whole videos?"
    options: ["Whole-video entries cannot point users to the right moment", "Segments let keyword search replace vector search entirely", "Whole videos are too large to store in a vector index"]
    answer: 0
    why: "Segment records carry start and end times, so results are playable at the right moment."
  - q: "Why use hybrid retrieval over keyword search or vectors alone?"
    options: ["Vector search alone is too slow for 500,000 hours of archive", "Keyword search catches exact terms; vector search catches paraphrases", "Fusion removes the need for permission filters"]
    answer: 1
    why: "The two methods find different matches, so fusing and reranking covers both exact terms and paraphrases."
  - q: "Why summarise long videos with map-reduce and timestamp citations?"
    options: ["Summaries are cheaper when they omit the transcript text", "Map-reduce guarantees that visual claims are always correct", "Long videos exceed one context, and the middle is easily missed"]
    answer: 2
    why: "Per-segment summaries avoid the context limit, and time citations make each line verifiable."
---

## The problem

Organisations accumulate thousands of hours of video: lectures, meetings, product demos, broadcasts. Nobody can watch it all. A system that **summarises** videos and lets people **search inside them** ("show me where the speaker explains the pricing change") turns an archive into a usable knowledge source. Video is expensive to process, so the design is about extracting the right signals cheaply, indexing them well, and returning timestamped, playable results.

## Step 1: Requirements

- **Summaries:** short overview, chapters with titles, key moments, optional highlights.
- **Search:** natural-language queries returning timestamped clips with thumbnails and snippets.
- **Q&A:** answers with citations to times in specific videos.
- **Freshness:** new uploads searchable within minutes to an hour.
- **Scale (example):** 500,000 hours of archive, 5,000 new hours a day.
- **Cost:** model processing of every frame is infeasible; budget per hour of video.

## Step 2: What to extract

Video carries several modalities; extract complementary signals:

- **Speech:** transcription with timestamps and speakers, usually the richest signal for talks and meetings.
- **On-screen text:** OCR on slides and captions, often more precise than speech for names, numbers and terms.
- **Visual content:** key frames described by a vision-language model (objects, scenes, actions, charts).
- **Audio events:** music, applause, silence, sound effects where relevant.
- **Metadata:** title, description, speakers, upload time, permissions.

## Step 3: Processing pipeline

1. **Ingest and normalise:** transcode to a standard format, split audio.
2. **Segment** the video into **shots or scenes** using scene-change detection, and into topic segments using transcript structure.
3. **Select key frames** per shot (not every frame): at scene changes plus periodic samples, deduplicating near-identical frames.
4. **Run models:** ASR for the audio, OCR on frames with text, a vision-language model for captions of selected key frames.
5. **Align** all outputs on a shared timeline.
6. **Summarise** hierarchically: per segment, then per chapter, then the whole video, citing time ranges.
7. **Embed and index** segments for search.

Run stages as asynchronous jobs on a queue with GPU workers for the heavy models; cheap pre-filters (silence trimming, duplicate frame removal) cut cost substantially.

## Step 4: Indexing for search

Index at the **segment level** (typically 30 to 90 seconds, aligned to scene or topic boundaries), each with: transcript text, OCR text, the visual caption, a multimodal embedding, and metadata (video id, start and end time, speakers, permissions). Use **hybrid retrieval**: keyword search catches exact terms and names; vector search catches paraphrases and visual concepts; fuse the lists and rerank. Filter by permissions and metadata inside the search. Store a **thumbnail and a short clip reference** so results are directly playable at the right moment.

## Step 5: Summaries you can trust

Long videos exceed a single context and the middle is easily missed, so use **map-reduce** over segments with citations back to timestamps. Chapters come from topic segmentation; titles are generated from chapter summaries. Ground each summary line in the transcript or OCR text; for visual-only claims (for example "the chart shows revenue falling") require the visual caption as evidence, and mark confidence. Allow summaries at several lengths and for different audiences.

## Step 6: Question answering

Retrieve the top segments for the question, pass their transcript, OCR and captions to the model, and answer with **citations that deep-link** to video timestamps ("see 14:32"). Check that cited segments support the claim. For questions about visuals ("what colour was the logo?") route to the visual captions or run a vision model on the specific key frames at query time, since pre-computed captions may not cover every detail.

## Step 7: Cost control

- **Tier processing:** run the full pipeline on high-value content; transcript-only or sampled-frame processing on the long tail; process on first search if the archive is rarely queried.
- **Reduce frames:** scene-based sampling instead of fixed rates; downscale for captioning.
- **Cache and reuse** results by content hash so re-uploads and duplicates cost nothing.
- **Batch GPU work** and use smaller models where quality allows.
- Track cost per hour of video and per query.

## Step 8: Safety, privacy and evaluation

Respect permissions and consent: meeting recordings and personal videos are sensitive; redact or exclude faces and personal data as policy requires, and filter harmful content. Evaluate search with labelled query-moment pairs (recall of the right timestamp within a tolerance), summaries with rubrics and human review, and answers for faithfulness to the cited segments. Monitor processing lag and failure rates by stage.

## A worked example

**Scenario:** an employee searches "where did we explain the refund exception policy in the Q3 training?"

1. The query runs hybrid retrieval over segment indexes, filtered to videos the employee may view.
2. Keyword search hits segments with "refund exception" in transcript and a slide title (OCR); vector search finds a segment where the speaker describes the same policy in different words.
3. Fusion and reranking put the slide-plus-speech segment at 38:10 to 39:25 first, with a thumbnail of the slide.
4. The assistant answers with a two-sentence summary and a link that opens the video at 38:10, with a second citation at 52:40 where an example is given.
5. The archive pipeline had processed this video overnight: scenes detected at slide changes, 41 key frames captioned instead of 100,000 frames, keeping cost to a few cents per hour of video.

## Enterprise practice (verified October 2026)

**Basics.** Split into shots, transcribe, caption frames, embed, index, summarise by segment (steps above).

**Cost and capability numbers (documentation and secondary reports, October 2026).** Gemini tokenises video at roughly **300 tokens per second** of footage at default resolution (about 1.08 million tokens for an hour), and low-resolution mode uses about 100 tokens per second. One secondary estimate put an hour of video on a mid-2025 Gemini model at about $1.37 at default resolution and about $0.11 at low resolution; recompute with current prices. In September 2026 Google announced **agentic video understanding**, where the model navigates the timeline and fetches only needed segments; reported results were up to an 88% token reduction, up to 66% lower cost and up to 7% better accuracy. A specialised provider (TwelveLabs) lists indexing at about $0.042 per minute, analysis at about $0.029 per minute plus output tokens, $4 per 1,000 queries and a small monthly per-indexed-minute fee.

**Design consequences.** Do not feed whole videos to a model for every question. **Index once** (shots, transcript, per-segment captions and embeddings), then answer by retrieving segments and reading only those, with timestamps as citations so users jump to the moment. Use a cheap pass (scene detection, ASR) to decide which segments deserve an expensive visual pass, cache per-video artefacts, and meter cost per hour of video. Handle rights and privacy (faces, voices, music licensing), apply the same provenance and labelling rules as other generated media, and evaluate retrieval on real clip-finding queries by recall at k and by time-to-find for users.

## Common mistakes

- **Processing every frame** instead of key frames at scene changes.
- **Indexing whole videos** rather than timestamped segments.
- **Search results without timestamps or thumbnails**, forcing users to scrub.
- **Summaries without time citations**, impossible to verify.
- **Ignoring permissions and consent** on recorded content.
