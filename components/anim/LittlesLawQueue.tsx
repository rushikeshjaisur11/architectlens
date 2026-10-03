"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { latencyMultiplier, mmc } from "./littlesLawLogic";

const MARKS = [0.5, 0.7, 0.9, 0.95, 0.99];
const ms = (s: number) => `${(s * 1000).toFixed(s < 0.1 ? 1 : 0)} ms`;

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-paper-muted">
        {label}: <span className="text-paper">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#7bd88f]" />
    </label>
  );
}

export default function LittlesLawQueue() {
  const [lambda, setLambda] = useState(70);
  const [mu, setMu] = useState(100);
  const [c, setC] = useState(1);

  const s = mmc(lambda, mu, c);
  const capacity = mu * c;
  const setUtil = (rho: number) => setLambda(Math.round(rho * capacity));
  const mults = MARKS.map((r) => latencyMultiplier(r, mu, c));
  const maxMult = mults[mults.length - 1];

  return (
    <AnimFrame
      title="Little's Law and the utilisation cliff"
      caption="M/M/c model (random arrivals, exponential service). Time in system W = queue wait + service time, and L = lambda x W. Bars show W as a multiple of bare service time at fixed utilisation for the current server count."
      controls={
        <>
          <AnimButton onClick={() => setUtil(0.7)}>Set 70%</AnimButton>
          <AnimButton onClick={() => setUtil(0.95)}>Set 95%</AnimButton>
        </>
      }
    >
      <Predict
        question="Load rises from 70% to 95% utilisation, only 25 points. By what factor does average latency (time in system) grow on one server?"
        options={[{ label: "About 1.4x" }, { label: "About 2x" }, { label: "About 6x", correct: true }]}
        why="W = service time / (1 - rho): 1/0.30 = 3.3x at 70% versus 1/0.05 = 20x at 95%, a 6x jump. Use the buttons and watch the bars."
      />
      <div className="font-mono text-xs">
        <div className="grid gap-4 sm:grid-cols-3">
          <Slider label="Arrival rate (req/s)" value={lambda} min={1} max={800} onChange={setLambda} />
          <Slider label="Service rate (req/s per server)" value={mu} min={10} max={200} onChange={setMu} />
          <Slider label="Servers" value={c} min={1} max={8} onChange={setC} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Utilisation", `${(s.rho * 100).toFixed(1)}%`],
            ["Avg latency W", s.stable ? ms(s.w) : "∞"],
            ["Avg in system L", s.stable ? s.l.toFixed(2) : "∞"],
            ["Avg queued", s.stable ? s.lq.toFixed(2) : "∞"],
          ].map(([k, v]) => (
            <div key={k} className={`rounded border p-2 ${s.stable ? "border-line-soft" : "border-[#ff6b6b]"}`}>
              <div className="text-paper-muted">{k}</div>
              <div className="text-base text-paper">{v}</div>
            </div>
          ))}
        </div>

        <p className={`mt-3 ${s.stable ? "text-paper-muted" : "text-[#ff6b6b]"}`} aria-live="polite">
          {s.stable
            ? `Stable: capacity ${capacity} req/s, ${(s.waitProb * 100).toFixed(0)}% of requests wait. Service time alone is ${ms(1 / mu)}.`
            : `Unstable: arrivals ${lambda} >= capacity ${capacity} req/s. The queue grows without bound.`}
        </p>

        <div className="mt-5 space-y-2">
          <p className="text-paper-muted">Latency multiple vs utilisation ({c} server{c > 1 ? "s" : ""})</p>
          {MARKS.map((r, i) => (
            <div key={r} className="flex items-center gap-2">
              <span className="w-10 text-paper-muted">{r * 100}%</span>
              <div className="h-4 flex-1 rounded-sm bg-line-soft/40">
                <div
                  className="h-4 rounded-sm bg-accent"
                  style={{ width: `${Math.max(2, (mults[i] / maxMult) * 100)}%`, opacity: Math.abs(s.rho - r) < 0.03 ? 1 : 0.55 }}
                />
              </div>
              <span className="w-14 text-right text-paper">{mults[i].toFixed(1)}x</span>
            </div>
          ))}
        </div>
      </div>
    </AnimFrame>
  );
}
