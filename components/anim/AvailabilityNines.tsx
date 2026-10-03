"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { LEVELS, composite, downtimeSeconds, fmtDuration, nines, type Mode } from "./availabilityLogic";

const MAX = 5;
const pct = (a: number) => `${(a * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;

export default function AvailabilityNines() {
  const [levels, setLevels] = useState([1, 1, 1]);
  const [mode, setMode] = useState<Mode>("series");

  const avail = composite(mode, levels.map((l) => LEVELS[l]));
  const down = downtimeSeconds(avail);

  return (
    <AnimFrame
      title="Availability nines"
      caption="Series: the request needs every component, so availabilities multiply. Parallel: the request fails only if every replica fails, so unavailabilities multiply. Parallel assumes independent failure domains."
      controls={
        <>
          <AnimButton active={mode === "series"} onClick={() => setMode("series")}>
            Series
          </AnimButton>
          <AnimButton active={mode === "parallel"} onClick={() => setMode("parallel")}>
            Parallel
          </AnimButton>
          <AnimButton disabled={levels.length >= MAX} onClick={() => setLevels((l) => [...l, 1])}>
            + Component
          </AnimButton>
          <AnimButton disabled={levels.length <= 1} onClick={() => setLevels((l) => l.slice(0, -1))}>
            − Component
          </AnimButton>
        </>
      }
    >
      <Predict
        question="Three components in series, each 99.9% available. What is the system availability?"
        options={[{ label: "99.9%" }, { label: "About 99.7%", correct: true }, { label: "99.99%" }]}
        why="Availabilities multiply: 0.999 × 0.999 × 0.999 ≈ 0.997. Every extra hop in series lowers the total."
      />
      <div className="font-mono text-xs">
        <ul className="space-y-3">
          {levels.map((lv, i) => (
            <li key={i} className="flex items-center gap-3">
              <label htmlFor={`avail-${i}`} className="w-16 shrink-0 text-paper-muted">
                Comp {i + 1}
              </label>
              <input
                id={`avail-${i}`}
                type="range"
                min={0}
                max={LEVELS.length - 1}
                step={1}
                value={lv}
                onChange={(e) => setLevels((l) => l.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                className="min-w-0 flex-1 accent-[var(--color-accent)]"
              />
              <span className="w-20 shrink-0 text-right text-paper">{pct(LEVELS[lv])}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded border border-line p-3" aria-live="polite">
          <p className="text-paper-muted">
            {mode === "series" ? "All must be up" : "Any one up is enough"} · composite
          </p>
          <p className="mt-1 text-lg text-accent">
            {(avail * 100).toFixed(4)}% <span className="text-xs text-paper-muted">({nines(avail).toFixed(2)} nines)</span>
          </p>
          <p className="mt-2 text-paper-muted">
            Downtime allowed: <span className="text-paper">{fmtDuration(down.year)}</span>/year ·{" "}
            <span className="text-paper">{fmtDuration(down.month)}</span>/month ·{" "}
            <span className="text-paper">{fmtDuration(down.week)}</span>/week
          </p>
          {levels.length > 1 && (
            <p className={`mt-2 ${mode === "series" ? "text-[#ff6b6b]" : "text-[#7bd88f]"}`}>
              {mode === "series"
                ? `Worse than the weakest component (${pct(LEVELS[Math.min(...levels)])}).`
                : `Better than the best component (${pct(LEVELS[Math.max(...levels)])}).`}
            </p>
          )}
        </div>
      </div>
    </AnimFrame>
  );
}
