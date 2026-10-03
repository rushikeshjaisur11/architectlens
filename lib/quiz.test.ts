import { describe, expect, it } from "vitest";
import lessons from "../.velite/lessons.json";

type Q = { options: string[]; answer: number };
type L = { path: string; predict?: Q; check: Q[] };

// A correct option much longer than every distractor is guessable by length alone.
const MAX_RATIO = 1.4;
const guessable = (q: Q) => {
  const wrong = Math.max(...q.options.filter((_, i) => i !== q.answer).map((o) => o.length));
  return q.options[q.answer].length > wrong * MAX_RATIO;
};

describe("lesson quizzes", () => {
  it("exist on every lesson: one predict and three check questions", () => {
    const missing = (lessons as L[]).filter((l) => !l.predict || l.check.length !== 3).map((l) => l.path);
    expect(missing).toEqual([]);
  });

  const quizzed = (lessons as L[]).filter((l) => l.predict || l.check.length);

  it("have a correct answer that is not guessable by length", () => {
    const bad = quizzed.flatMap((l) =>
      [...(l.predict ? [l.predict] : []), ...l.check].filter(guessable).map((q) => `${l.path}: ${q.options[q.answer].slice(0, 50)}`),
    );
    expect(bad).toEqual([]);
  });

  it("vary the correct index within a lesson", () => {
    const flat = quizzed.filter((l) => l.check.length >= 3 && new Set(l.check.map((q) => q.answer)).size === 1).map((l) => l.path);
    expect(flat).toEqual([]);
  });
});
