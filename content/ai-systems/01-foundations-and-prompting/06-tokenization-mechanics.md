---
title: "Tokenization Mechanics: Why Token Count Isn't Word Count"
short_title: "Tokenization Mechanics"
tags: ["tokenization", "bpe", "foundations"]
sources:
  - "OpenAI tiktoken documentation and source"
  - "Sennrich et al., 'Neural Machine Translation of Rare Words with Subword Units' (BPE paper)"
---

## What a token actually is

LLMs don't operate on characters or whole words — they operate on **tokens**, subword units produced by a tokenizer trained on a large text corpus. A token might be a whole common word ("the"), a word fragment ("token" + "ization"), a single character (for rare symbols), or even a leading space bundled with the next word. The model's entire vocabulary is a fixed set of these tokens, typically 30,000–200,000 entries depending on the model family.

This matters because every cost, latency, and context-window calculation in production LLM systems is measured in tokens, not words or characters — and the mapping between them is neither fixed nor intuitive.

## Byte-Pair Encoding (BPE) and its relatives

Most modern LLM tokenizers use **Byte-Pair Encoding** or a close variant (BPE, WordPiece, SentencePiece Unigram). The core idea:

1. Start with a vocabulary of individual bytes or characters.
2. Repeatedly find the most frequent adjacent pair of tokens in the training corpus and merge them into a new single token.
3. Repeat until the vocabulary reaches a target size.

The result is a vocabulary where common sequences (whole common words, frequent subwords like "-ing" or "pre-") get single tokens, while rare or unseen sequences get split into smaller pieces — down to individual bytes if necessary, which is why BPE tokenizers can represent literally any input, including text in languages barely present in training data or arbitrary binary-adjacent content, just less efficiently.

## Why this makes token count unpredictable

- **English averages roughly 4 characters or ~0.75 words per token** for common tokenizers, but this is a rough average, not a guarantee — short common words often cost a full token each ("the", "a", "is"), while a single rare word can cost 4–6 tokens.
- **Non-English text is often far less token-efficient.** Languages with less representation in the tokenizer's training data (many Indic languages, for example) can require 2–3x more tokens per word than English for equivalent content, since the tokenizer never learned efficient subword merges for them.
- **Code, especially with unusual identifiers or heavy whitespace/indentation, tokenizes unevenly** — a `snake_case_variable_name` may split into many tokens, while common syntax (`def `, `return `) is a single token.
- **Numbers are often tokenized digit-by-digit or in small groups** rather than as whole numbers, which is part of why LLMs are historically weak at multi-digit arithmetic — each digit is a separate, roughly meaningless token to the model rather than a coherent numeral.

## Practical implications for building LLM systems

- **Never estimate cost or context usage from word count.** Use the actual tokenizer (e.g., `tiktoken` for OpenAI models, or the provider's token-counting endpoint) before sending a request, especially near context-window limits.
- **Non-English-heavy applications should budget more tokens per request** than an English-only estimate would suggest, since the same content in another language may cost meaningfully more tokens — this affects both cost and how much content fits in a fixed context window.
- **Structured formats (JSON, XML) have real token overhead** from punctuation, quotes, and repeated key names — a system emitting the same field names on every record burns tokens that plain prose wouldn't.
- **Truncation logic must operate on tokens, not characters or words**, or a "trim to 4000 characters" heuristic can silently exceed a 1000-token limit for token-dense content.

## Common mistakes

- **Estimating prompt cost from character or word count** instead of running the actual tokenizer, leading to underestimated bills or unexpected context-window overflows.
- **Assuming all languages tokenize equally efficiently**, which understates both cost and effective context budget for non-English use cases.
- **Expecting reliable digit-level arithmetic from a model** without accounting for the fact that numbers are tokenized in chunks that don't align with place value — this is a real, tokenizer-rooted limitation, not just a reasoning gap.
