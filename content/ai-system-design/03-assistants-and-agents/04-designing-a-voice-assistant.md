---
title: "Designing a Voice Assistant"
short_title: "Voice Assistant"
tags: ["voice", "asr", "tts", "streaming", "latency", "design"]
sources:
  - "Public documentation on streaming speech-to-text and text-to-speech APIs"
  - "WebRTC specification and documentation on real-time audio transport"
  - "Public engineering articles on voice agents, turn detection and barge-in"
  - "Provider documentation and independent benchmark reports on OpenAI Realtime and Gemini Live APIs, September 2026 (secondary: inworld.ai, softcery.com, foundrysoft.co)"
predict:
  question: "The user reads out a prescription number and ASR confidence is low. What does the assistant do before calling the refill tool?"
  options: ["It calls the tool with its best guess and corrects it if the user objects", "It reads the number back and waits for the user to confirm it", "It transfers the call to a human agent without asking the user again"]
  answer: 1
  why: "The worked example has the assistant read the number back for confirmation rather than act on a low-confidence transcript."
check:
  - q: "Why combine VAD, transcript completeness and prosody instead of one fixed silence timeout?"
    options: ["A fixed timeout is either too slow for long pauses or cuts people off mid-thought", "VAD alone cannot detect silence, so other signals are always required", "A fixed timeout is more expensive to run than a combined detector"]
    answer: 0
    why: "The lesson says a fixed timeout is too slow or too eager, so better systems combine signals with a short timeout as fallback."
  - q: "Why autoscale voice workers on active sessions rather than on CPU?"
    options: ["CPU metrics are unavailable on GPU pools used for ASR and TTS", "Calls hold long-lived streams, so the system is bound by connections", "Sticky routing makes CPU usage identical across all replicas"]
    answer: 1
    why: "Each call holds long-lived streams, making the system connection-bound, so active sessions track real load."
  - q: "Why might a team choose a cascaded STT-LLM-TTS pipeline over a native speech-to-speech API?"
    options: ["Native APIs cannot reach latencies below one second end to end", "Cascaded pipelines are always cheaper per minute than native APIs", "It gives control of each stage, easy tool use and the ability to swap vendors"]
    answer: 2
    why: "The lesson says cascaded designs give control over each stage and easy tool use, while native APIs trade that for lower reported latency."
---

## The problem

A person speaks and expects a spoken reply that feels like conversation. Humans notice gaps over roughly a second; natural turn-taking is closer to 300 to 500 ms. A voice assistant is therefore a **real-time pipeline**: speech recognition, a language model and speech synthesis, all streaming, with turn-taking logic that handles interruptions.

## Step 1: Requirements

- **Latency:** time from the user finishing speaking to the first audio of the reply under about 800 ms.
- **Naturalness:** the assistant can be interrupted (**barge-in**), handles pauses and filler words, and does not talk over the user.
- **Accuracy:** names, numbers and domain terms transcribed correctly, even with noise or accents.
- **Reliability:** graceful behaviour on dropped audio, silence and unclear speech.
- **Scale (example):** 5,000 concurrent calls.

## Step 2: The streaming pipeline

1. **Capture and transport:** audio from the device streams over WebRTC or a telephony bridge in small frames (20 ms) to the server.
2. **Voice activity detection (VAD):** decides when speech starts and stops.
3. **Streaming ASR:** produces partial transcripts while the user is still speaking, and a final transcript at the end of the turn.
4. **LLM:** starts as soon as the turn ends (or even speculatively on partials), streaming tokens.
5. **Streaming TTS:** converts text to audio in sentence-sized pieces as tokens arrive, so playback begins before the model has finished.
6. **Playback** to the user, with the ability to stop instantly.

Every stage **streams**. If any one waits for the previous to finish, the latencies add up and the conversation feels broken.

## Step 3: The latency budget

A rough budget for 800 ms: end-of-speech detection 200 ms, ASR finalization 100 ms, LLM time to first token 300 ms, TTS time to first audio 150 ms, network 50 ms. Reducing it means: a faster, smaller model or a cached prompt prefix, short system prompts, starting TTS on the first sentence fragment, and placing servers near users. Measure each stage separately; the slowest dominates.

## Step 4: Turn-taking and barge-in

The hardest part is deciding **when the user is done**. A fixed silence timeout is either too slow (long pauses feel sluggish) or too eager (cuts people off mid-thought). Better systems combine VAD, the partial transcript's completeness (does the sentence feel finished?) and prosody, with a short timeout as the fallback.

**Barge-in:** when the user starts speaking during the reply, stop playback immediately, cancel the in-flight LLM and TTS work, and process the new input. Echo cancellation prevents the assistant from hearing its own voice as an interruption.

## Step 5: Making the LLM suitable for speech

Spoken replies should be **short and conversational**: no markdown, lists or URLs read aloud. Instruct the model to answer in one or two sentences and to ask a clarifying question when unsure. Numbers, dates and units should be written for the ear. Tool calls (booking, lookup) need filler speech ("let me check that") so silence does not appear while the tool runs.

## Step 6: Handling bad audio

- **Low ASR confidence:** ask the user to repeat or confirm ("Did you say five-one-two?") rather than acting on a guess, especially for names, numbers and anything irreversible.
- **Silence or noise:** time out politely, offer help.
- **Domain vocabulary:** supply custom terms or phrase hints to the ASR.
- **Dropped connection:** buffer, resume or reconnect, and keep session state on the server.

## Step 7: Scaling and cost

Each call holds long-lived streams, so the system is **connection-bound**. Use stateless media gateways, sticky routing for a call's lifetime, autoscaling on active sessions rather than CPU, and separate GPU pools for ASR, LLM and TTS. Cost per minute is the sum of the three models; smaller models for simple intents and caching of common replies reduce it.

## A worked example

**Scenario:** a user phones a pharmacy line and says "I'd like to refill my prescription."

1. VAD detects speech end after a 250 ms pause; the partial transcript already reads as a complete request.
2. The final transcript triggers the LLM, which identifies the refill intent and asks, "Sure, what's your date of birth?" The first sentence reaches TTS while the model is still finishing.
3. Audio starts playing about 700 ms after the user stopped speaking.
4. Midway through a longer reply the user says "wait, it's for my daughter." Barge-in stops playback, cancels generation, and the assistant responds to the new information.
5. The user reads out a prescription number; ASR confidence is low, so the assistant reads it back for confirmation before calling the refill tool.

## Enterprise practice (verified October 2026)

**Basics.** Speech-to-text, language model, text-to-speech, with turn detection and barge-in (steps above).

**Two architectures, both current (secondary sources, October 2026).** **Cascaded** (STT then LLM then TTS) gives you control of each stage, easy tool use and the ability to swap vendors; **native speech-to-speech** APIs (OpenAI Realtime, Google Gemini Live) skip the text hop and report **about 300 to 500 ms** end-to-end, with one benchmark reporting time-to-first-audio of roughly **180 to 220 ms for Gemini versus 200 to 250 ms for OpenAI** in September 2026. Reported pricing differs widely: OpenAI's realtime model is listed around **$32 per million audio input tokens and $64 output** (roughly $0.25 to $0.35 per minute all-in with caching), while Gemini Live is reported roughly an order of magnitude cheaper per minute. Treat vendor and aggregator numbers as a starting point and measure on your telephony path.

**Enterprise pattern.** Voice agents fail in the details: telephony codecs and jitter, interruptions, background noise and accents, and consent. Keep tool calls and business logic outside the speech model so the same logic serves chat and voice; keep a deterministic confirmation step before irreversible actions ("I'll transfer 500 dollars to account ending 1234, correct?"); record call consent per jurisdiction; log transcripts with PII redaction; and keep a human-handoff path with the context attached.

## Common mistakes

- **Running ASR, LLM and TTS one after another** instead of streaming.
- **A fixed silence timeout** for end of turn.
- **No barge-in or echo cancellation**, so the assistant talks over people.
- **Markdown and long answers** read aloud.
- **Acting on low-confidence transcripts** for names and numbers.
