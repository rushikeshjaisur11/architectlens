"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { CAPACITY, CLIENTS, OUTAGE, peakLoad, recoveryRound, simulate, type Strategy } from "./retryStormLogic";

const ROUNDS = 10;
const STRATEGIES: [Strategy, string][] = [
  ["none", "No retry"],
  ["immediate", "Immediate ×3"],
  ["backoff", "Backoff"],
  ["jitter", "Backoff + jitter"],
];

export default function RetryStorm() {
  const [strategy, setStrategy] = useState<Strategy>("immediate");
  const [shown, setShown] = useState(0);

  const all = simulate(strategy, ROUNDS);
  const rows = all.slice(0, shown);
  const scale = Math.max(peakLoad(all), CAPACITY);
  const done = shown === ROUNDS;
  const rec = recoveryRound(all);

  function pick(s: Strategy) {
    setStrategy(s);
    setShown(0);
  }

  return (
    <AnimFrame
      title="Retry storm"
      caption={`${CLIENTS} fresh requests arrive each round; the server handles ${CAPACITY} per round, except rounds ${OUTAGE[0]}-${OUTAGE[1]} when it is down. A failed request retries up to 3 times. Immediate retries pile onto the recovering server; jittered backoff spreads them out.`}
      controls={
        <>
          <AnimButton disabled={done} onClick={() => setShown((n) => n + 1)}>Next round</AnimButton>
          <AnimButton disabled={done} onClick={() => setShown(ROUNDS)}>Run 10 rounds</AnimButton>
          <AnimButton onClick={() => setShown(0)}>Reset</AnimButton>
        </>
      }
    >
      <Predict
        question={`${CLIENTS} clients each retry 3 times immediately against a server already at capacity. How many attempts does the server see in total?`}
        options={[{ label: "About 1,000" }, { label: "About 2,000" }, { label: "About 4,000", correct: true }]}
        why="Each client sends 1 original plus 3 retries, so 4 attempts: 4,000, and they all land within a few rounds. Run the simulation to see the peak."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Retry strategy">
        {STRATEGIES.map(([s, label]) => (
          <AnimButton key={s} active={strategy === s} aria-pressed={strategy === s} onClick={() => pick(s)}>
            {label}
          </AnimButton>
        ))}
      </div>
      <div className="font-mono text-xs">
        <ul className="space-y-1.5" aria-label="Offered load per round">
          {Array.from({ length: ROUNDS }, (_, i) => {
            const r = rows[i];
            const down = OUTAGE.includes(i);
            return (
              <li key={i} className="flex items-center gap-2">
                <span className={`w-8 shrink-0 ${down ? "text-[#ff6b6b]" : "text-paper-muted"}`}>R{i}</span>
                <div className="relative h-4 flex-1 rounded-sm border border-line-soft">
                  {r && (
                    <>
                      <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${(Math.min(r.served, r.offered) / scale) * 100}%` }} />
                      <div className="absolute inset-y-0 bg-[#ff6b6b]" style={{ left: `${(r.served / scale) * 100}%`, width: `${(r.failed / scale) * 100}%` }} />
                    </>
                  )}
                  <div className="absolute inset-y-0 w-px bg-paper" style={{ left: `${(CAPACITY / scale) * 100}%` }} aria-hidden />
                </div>
                <span className="w-14 shrink-0 text-right text-paper">{r ? r.offered : ""}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-paper-muted">
          <span className="text-accent">■</span> served · <span className="text-[#ff6b6b]">■</span> failed · white line = capacity ({CAPACITY}){down(shown)}
        </p>
        <p className="mt-3 text-paper-muted" aria-live="polite">
          {shown === 0
            ? "Press Next round to start."
            : done
              ? `Peak offered load ${peakLoad(all)} (${(peakLoad(all) / CAPACITY).toFixed(1)}x capacity). ${
                  rec === null ? "Never fully recovered within 10 rounds." : `Recovered in round ${rec}.`
                } Failed attempts: ${all.reduce((s, x) => s + x.failed, 0)}.`
              : `Round ${shown - 1}: offered ${rows[shown - 1].offered} (${rows[shown - 1].retries} retries), served ${rows[shown - 1].served}, failed ${rows[shown - 1].failed}.`}
        </p>
      </div>
    </AnimFrame>
  );
}

function down(shown: number) {
  return shown > 0 && OUTAGE.some((o) => o < shown) ? " · outage rounds in red" : "";
}
