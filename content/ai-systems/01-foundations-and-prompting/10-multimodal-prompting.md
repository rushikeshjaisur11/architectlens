---
title: "Multimodal Prompting: Handling Image and Audio Input"
short_title: "Multimodal Prompting"
tags: ["multimodal", "vision", "audio", "foundations"]
sources:
  - "OpenAI Vision guide (platform docs)"
  - "Anthropic Vision documentation (docs.anthropic.com)"
banner:
  layout: line
  nodes:
    - [doc, "image"]
    - [doc, "text"]
    - [model, "LLM"]
    - [doc, "answer"]
predict:
  question: "A team sends full-resolution photos to decide 'receipt or invoice'. What does the lesson predict compared with downscaled images?"
  options: ["Several times the token cost with no real accuracy improvement", "Slightly lower cost because high-res images need fewer tiles", "Much higher accuracy that justifies the added token cost"]
  answer: 0
  why: "High-resolution images tile into more patches and cost several times more, without proportional gain on simple classification."
check:
  - q: "Why might you pick a transcribe-then-prompt pipeline over native audio input?"
    options: ["Transcripts keep tone and emphasis that raw audio would lose", "Transcripts are inspectable and reusable, while raw audio is reprocessed per call", "Native audio models can't handle noisy phone calls at all"]
    answer: 1
    why: "A transcript is inspectable, versionable and reusable across prompts; raw audio must be re-sent and reprocessed each call."
  - q: "When might native audio input beat a transcript?"
    options: ["When the transcript must be cached and reused across many prompts", "When debugging requires reading the exact text the model saw", "When tone and emphasis matter, such as sentiment on a call recording"]
    answer: 2
    why: "Native audio preserves tone, emphasis and non-verbal cues that a transcript strips out."
  - q: "Why reference 'the first image' and 'the second image' explicitly in a multi-image prompt?"
    options: ["The model can't track which image is which by position alone", "The API rejects multi-image prompts that lack numbered references", "Explicit references reduce the token cost of each image sent"]
    answer: 0
    why: "Ordering and labeling matter; the model should not be left to infer which image is which from position in a long prompt."
---

## Multimodal input is still a token sequence

Frontier chat models that accept images or audio don't process them through a separate pathway that then hands off to the text model — the non-text input is encoded into the same token sequence the model reasons over, typically via a vision or audio encoder that produces a fixed or resolution-dependent number of "image tokens" or "audio tokens" spliced into the context alongside text. This has direct, practical consequences: images and audio clips consume real context-window budget and cost real money per token, exactly like text does.

## Image input mechanics

- **Resolution and tiling drive token cost.** Most providers tile large images into fixed-size patches, each patch costing a fixed number of tokens — so a high-resolution image can cost several times more than a downscaled version, often without a proportional quality gain for tasks like text extraction or simple object identification.
- **Downscale before sending when detail isn't needed.** For tasks like "is this a receipt or an invoice," a low-resolution image is both cheaper and just as accurate as a high-resolution one; reserve full resolution for tasks that need fine detail (reading small text, counting many small objects).
- **Multiple images in one prompt are supported by most frontier models**, but ordering and labeling matter — explicitly reference "the first image" / "the second image" in the accompanying text rather than assuming the model will track which is which by position alone in a long prompt.
- **Image placement relative to text affects grounding.** Putting the relevant instruction text immediately before or after the image it refers to, rather than far away in a long prompt, generally improves the model's ability to correctly associate the two.

## Audio input mechanics

- **Native audio input (when available) differs from a transcribe-then-prompt pipeline.** Some models accept raw audio directly, preserving tone, emphasis, and non-verbal cues that a transcript strips out — useful for tasks like sentiment analysis on a call recording. Others require a separate speech-to-text step before the transcript is fed in as text.
- **Transcription-first pipelines are simpler to debug and cache** — the transcript is inspectable, versionable, and reusable across multiple downstream prompts, whereas raw audio must be re-sent and re-processed for every call.
- **Audio quality and background noise degrade both native audio understanding and transcription accuracy** — production systems handling real-world audio (phone calls, meetings) typically need explicit handling for low-confidence transcription segments rather than assuming clean input.

## Prompting patterns for multimodal tasks

- **Be explicit about what to look at and ignore.** "Extract the total amount from this receipt image, ignoring any handwritten annotations" outperforms a bare "what's the total?" the same way specific text instructions beat vague ones.
- **Combine multimodal input with structured output requirements** the same way you would for text — ask for a specific JSON schema rather than free-form description, especially for extraction tasks.
- **Few-shot examples work for multimodal prompts too**, though each example image adds meaningfully to token cost — weigh that against the reliability gain, same tradeoff as text few-shot.

## Common mistakes

- **Sending full-resolution images for simple classification tasks**, paying several times the necessary token cost for no accuracy improvement.
- **Assuming a model "remembers" an image from earlier in a long conversation without it being re-sent** — like text, most APIs require the full multimodal context to be resent each call unless the provider explicitly supports multimodal caching.
- **Feeding raw audio into a pipeline optimized for transcripts** (or vice versa) without checking whether the task actually benefits from tone/prosody information that a transcript would discard.
