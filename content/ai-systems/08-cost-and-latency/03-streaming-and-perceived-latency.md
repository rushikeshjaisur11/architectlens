---
title: "Streaming and Perceived Latency"
short_title: "Streaming and Perceived Latency"
tags: ["streaming", "latency", "cost", "llm"]
sources:
  - "OpenAI and Anthropic API documentation on streaming responses"
  - "Nielsen Norman Group research on response-time perception thresholds"
---

## Why perceived latency and actual latency are different metrics

This track's cost-and-latency lesson covered model selection, prompt caching, and parallelization as ways to reduce actual generation time. **Streaming** is a different kind of lever entirely — it doesn't reduce how long a full response takes to generate, but changes when the user starts *seeing* output, which is often what actually determines whether an interaction feels fast. A response that takes 4 seconds to fully generate but starts streaming visible text after 300ms feels categorically different to a user than one that shows nothing for the full 4 seconds before appearing all at once — even though the total generation time is identical in both cases.

## How streaming works mechanically

Instead of waiting for the full response to complete before returning anything, the model API sends tokens incrementally as they're generated — the client receives and can display each token (or small batch of tokens) as soon as it's produced, rather than buffering the entire response server-side first. This is a direct consequence of the autoregressive, token-by-token generation process covered in this track's inference-serving-fundamentals lesson — since tokens are already being produced sequentially regardless, streaming simply exposes that sequential production to the client instead of hiding it behind a single final response.

## Why this matters more for LLM applications than for typical API responses

A typical API call (fetching a database record, say) either completes quickly or the delay itself is the whole story — there's no meaningful intermediate state to show. LLM generation is different: it's an inherently incremental process (per the point above) that produces meaningful partial output throughout its duration, not just at completion — a partially-generated paragraph is genuinely readable and useful before the full response finishes, unlike a half-fetched database record. This makes LLM responses an unusually good fit for streaming's perceived-latency benefit, since the "partial result" being shown during generation is actually coherent and valuable to the user, not just a loading indicator.

## Time-to-first-token as its own metric, distinct from total generation time

Because streaming changes what actually matters to perceived responsiveness, this track's inference-serving lesson's distinction between time-to-first-token and total generation time becomes directly product-relevant here, not just an infrastructure detail: a system optimized purely for minimizing total generation time might not be optimized for minimizing time-to-first-token specifically, even though the latter is what a streaming UI's perceived responsiveness actually depends on most heavily. This is a real reason to track time-to-first-token as its own monitored metric (per this track's evaluation-and-observability lesson's point about tracking latency percentiles specifically, not just averages) distinct from total request latency — a system with good average total latency but poor time-to-first-token would show strong-looking dashboard numbers while still feeling slow to actual streaming users.

## When streaming isn't the right fit

Streaming isn't universally beneficial — it adds real client-side complexity (handling incremental updates, partial JSON if the output needs structured parsing before it's complete, connection management for a longer-lived request) and doesn't help for use cases where the output isn't meant to be consumed incrementally: a background batch job generating a report nobody's watching in real time gets no perceived-latency benefit from streaming, since there's no user actively waiting and watching output appear. Structured output tasks (per this track's structured-output lesson) also complicate streaming somewhat — a partial, not-yet-complete JSON object generally isn't valid JSON, so a client consuming a streamed structured response needs either specialized incremental-JSON-parsing logic or needs to wait for completion anyway for that specific use case, partially undermining streaming's benefit for structured-output-heavy applications unless handled deliberately.

## A worked example

**Scenario:** a coding assistant product has two distinct interaction modes — an interactive chat interface where a user is actively watching and reading the response as it's generated, and a background "generate a full project scaffold" batch operation that produces a large amount of code the user reviews only once fully complete.

- **Interactive chat mode uses streaming**, directly targeting perceived responsiveness — the team specifically monitors time-to-first-token as a tracked metric distinct from total response time, since that's the number that actually correlates with how responsive the chat feels to an actively-watching user, per the reasoning above.
- **Background scaffold generation does not use streaming**, since there's no user actively watching partial output appear in real time for this use case — the perceived-latency benefit streaming provides simply doesn't apply here, and the added client-side complexity of handling a streamed response isn't worth taking on for no corresponding benefit; the simpler wait-for-completion pattern is used instead.
- **A structured-output sub-feature within the chat** (generating a JSON-formatted code-diff object) uses a hybrid approach: the assistant's explanatory text streams normally, while the structured diff data is generated as a separate, non-streamed call using constrained decoding (per the structured-output lesson) — avoiding the incremental-JSON-parsing complexity that would otherwise be needed to stream a structured object usefully, while still getting streaming's perceived-latency benefit for the freely-streamable explanatory text portion of the response.

## Common mistakes

- **Optimizing total generation latency without separately tracking time-to-first-token for a streaming product**, missing that these are genuinely different metrics with different relationships to actual perceived responsiveness — a system can improve on one while remaining flat or even regressing on the other.
- **Enabling streaming for a use case with no user actively watching output in real time**, taking on the added client-side complexity for no actual perceived-latency benefit, since that benefit specifically depends on a user watching partial output appear.
- **Streaming a structured-output response without a plan for handling incomplete, invalid partial JSON**, either producing client-side parsing errors on partial data or requiring ad hoc workarounds — this needs a deliberate approach (incremental parsing logic, or separating streamable and structured portions as in the worked example) rather than assuming streaming "just works" the same way for structured output as it does for free-form text.
