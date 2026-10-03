"use client";

import { useState } from "react";

export type PredictOption = { label: string; correct?: boolean };

export function Predict({ question, options, why }: { question: string; options: PredictOption[]; why: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  return (
    <div className="mb-5 rounded border border-line-soft p-3">
      <p className="text-sm text-paper">
        <span className="font-mono text-xs text-accent">Predict first · </span>
        {question}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            disabled={done}
            onClick={() => setPicked(i)}
            className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors disabled:cursor-default ${
              !done
                ? "border-line text-paper-muted hover:border-accent-dim hover:text-paper"
                : o.correct
                  ? "border-[#7bd88f] text-paper"
                  : i === picked
                    ? "border-[#ff6b6b] text-paper"
                    : "border-line text-paper-muted opacity-60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {done && (
        <p className="mt-3 text-xs leading-relaxed text-paper-muted" aria-live="polite">
          {options[picked].correct ? "Right. " : "Not quite. "}
          {why}
        </p>
      )}
    </div>
  );
}
