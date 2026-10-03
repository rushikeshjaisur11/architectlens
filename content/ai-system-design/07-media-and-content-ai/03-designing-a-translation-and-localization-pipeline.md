---
title: "Designing a Translation and Localization Pipeline"
short_title: "Translation and Localization"
tags: ["translation", "localization", "terminology", "quality-estimation", "design"]
sources:
  - "Public documentation on machine translation quality estimation and evaluation metrics"
  - "Unicode Consortium, CLDR (Common Locale Data Repository) documentation"
  - "ICU MessageFormat specification for plural and gender-aware message formatting"
---

## The problem

A product serves users in dozens of languages: interface strings, help articles, marketing pages, support chats, user-generated content. Translating everything by hand is slow and costly; raw machine translation is fast but can mangle terminology, tone, placeholders and cultural nuance. A **translation and localization pipeline** combines LLM or MT translation with terminology control, structure-safe handling, quality estimation and targeted human review.

## Step 1: Requirements

- **Content types:** UI strings with variables and plurals, long documents with formatting, real-time chat, subtitles.
- **Quality:** accurate, fluent, consistent with approved terminology and brand voice.
- **Safety of structure:** placeholders, HTML, markdown and code must survive translation unchanged.
- **Speed and cost:** instant for chat; hours for documents; scalable to many languages.
- **Workflow:** human review where it matters, with translation memory to avoid paying twice.
- **Scale (example):** 40 languages, 20 million words a month.

## Step 2: Pipeline stages

1. **Extract and segment:** split content into translatable units (strings, sentences) with context metadata (where it appears, character limits, screenshots).
2. **Pre-process:** protect placeholders and markup, detect the source language, normalise.
3. **Lookup:** check the **translation memory** for exact or fuzzy matches; reuse approved translations.
4. **Translate:** an LLM or MT engine, given terminology, style guide and context.
5. **Validate:** automatic checks for structure, terminology, length and completeness.
6. **Quality estimation:** score each segment's likely quality to decide the review path.
7. **Review and approve:** human edits for low-score or high-visibility content.
8. **Publish and learn:** approved translations enter the memory; edits become training and glossary signals.

## Step 3: Controlling the translation

LLMs are flexible but need steering:

- **Glossary / terminology:** a per-language list of required translations (product names, legal terms, "do not translate" items) injected into the prompt, with post-checks that the terms appear.
- **Style guide:** tone (formal versus informal address), regional variant (Brazilian versus European Portuguese), formatting conventions.
- **Context:** the UI location, neighbouring strings, and a short description; "Save" as a button versus a verb in a sentence translates differently.
- **Few-shot examples** from approved translations in the same domain.
- **Plurals and gender:** use message formats (ICU) so languages with multiple plural forms get correct variants rather than concatenated strings.

## Step 4: Structure and safety

Translation must not break the product.

- **Placeholder protection:** replace variables (`{name}`, `%d`, HTML tags) with opaque tokens, translate, then restore and verify each token appears exactly once and in a valid position.
- **Validation:** parse the result as the original format (JSON, HTML, markdown) and check lengths against UI limits.
- **Untranslatable content:** code, brand names and URLs are preserved.
- **Injection:** user-generated content being translated may contain instructions; treat it as data in the prompt and never as commands.
- **Sensitive content:** detect and redact personal data before sending to external engines where policy requires.

## Step 5: Quality estimation and review routing

Reviewing everything is unaffordable, so estimate quality automatically:

- **Model-based quality estimation** (reference-free scores) and LLM-as-judge rubrics for accuracy, fluency and terminology.
- **Back-translation** and consistency checks across multiple translations flag meaning drift.
- **Risk weighting:** legal, medical, payments and high-traffic screens always get human review; low-risk, long-tail content may ship with automatic checks.
- Route by score: high goes live, medium to light review, low to full translation by a linguist.

Calibrate scores against human judgements per language, since model reliability varies widely, and be extra cautious with low-resource languages.

## Step 6: Real-time and long-form variants

- **Chat:** low-latency translation per message with streaming, glossary applied, original text kept and a way to view it; handle code-switching and slang; do not store personal conversations longer than needed.
- **Long documents:** translate section by section with a rolling glossary and summary for consistency across sections, then run a document-level consistency pass.
- **Subtitles:** respect timing and line-length constraints.

## Step 7: Evaluation and operations

Evaluate with human-rated samples per language and domain, automatic metrics as a regression guard, and **in-context tests** (does the string fit the UI, do plurals render correctly). Track review edit rates and the kinds of edits (terminology, tone, meaning errors) to improve prompts and glossaries. Version the style guides, glossaries and prompts; keep the translation memory as the source of truth; monitor cost per word and turnaround.

## A worked example

**Scenario:** a settings page string `"{count, plural, one {# file deleted} other {# files deleted}}"` and a help article must go into Polish and Japanese.

1. The segmenter extracts the string with context "toast message after deleting files" and a 40-character limit. The translation memory has no match.
2. Polish has four plural forms; the pipeline generates all required variants through the message format, with the glossary term for "file" applied. Placeholders are validated.
3. The Japanese version passes structure checks but its quality estimate is lower on the long help article; the article is routed to a linguist, while the toast ships after automatic checks.
4. The linguist changes three sentences for tone (the product uses a polite but friendly register); those edits are added to the translation memory and style examples.
5. A weekly report shows Polish edit rate at 6 percent and Japanese at 14 percent, so the team adds Japanese-specific examples to the prompt.

## Common mistakes

- **Translating strings without context**, producing wrong word senses.
- **Concatenating strings** instead of using plural and gender-aware formats.
- **No placeholder validation**, shipping broken UI.
- **Sending all content for human review**, or none of it.
- **Ignoring terminology and style**, so the product's language is inconsistent.
