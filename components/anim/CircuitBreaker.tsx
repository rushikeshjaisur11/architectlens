"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { COOLDOWN, THRESHOLD, initialBreaker, sendRequest, type Outcome } from "./circuitBreakerLogic";

const tone = { closed: "text-[#7bd88f]", open: "text-[#ff6b6b]", "half-open": "text-accent" } as const;
const dot = { ok: "bg-[#7bd88f]", failed: "bg-[#ff6b6b]", "fast-failed": "bg-transparent border border-line" } as const;

export default function CircuitBreaker() {
  const [b, setB] = useState(initialBreaker);
  const [healthy, setHealthy] = useState(true);
  const [withBreaker, setWithBreaker] = useState(true);
  const [tape, setTape] = useState<Outcome[]>([]);

  function send(n: number) {
    let next = b;
    const out: Outcome[] = [];
    for (let i = 0; i < n; i++) {
      next = sendRequest(next, healthy, withBreaker);
      out.push(next.last!);
    }
    setB(next);
    setTape((t) => [...t, ...out].slice(-30));
  }

  function reset() {
    setB(initialBreaker());
    setTape([]);
  }

  const mode = withBreaker ? b.mode : "closed";

  return (
    <AnimFrame
      title="Circuit breaker"
      caption={`Closed: calls pass through. ${THRESHOLD} consecutive failures trip it open. Open: calls fail fast without touching the dependency, and after ${COOLDOWN} requests it goes half-open. Half-open: one probe goes through; success closes it, failure re-opens it. Switch the breaker off to see every call hit the failing dependency.`}
      controls={
        <>
          <AnimButton onClick={() => send(1)}>Send request</AnimButton>
          <AnimButton onClick={() => send(10)}>Send 10</AnimButton>
          <AnimButton active={!healthy} onClick={() => setHealthy((h) => !h)}>
            Downstream: {healthy ? "healthy" : "failing"}
          </AnimButton>
          <AnimButton
            active={withBreaker}
            onClick={() => {
              setWithBreaker((w) => !w);
              reset();
            }}
          >
            Breaker: {withBreaker ? "on" : "off"}
          </AnimButton>
          <AnimButton onClick={reset}>Reset</AnimButton>
        </>
      }
    >
      <Predict
        question={`The downstream is failing and you send 10 requests. With the breaker on, how many reach the downstream?`}
        options={[{ label: "All 10" }, { label: `${THRESHOLD} (then the rest fail fast)`, correct: true }, { label: "None" }]}
        why={`The first ${THRESHOLD} failures trip the breaker. After that, calls are rejected locally, so the dependency stops receiving traffic it cannot serve.`}
      />
      <div className="font-mono text-xs">
        <p className="flex flex-wrap items-center gap-3" aria-live="polite">
          <span className="text-paper-muted">Breaker state</span>
          <span className={`text-base ${tone[mode]}`}>{withBreaker ? mode : "none"}</span>
          {withBreaker && mode === "closed" && (
            <span className="text-paper-muted">
              consecutive failures {b.fails}/{THRESHOLD}
            </span>
          )}
          {withBreaker && mode === "open" && <span className="text-paper-muted">cooldown {b.cooldown} left</span>}
          {withBreaker && mode === "half-open" && <span className="text-paper-muted">next request is the probe</span>}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-paper-muted">Requests</span>
          <div className="flex min-h-[1.25rem] flex-wrap gap-1" aria-hidden>
            {tape.map((o, i) => (
              <span key={i} className={`h-3 w-3 rounded-sm ${dot[o]}`} />
            ))}
          </div>
        </div>
        <p className="mt-1 text-paper-muted">green = ok · red = reached downstream and failed · hollow = fast-failed</p>
        <p className="mt-4 text-paper-muted" aria-live="polite">
          Reached downstream <span className="text-paper">{b.reached}</span> (failed <span className="text-paper">{b.failedReached}</span>) · Fast-failed{" "}
          <span className="text-paper">{b.fastFailed}</span> · Downstream calls saved <span className="text-[#7bd88f]">{b.fastFailed}</span>
        </p>
      </div>
    </AnimFrame>
  );
}
