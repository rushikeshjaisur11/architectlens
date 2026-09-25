---
title: "Sampling Parameters: Temperature, Top-p, Top-k, and Determinism"
short_title: "Sampling Parameters"
tags: ["sampling", "temperature", "foundations"]
sources:
  - "OpenAI API reference (temperature, top_p documentation)"
  - "Holtzman et al., 'The Curious Case of Neural Text Degeneration' (nucleus sampling / top-p paper)"
---

## From logits to a chosen token

At every generation step, the model produces a probability distribution over its entire vocabulary — a **logit** score per token, converted to probabilities via softmax. Sampling parameters control how that distribution gets turned into one chosen next token. This choice, repeated token by token, is what makes LLM output either deterministic and safe or varied and creative.

## Temperature

Temperature rescales the logits before the softmax is applied, controlling how "peaked" or "flat" the resulting probability distribution is:

- **Temperature → 0**: the distribution collapses toward always picking the single highest-probability token (effectively greedy decoding). Output becomes maximally deterministic and repetitive-but-safe.
- **Temperature = 1**: the raw model distribution is used unmodified.
- **Temperature > 1**: the distribution flattens, giving lower-probability tokens a relatively better shot — output becomes more varied, but also more likely to include qualitatively worse or less coherent continuations.

Practical guidance: **use low temperature (0–0.3) for tasks with a single correct or best answer** — extraction, classification, code generation, structured output. **Use higher temperature (0.7–1.0+) for tasks that benefit from variety** — brainstorming, creative writing, generating multiple diverse candidates.

## Top-p (nucleus sampling)

Top-p sampling restricts the candidate pool to the smallest set of tokens whose cumulative probability mass exceeds `p`, then samples from within that set. Unlike a fixed cutoff, this adapts to how confident the model is at each step:

- When the model is very confident (one token dominates), the nucleus is small — even a high `p` value effectively behaves close to greedy.
- When the model is uncertain (probability spread across many tokens), the nucleus is larger, admitting more variety.

This adaptivity is why top-p is generally preferred over a fixed top-k cutoff: it avoids the two failure modes of a fixed k — being too permissive when the model is confident, and too restrictive when it's genuinely uncertain.

## Top-k

Top-k sampling restricts candidates to the k highest-probability tokens, regardless of their cumulative probability mass, then samples from that fixed-size set. Simpler than top-p, but doesn't adapt to model confidence — a k of 40 either wastes headroom when the model is very confident, or is too narrow when many tokens are near-equally likely.

Most production APIs expose top-p; some also expose top-k as an additional filter that combines with top-p (both are applied, narrowing to the intersection).

## Interaction and combined use

Temperature and top-p/top-k are typically combined, not used alone: temperature reshapes the whole distribution, then top-p/top-k trims the tail before sampling. A common production default is a moderate temperature (0.3–0.7) with a top-p around 0.9–0.95, tuned per task via evaluation rather than guessed.

**Setting all sampling parameters to their most deterministic values (temperature 0, or provider-specific greedy mode) does not guarantee bit-for-bit reproducibility** across calls, even with identical input — most production inference stacks use batched, parallelized computation where floating-point non-associativity introduces small numerical differences run to run. If true determinism is required, check whether the provider exposes a `seed` parameter, and treat "temperature 0" as "highly consistent," not "guaranteed identical."

## Common mistakes

- **Using high temperature for structured extraction or classification tasks**, introducing unnecessary variance into what should be a deterministic pipeline.
- **Assuming temperature 0 means fully reproducible output** across separate API calls without verifying — batching and floating-point effects can still cause small variation.
- **Tuning temperature by feel on a handful of examples** instead of running an evaluation set — sampling parameter effects are often task-specific and non-obvious until measured.
