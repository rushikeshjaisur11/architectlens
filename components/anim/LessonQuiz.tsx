"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Predict } from "./Predict";

function useRecordAnswer(kind: "predict" | "check") {
  const { status } = useSession();
  const lessonKey = usePathname().match(/^\/lessons\/([^/]+\/[^/]+\/[^/]+)/)?.[1];
  return (questionIndex: number, correct: boolean) => {
    if (status !== "authenticated" || !lessonKey) return;
    fetch("/api/quiz/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonKey, kind, questionIndex, correct }),
    }).catch(() => {});
  };
}

type Q = { q: string; options: string[]; answer: number; why: string };

export function LessonPredict({ question, options, answer, why }: { question: string; options: string[]; answer: number; why: string }) {
  const record = useRecordAnswer("predict");
  return (
    <Predict
      question={question}
      options={options.map((label, i) => ({ label, correct: i === answer }))}
      why={why}
      onAnswer={(ok) => record(0, ok)}
    />
  );
}

function Question({ q, options, answer, why, onAnswer }: Q & { onAnswer: (right: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  return (
    <div className="rounded border border-line-soft p-3">
      <p className="text-sm text-paper">{q}</p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={done}
            onClick={() => {
              setPicked(i);
              onAnswer(i === answer);
            }}
            className={`rounded border px-2.5 py-1.5 text-left text-xs transition-colors disabled:cursor-default ${
              !done
                ? "border-line text-paper-muted hover:border-accent-dim hover:text-paper"
                : i === answer
                  ? "border-[#7bd88f] text-paper"
                  : i === picked
                    ? "border-[#ff6b6b] text-paper"
                    : "border-line text-paper-muted opacity-60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {done && (
        <p className="mt-3 text-xs leading-relaxed text-paper-muted" aria-live="polite">
          {picked === answer ? "Right. " : "Not quite. "}
          {why}
        </p>
      )}
    </div>
  );
}

export function LessonCheck({ questions }: { questions: Q[] }) {
  const [right, setRight] = useState(0);
  const [answered, setAnswered] = useState(0);
  const record = useRecordAnswer("check");
  return (
    <section className="not-prose mt-12 space-y-3">
      <h2 className="font-mono text-xs text-accent">Check yourself</h2>
      {questions.map((q, i) => (
        <Question
          key={q.q}
          {...q}
          onAnswer={(ok) => {
            record(i, ok);
            setAnswered((a) => a + 1);
            if (ok) setRight((r) => r + 1);
          }}
        />
      ))}
      {answered === questions.length && (
        <p className="font-mono text-xs text-paper" aria-live="polite">
          {right} / {questions.length} correct
        </p>
      )}
    </section>
  );
}
