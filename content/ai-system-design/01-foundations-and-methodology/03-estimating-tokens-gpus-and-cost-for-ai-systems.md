---
title: "Estimating Tokens, GPUs and Cost for AI Systems"
short_title: "Estimating Tokens, GPUs and Cost"
tags: ["estimation", "capacity", "cost", "tokens", "gpu", "back-of-envelope"]
sources:
  - "Provider pricing documentation for input, output and cached tokens"
  - "Pope et al., 'Efficiently Scaling Transformer Inference' (2022)"
  - "Public GPU specification sheets (memory capacity and bandwidth)"
  - "Anthropic pricing documentation, platform.claude.com/docs/en/about-claude/pricing (fetched Oct 2026)"
  - "Google Gemini API pricing, ai.google.dev/gemini-api/docs/pricing (fetched Oct 2026)"
  - "GPU rental price trackers, September to October 2026 (secondary: getdeploying.com, spheron.network)"
---

## Why estimate

Before building, you should know whether an AI feature is **affordable and feasible** at the target scale. Back-of-envelope estimation for AI systems follows the same spirit as classic capacity estimation but with new units: **tokens**, GPU memory and GPU seconds. A few ratios cover most interview and planning questions.

## Numbers worth remembering

- **Tokens:** roughly 0.75 English words per token; 1,000 tokens is about 750 words, about 1.5 pages.
- **Typical sizes:** a chat message 50 to 200 tokens; a retrieved chunk 200 to 800; a system prompt 300 to 2,000; a long document 10,000 to 100,000.
- **Price shape:** output tokens cost several times more than input tokens; cached input tokens cost a fraction of normal input. Prices differ by model tier by an order of magnitude or more.
- **Model memory:** weights take parameters times bytes per parameter: a 7B model is about 14 GB in 16-bit, 7 GB in 8-bit, 3.5 GB in 4-bit; a 70B model is about 140 GB in 16-bit.
- **KV cache:** grows with context length and the number of concurrent sequences, often the real memory limit.
- **Decode speed:** limited by memory bandwidth, so a single stream commonly generates tens of tokens per second; batching raises total throughput, not per-user speed.
- **Latency shape:** time to first token depends on prompt length (prefill) and queueing; total time adds output tokens divided by decode speed.

## Estimating cost per interaction

Cost per call equals input tokens times input price plus output tokens times output price. Build the token count from the prompt's parts.

Example for a RAG question: system prompt 600, retrieved chunks 5 times 400 equals 2,000, conversation history 500, user question 50, so 3,150 input tokens; output 300 tokens. With illustrative prices of $3 per million input and $15 per million output: input $0.0095, output $0.0045, total about 1.4 cents. Multiply by calls per user action (agents may use 5 to 20) and by requests per day.

Then add retrieval, embedding and reranking costs, and platform overhead, to find the all-in cost per action. Compare with the value created (ticket deflected, hour saved) to see if the unit economics work.

## Estimating throughput and GPUs for self-hosting

Work in steps:

1. **Demand:** peak requests per second, average input and output tokens.
2. **Tokens per second needed:** requests per second times output tokens for decode, and times input tokens for prefill.
3. **Capacity per GPU or node:** from benchmarks of your model and engine: sustainable output tokens per second at the latency target, with batching.
4. **Fleet size:** demand divided by capacity, plus headroom and redundancy.

Example: 100 requests per second at 300 output tokens needs 30,000 output tokens per second. If a node of GPUs sustains 3,000 tokens per second at the latency target, you need 10 nodes, plus 25 percent headroom and one spare gives 14. Always replace guesses with measured benchmarks for the actual model, because throughput varies several-fold with quantization, batching and sequence lengths.

## Checking memory feasibility

A model must fit with its KV cache. For a 70B model in 8-bit (about 70 GB) on GPUs with 80 GB each, one GPU cannot hold it with a useful batch, so use tensor parallelism across two or more GPUs. KV cache per token depends on layers, heads and precision; multiply by tokens per sequence and by concurrent sequences to see how many requests fit. When the cache is the limit, shorter contexts, quantized caches, prefix sharing and paged allocation increase concurrency.

## Estimating storage and retrieval

- **Vectors:** count chunks times dimensions times bytes. 100 million chunks of 768 dimensions at 4 bytes is about 300 GB raw; product quantization can cut this by 8 to 32 times.
- **Documents:** raw text and parsed artifacts, often several times the original size.
- **Index overhead:** graph indexes add 30 to 100 percent to vector memory.
- **Embedding cost:** documents times tokens times embedding price, plus re-embedding when models change.

## Latency budget estimation

Add up the stages for a typical request: network, gateway, retrieval (tens of milliseconds), reranking, prefill, then decode time for the answer. Interactive chat often targets a first token under one second and the full answer streamed within several seconds. If the sum breaks the budget, find the stage to change: fewer chunks, a smaller model, caching, parallel calls, or streaming.

## A worked example

**Scenario:** estimate an internal assistant for 20,000 employees.

1. **Usage:** 30 percent use it daily, 5 questions each: 30,000 questions a day, with a peak of about 5 per second.
2. **Tokens per question:** 3,000 input, 300 output. Daily input 90 million tokens, output 9 million.
3. **API cost:** at $3 and $15 per million tokens: input $270 plus output $135 equals $405 per day, about $12,000 per month. Prompt caching of the 600-token system prompt and conversation prefix could cut input cost by 20 to 30 percent.
4. **Self-host check:** 5 requests per second at 300 output tokens is only 1,500 output tokens per second, within a single node's capacity, so self-hosting would be dominated by fixed GPU cost, not volume, and an API is likely cheaper at this scale.
5. **Latency:** retrieval 80 ms, rerank 100 ms, prefill 400 ms, first token about 0.7 s, then 300 tokens at 40 tokens per second is 7.5 s total, streamed; acceptable.
6. **Storage:** 800 documents with 40 chunks each is 32,000 chunks, trivial for any index.

## Enterprise practice (verified October 2026)

**Basics.** Tokens per request x requests x price, plus GPU sizing for self-hosting (steps above). Work the numbers before building.

**Worked inputs from live prices (October 2026; reprice before use).**

- **API cost example.** A support assistant uses 3,000 input tokens (of which 2,500 are a stable cached prefix) and 400 output tokens per turn on Claude Sonnet 5.5 ($2 in / $10 out per million; cache read 0.1x). Per turn: uncached input 500 x $2/M = $0.001; cached 2,500 x $0.20/M = $0.0005; output 400 x $10/M = $0.004; total about **$0.0055**, so 1M turns cost about $5,500. Without caching, input alone would be $0.006 and the total $0.010, about 80% more. Output dominates: it costs 5x input per token.
- **Tokenizer drift.** Anthropic notes Claude 4.7 and later models generate about 30% more tokens for the same text, so count tokens with the target model's tokenizer.
- **Tool and runtime overhead.** Tool definitions add hundreds of input tokens per request (computer-use toolsets thousands); web search is $10 per 1,000 searches; managed agent sessions add $0.08 per running hour.
- **Self-hosting anchors.** H100 on-demand rentals cluster near $3 per GPU-hour (about $1.5 to $7), B200 about $4 to $6.4 (secondary trackers). Self-hosting breaks even only at sustained high utilisation: compute tokens per second per GPU for your model, divide GPU-hour cost by tokens per hour, and compare with the API price including cache discounts.

**Enterprise pattern.** Keep a cost model as code (rate card as versioned data, scenarios for low, expected and peak load), include non-token costs (vector store, observability, evaluation, human review), and reconcile it against billing monthly.

## Common mistakes

- **Using average tokens** and ignoring long-tail requests that dominate memory.
- **Forgetting output tokens cost more** and agents multiply calls.
- **Planning GPUs from peak FLOPs** instead of measured goodput.
- **Ignoring the KV cache** when checking whether a model fits.
- **Not comparing self-hosting to APIs** using utilisation at the real volume.
