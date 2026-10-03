---
title: "Designing a Meeting Assistant"
short_title: "Meeting Assistant"
tags: ["meetings", "transcription", "diarization", "summarization", "privacy", "design"]
sources:
  - "Public documentation on streaming speech recognition and speaker diarization"
  - "Public documentation on calendar and conferencing platform APIs and consent requirements"
  - "Liu et al., 'Lost in the Middle: How Language Models Use Long Contexts' (2023)"
---

## The problem

An assistant joins or listens to meetings, produces an accurate transcript, then delivers a summary, decisions and **action items with owners**, searchable later. It touches people's speech and company discussions, so privacy and consent are as important as accuracy. It combines streaming audio, speech recognition, speaker attribution and long-context summarisation.

## Step 1: Requirements

- **Capture:** join scheduled calls as a bot, or process audio from a client; support uploaded recordings.
- **Transcript:** accurate, speaker-labelled, timestamped, with domain terms and names handled well.
- **Outputs:** summary, key decisions, action items (owner and due date), topics and chapters; follow-up emails.
- **Search and Q&A:** "what did we decide about the pricing change?" across past meetings.
- **Privacy:** consent notices, retention controls, access limited to participants.
- **Scale (example):** 50,000 hours of meetings per day.

## Step 2: Pipeline

1. **Ingest audio:** from a conferencing bot or client, in small frames, per-participant streams if available.
2. **Speech to text:** a streaming ASR service producing partial and final segments with word timestamps and confidence.
3. **Diarization:** attribute segments to speakers, by using per-participant audio tracks when available (best), otherwise clustering voices.
4. **Post-processing:** punctuation, name correction using the calendar attendee list and custom vocabulary, redaction if required.
5. **Structuring:** split into topic segments and detect questions, decisions and commitments.
6. **Summarisation and extraction** with an LLM, producing structured output with citations back to transcript timestamps.
7. **Index and deliver:** store the transcript and embeddings, post a summary to chat or email, and sync action items to task tools.

## Step 3: Getting the transcript right

Everything downstream depends on it. Improvements: use **attendee names and company terms** as vocabulary hints, prefer separate audio tracks per speaker, handle overlapping speech, and keep confidence scores. When ASR is uncertain about a name or number, flag it rather than inventing. Keep the raw audio only as long as policy allows, as it is the most sensitive artifact.

## Step 4: Summarising a long conversation

Meetings run an hour or more and the middle of a long transcript is easy to lose. Use a **two-stage** approach: segment the transcript by topic (using pauses, speaker changes and embedding shifts), summarise each segment with the key points, decisions and open questions, then combine the segment summaries into the overall summary. Ask for **structured output**: decisions, action items, risks, and each item linked to the transcript span that supports it, so users can click and verify.

## Step 5: Action items done well

Action items are the highest-value and most error-prone output. Require an explicit cue (a commitment such as "I'll send the draft by Friday"), the **owner** resolved to a real person from the attendee list, and a due date resolved from relative phrases against the meeting date. If any field is ambiguous, mark it as a suggestion for a human to confirm instead of silently assigning. Tasks sync to the user's tool only after confirmation or by explicit opt-in.

## Step 6: Privacy, consent and security

- **Consent:** announce recording to participants, honour local laws on recording and consent, and let participants opt out; no silent recording.
- **Access control:** transcripts visible to attendees (or by explicit sharing), never to the whole company by default.
- **Retention:** configurable deletion of audio, transcript and derived data; legal holds where required.
- **Sensitive content:** detect and optionally redact personal or confidential data; restrict model training use.
- **Security:** encryption in transit and at rest, per-tenant isolation, audit of access.

## Step 7: Q&A across meetings

Index transcript chunks with metadata (meeting, date, speakers, project) and permissions, and apply the enterprise RAG pattern: permission-aware retrieval, answers with citations to the exact meeting and timestamp. Time-aware ranking prefers the most recent decision when topics were revisited.

## Step 8: Evaluation

Measure **word error rate** and **diarization error** on labelled meetings across accents, noise and domains; rate summary quality with rubrics (coverage, accuracy, brevity); and audit action items for precision and recall against human-annotated meetings. Track user edits to summaries and rejected action items as continuous feedback.

## A worked example

**Scenario:** a product team holds a 45-minute planning meeting.

1. A bot joins the scheduled call and announces recording; per-participant audio streams reach the ASR service with the attendee names as vocabulary hints.
2. The transcript is segmented into five topics. Segment summaries are produced in parallel and combined into a half-page overview.
3. The extractor finds "Priya will update the pricing page by next Wednesday". The owner resolves to Priya Nair from the attendee list, the date resolves against the meeting date. A second item, "someone should check legal", has no owner and is marked as unassigned.
4. A summary is posted to the team channel with timestamps linking to the transcript; Priya's task is created after she confirms it.
5. Two weeks later a teammate asks "what was the final pricing decision?" and gets an answer citing the meeting minute where it was made.

## Common mistakes

- **Summarising one giant transcript** in a single pass.
- **Guessing owners and dates** instead of flagging ambiguity.
- **Ignoring consent and retention rules.**
- **No custom vocabulary**, mangling names and product terms.
- **Making transcripts visible company-wide** by default.
