"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { ANSWER_SPAN, DOC, QUESTION, answerIntact, chunkDoc, type ChunkStrategy } from "./chunkingLogic";

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-paper-muted">
      <span>
        {label}: <span className="text-paper">{value}</span> chars
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#7bd88f]" />
    </label>
  );
}

const STRATEGIES: ChunkStrategy[] = ["fixed-size", "sentence-aware"];

export default function ChunkingPlayground() {
  const [strategy, setStrategy] = useState<ChunkStrategy>("fixed-size");
  const [size, setSize] = useState(40);
  const [overlap, setOverlap] = useState(0);

  const chunks = chunkDoc(DOC, strategy, size, overlap);
  const ok = answerIntact(chunks);
  const avg = Math.round(chunks.reduce((n, c) => n + c.end - c.start, 0) / chunks.length);

  return (
    <AnimFrame
      title="Chunking playground"
      caption="Green outline: a chunk holds the whole answer, so retrieval can succeed. Red: the answer is cut across chunks, so no single chunk can answer. Overlap rescues fixed-size only when it is at least as long as the answer span."
      controls={STRATEGIES.map((s) => (
        <AnimButton key={s} active={strategy === s} onClick={() => setStrategy(s)}>
          {s}
        </AnimButton>
      ))}
    >
      <Predict
        question="The answer sits inside one sentence. With small chunks and no overlap, which strategy is more likely to cut it in half?"
        options={[
          { label: "fixed-size", correct: true },
          { label: "sentence-aware" },
          { label: "both equally" },
        ]}
        why="Fixed-size cuts every N characters regardless of meaning. Sentence-aware only breaks between sentences, so a fact inside one sentence stays whole."
      />
      <div className="font-mono text-xs">
        <p className="text-paper">
          <span className="text-accent">Q · </span>
          {QUESTION}
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Slider label="Chunk size" value={size} min={30} max={240} step={10} onChange={setSize} />
          <Slider label="Overlap" value={overlap} min={0} max={Math.min(60, size - 10)} step={5} onChange={setOverlap} />
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {chunks.map((c, i) => {
            const a = Math.max(c.start, ANSWER_SPAN.start);
            const b = Math.min(c.end, ANSWER_SPAN.end);
            const has = a < b;
            const whole = c.start <= ANSWER_SPAN.start && c.end >= ANSWER_SPAN.end;
            return (
              <li key={i} className={`whitespace-pre-wrap break-words rounded border p-2 text-paper-muted ${whole ? "border-[#7bd88f]" : has ? "border-[#ff6b6b]" : "border-line-soft"}`}>
                <span className="mr-2 text-accent">#{i + 1}</span>
                {has ? (
                  <>
                    {DOC.slice(c.start, a)}
                    <mark className="bg-transparent text-paper underline decoration-accent">{DOC.slice(a, b)}</mark>
                    {DOC.slice(b, c.end)}
                  </>
                ) : (
                  DOC.slice(c.start, c.end)
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-paper-muted">
          {chunks.length} chunks · avg {avg} chars
        </p>
        <p className={`mt-2 ${ok ? "text-[#7bd88f]" : "text-[#ff6b6b]"}`} aria-live="polite">
          {ok
            ? "Answer span is fully inside one chunk: retrieval can succeed."
            : "Answer span is cut across chunks: no single chunk contains it, retrieval fails."}
        </p>
      </div>
    </AnimFrame>
  );
}
