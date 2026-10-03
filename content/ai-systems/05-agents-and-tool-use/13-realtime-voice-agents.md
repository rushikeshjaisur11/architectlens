---
title: "Realtime Voice Agents: Speech-to-Speech vs Cascaded Pipelines"
short_title: "Realtime Voice Agents"
tags: ["voice", "speech", "realtime", "latency", "agents", "telephony"]
sources:
  - "Provider documentation and independent benchmark reports on OpenAI Realtime and Gemini Live APIs, September 2026 (secondary: inworld.ai, softcery.com, foundrysoft.co)"
banner:
  layout: line
  nodes:
    - [phone, "mic"]
    - [model, "STT"]
    - [model, "LLM"]
    - [phone, "TTS"]
---

## Why voice is a different engineering problem

A chat agent can take two seconds and nobody minds. A voice agent that pauses two seconds after you stop talking feels broken. Human conversation turns around in roughly 200 to 500 milliseconds, so voice systems live under a **latency budget**: detect that the user stopped, understand, decide, speak, all inside a few hundred milliseconds, while handling interruptions, background noise, accents and telephone-quality audio.

## Two architectures

**Cascaded (STT, LLM, TTS).** Speech-to-text transcribes audio; a language model produces text (and tool calls); text-to-speech renders audio. Strengths: you can pick the best component for each stage, inspect and log text, apply guardrails on text, and reuse chat logic. Weakness: stages add latency, and prosody is lost between them (the model never hears tone or hesitation).

**Native speech-to-speech.** A single multimodal model consumes and produces audio directly (OpenAI's Realtime API and Google's Gemini Live API are the two dominant examples in 2026). Secondary reports put end-to-end latency around **300 to 500 ms**, with one benchmark reporting time-to-first-audio of about 180 to 220 ms for Gemini versus 200 to 250 ms for OpenAI in September 2026. It hears tone, handles interruptions more naturally and keeps the connection open over WebSocket or WebRTC. Weaknesses: less control over each stage, harder transcripts and guardrails, and vendor lock-in. Reported prices vary widely: OpenAI's realtime audio was listed around $32 per million input audio tokens and $64 output (roughly $0.25 to $0.35 per minute with caching), while Gemini Live was reported roughly an order of magnitude cheaper per minute. Treat these as starting points and measure.

## The pieces every voice agent needs

- **Voice activity detection and turn detection**: deciding when the user is *done* talking (not merely pausing), which is the main cause of awkward pauses or interruptions.
- **Barge-in**: when the user speaks over the agent, stop speaking immediately, discard queued audio and listen.
- **Streaming everywhere**: stream partial transcripts into the model and begin speaking before the full answer exists.
- **Telephony**: phone audio is 8 kHz, compressed and jittery; connect through SIP or a telephony provider and test on real calls.
- **Tool calls with spoken feedback**: while a lookup runs, say something short ("one moment") instead of silence.
- **Fallbacks**: a human handoff with the transcript and context attached.

## Why voice needs extra safety care

- **Confirmation by repeating back.** Speech recognition errors turn "fifteen" into "fifty". Before any irreversible action, read back the key values and ask for a clear yes.
- **Identity**: a voice is weak proof of identity; synthetic voices make "I recognise my customer's voice" unsafe. Use a second factor for sensitive actions.
- **Consent and recording laws**: announce recording, follow the strictest jurisdiction among participants, treat voiceprints as biometric data.
- **Disclosure** that the caller is speaking with an AI, where required.
- **PII in audio and transcripts**: redact before storage.

## A worked example

A clinic's appointment line.

1. Budget: respond within 700 ms of the caller finishing.
2. Pipeline: streaming STT (about 150 ms to a final transcript), a small model with tool access to the booking API (about 250 ms to first token), streaming TTS (about 150 ms to first audio): about 550 ms in total.
3. The caller says "Thursday at three"; the agent checks availability, then replies "I have Thursday the 14th at 3 p.m. with Dr. Rao. Shall I book it?" and waits for an explicit yes before calling the booking tool.
4. If the caller interrupts, the agent stops mid-sentence within about 100 ms.
5. For medication questions the agent hands off to a nurse line with a transcript summary.

## Practical rules

- Measure **time to first audio** and **interruption recovery** on real phone calls, at p50 and p95.
- Keep business logic and tools outside the speech model, so chat and voice share them.
- Evaluate across accents, noise levels and languages; error rates differ by group.
- Log with redaction and short retention.

## Common mistakes

- **Optimising average latency** while tail pauses ruin calls.
- **Ending the user's turn too early** (cutting people off) or too late (dead air).
- **Executing actions on a single recognised utterance** without read-back.
- **Testing only with studio-quality audio.**
- **Recording without clear consent.**
