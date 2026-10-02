"use client";

import { useEffect, useRef, useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { useInView } from "./hooks";

const CAPACITY = 8;
const REFILL_MS = 1000;
const AUTO_MS = 400;
const TAPE_LENGTH = 30;

export default function TokenBucket() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const tokensRef = useRef(CAPACITY);
  const [tokens, setTokens] = useState(CAPACITY);
  const [tape, setTape] = useState<boolean[]>([]);
  const [auto, setAuto] = useState(false);
  const [counts, setCounts] = useState({ allowed: 0, rejected: 0 });

  function send() {
    const allowed = tokensRef.current >= 1;
    if (allowed) tokensRef.current -= 1;
    setTokens(tokensRef.current);
    setTape((t) => [...t.slice(-(TAPE_LENGTH - 1)), allowed]);
    setCounts((c) => (allowed ? { ...c, allowed: c.allowed + 1 } : { ...c, rejected: c.rejected + 1 }));
  }

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      tokensRef.current = Math.min(CAPACITY, tokensRef.current + 1);
      setTokens(tokensRef.current);
    }, REFILL_MS);
    return () => clearInterval(id);
  }, [inView]);

  useEffect(() => {
    if (!auto || !inView) return;
    const id = setInterval(send, AUTO_MS);
    return () => clearInterval(id);
  }, [auto, inView]);

  function reset() {
    tokensRef.current = CAPACITY;
    setTokens(CAPACITY);
    setTape([]);
    setCounts({ allowed: 0, rejected: 0 });
    setAuto(false);
  }

  return (
    <AnimFrame
      title="Token bucket"
      caption={`The bucket holds up to ${CAPACITY} tokens and gains 1 per second. Every request spends one. A burst is fine until the bucket empties, then requests are rejected until it refills. Auto traffic sends 2.5 requests per second, faster than the refill.`}
      controls={
        <>
          <AnimButton onClick={send}>Send request</AnimButton>
          <AnimButton
            onClick={() => {
              for (let i = 0; i < 5; i++) send();
            }}
          >
            Burst ×5
          </AnimButton>
          <AnimButton active={auto} onClick={() => setAuto((a) => !a)}>
            Auto traffic: {auto ? "on" : "off"}
          </AnimButton>
          <AnimButton onClick={reset}>Reset</AnimButton>
        </>
      }
    >
      <div ref={ref} className="font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-paper-muted">Tokens</span>
          <div className="flex gap-1.5" role="img" aria-label={`${tokens} of ${CAPACITY} tokens available`}>
            {Array.from({ length: CAPACITY }, (_, i) => (
              <span
                key={i}
                className={`h-5 w-5 rounded-full border transition-colors motion-reduce:transition-none ${
                  i < tokens ? "border-accent bg-accent" : "border-line bg-transparent"
                }`}
              />
            ))}
          </div>
          <span className="text-paper">
            {tokens}/{CAPACITY}
          </span>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="text-paper-muted">Requests</span>
          <div className="flex min-h-[1.25rem] flex-wrap gap-1" aria-hidden>
            {tape.map((ok, i) => (
              <span key={i} className={`h-3 w-3 rounded-sm ${ok ? "bg-[#7bd88f]" : "bg-[#ff6b6b]"}`} />
            ))}
          </div>
        </div>
        <p className="mt-4 text-paper-muted" aria-live="polite">
          Allowed <span className="text-paper">{counts.allowed}</span> · Rejected <span className="text-paper">{counts.rejected}</span>
        </p>
      </div>
    </AnimFrame>
  );
}
