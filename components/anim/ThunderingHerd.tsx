"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";

type Mode = "none" | "single-flight" | "stale-while-revalidate";
const MODES: Mode[] = ["none", "single-flight", "stale-while-revalidate"];
const DB_CAPACITY = 20;
const REBUILD_MS = 200;

const OUTCOME: Record<Mode, { dbQueries: (n: number) => number; waitMs: number; text: string }> = {
  none: { dbQueries: (n) => n, waitMs: REBUILD_MS, text: "Every request sees a miss and queries the DB itself." },
  "single-flight": { dbQueries: () => 1, waitMs: REBUILD_MS, text: "One request rebuilds the value. The rest wait for it, then share the result." },
  "stale-while-revalidate": { dbQueries: () => 1, waitMs: 0, text: "One request refreshes in the background. Everyone else gets the old value instantly." },
};

export default function ThunderingHerd() {
  const [mode, setMode] = useState<Mode>("none");
  const [n, setN] = useState(100);
  const [fired, setFired] = useState(false);

  const out = OUTCOME[mode];
  const queries = out.dbQueries(n);
  const overloaded = queries > DB_CAPACITY;

  return (
    <AnimFrame
      title="Thundering herd"
      caption={`A hot key expires while ${n} requests are in flight. The DB can run ${DB_CAPACITY} queries at once and a rebuild takes ${REBUILD_MS} ms.`}
      controls={MODES.map((m) => (
        <AnimButton key={m} active={mode === m} onClick={() => setMode(m)}>
          {m}
        </AnimButton>
      ))}
    >
      <Predict
        question="A hot key expires and 100 requests arrive before it is rebuilt. With no protection, how many hit the database?"
        options={[{ label: "1" }, { label: "about 20" }, { label: "100", correct: true }]}
        why="Each request sees a miss before any of them has refilled the cache, so all 100 query the DB at once. That is far past the 20 it can handle."
      />
      <div className="font-mono text-xs">
        <label className="block">
          <span className="flex justify-between text-paper-muted">
            Concurrent requests
            <span className="text-paper">{n}</span>
          </span>
          <input type="range" className="mt-1 w-full accent-accent" min={10} max={500} step={10} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        <div className="mt-3">
          <AnimButton onClick={() => setFired(true)}>Expire hot key</AnimButton>
          {fired && (
            <AnimButton className="ml-2" onClick={() => setFired(false)}>
              Reset
            </AnimButton>
          )}
        </div>
        {fired && (
          <div aria-live="polite">
            <div className="mt-4 flex flex-wrap gap-1" aria-hidden>
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-sm ${i < queries ? (overloaded ? "bg-[#ff6b6b]" : "bg-accent") : "bg-[#7bd88f]"}`} />
              ))}
            </div>
            <p className="mt-2 text-paper-muted">
              <span className={overloaded ? "text-[#ff6b6b]" : "text-accent"}>■</span> hit the DB · <span className="text-[#7bd88f]">■</span> served without a DB query
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-line-soft p-3">
                <div className="text-paper-muted">DB queries</div>
                <div className={`text-lg ${overloaded ? "text-[#ff6b6b]" : "text-paper"}`}>
                  {queries} / {DB_CAPACITY}
                </div>
              </div>
              <div className="rounded border border-line-soft p-3">
                <div className="text-paper-muted">Extra wait</div>
                <div className="text-lg text-paper">{out.waitMs} ms</div>
              </div>
              <div className="rounded border border-line-soft p-3">
                <div className="text-paper-muted">Status</div>
                <div className={`text-lg ${overloaded ? "text-[#ff6b6b]" : "text-[#7bd88f]"}`}>{overloaded ? "DB overloaded" : "Healthy"}</div>
              </div>
            </div>
            <p className="mt-3 text-paper">{out.text}</p>
          </div>
        )}
      </div>
    </AnimFrame>
  );
}
