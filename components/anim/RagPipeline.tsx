"use client";

import { useEffect, useRef, useState } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { useInView, useReducedMotion } from "./hooks";

const STAGES: { label: string; orb: OrbState; text: string }[] = [
  { label: "Question", orb: "listening", text: "The user asks something the model can't answer from memory alone, such as a detail from your own documents." },
  { label: "Embed", orb: "weaving", text: "The question is turned into a vector, using the same embedding model that indexed the documents." },
  { label: "Retrieve", orb: "searching", text: "The vector index returns the chunks whose vectors sit closest to the question's. This is the step that decides what the model can know." },
  { label: "Rerank", orb: "solving", text: "A slower, more precise model re-scores the small candidate set so the most relevant chunks come first." },
  { label: "Generate", orb: "composing", text: "The best chunks go into the prompt and the model writes an answer grounded in them, ideally citing which chunk it used." },
];

export default function RagPipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || !inView || reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STAGES.length), 2600);
    return () => clearInterval(id);
  }, [playing, inView, reduced]);

  const stage = STAGES[step];

  return (
    <AnimFrame
      title="RAG pipeline"
      caption="Each stage is a place the pipeline can fail on its own. If the right chunk never leaves Retrieve, nothing downstream can recover it."
      controls={<AnimButton onClick={() => setPlaying((p) => !p)}>{playing && !reduced ? "Pause" : "Play"}</AnimButton>}
    >
      <div ref={ref}>
        <ol className="flex flex-wrap gap-2">
          {STAGES.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => {
                  setStep(i);
                  setPlaying(false);
                }}
                aria-current={i === step ? "step" : undefined}
                className={`flex items-center gap-2 rounded border px-2.5 py-1.5 font-mono text-xs transition-colors ${
                  i === step ? "border-accent-dim bg-ink text-paper" : "border-line text-paper-muted hover:text-paper"
                }`}
              >
                <span className={i === step ? "text-accent" : ""}>{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-center gap-4">
          <ThinkingOrb state={stage.orb} size={64} aria-label={`${stage.label} stage`} className="shrink-0" />
          <div aria-live="polite" className="min-h-[5.5rem] sm:min-h-[4.5rem]">
            <p className="font-mono text-sm text-paper">{stage.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-paper-muted">{stage.text}</p>
          </div>
        </div>
      </div>
    </AnimFrame>
  );
}
