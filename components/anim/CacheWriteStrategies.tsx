"use client";

import { useEffect, useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";

type Strategy = "cache-aside" | "write-through" | "write-behind";
const STRATEGIES: Strategy[] = ["cache-aside", "write-through", "write-behind"];
const FLUSH_MS = 2500;
const START_NOTE = "Cache and DB both hold x = 1.";

function Box({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex-1 rounded border p-3 text-center ${warn ? "border-[#ff6b6b]" : "border-line-soft"}`}>
      <div className="text-paper-muted">{label}</div>
      <div className="text-lg text-paper">{value}</div>
    </div>
  );
}

export default function CacheWriteStrategies() {
  const [strategy, setStrategy] = useState<Strategy>("write-behind");
  const [cache, setCache] = useState<number | null>(1);
  const [db, setDb] = useState(1);
  const [pending, setPending] = useState<number | null>(null);
  const [note, setNote] = useState(START_NOTE);

  useEffect(() => {
    if (pending === null) return;
    const id = setTimeout(() => {
      setDb(pending);
      setPending(null);
      setNote("Background flush finished. DB now holds x = 2.");
    }, FLUSH_MS);
    return () => clearTimeout(id);
  }, [pending]);

  function reset(next: Strategy = strategy) {
    setStrategy(next);
    setCache(1);
    setDb(1);
    setPending(null);
    setNote(START_NOTE);
  }

  function write() {
    if (strategy === "cache-aside") {
      setDb(2);
      setCache(null);
      setNote("Wrote x = 2 to the DB, then invalidated the cache key.");
    } else if (strategy === "write-through") {
      setDb(2);
      setCache(2);
      setNote("Wrote x = 2 to cache and DB before returning OK.");
    } else {
      setCache(2);
      setPending(2);
      setNote(`Returned OK after updating only the cache. DB flush runs in ${FLUSH_MS / 1000}s.`);
    }
  }

  function crash() {
    setNote(
      pending !== null
        ? "Cache node died before the flush. The write x = 2 is gone forever."
        : "Cache node died. The DB has the latest value, so nothing was lost.",
    );
    setCache(null);
    setPending(null);
  }

  return (
    <AnimFrame
      title="Write strategies under failure"
      caption="Pick a strategy, write x = 2, then crash the cache node. Write-behind is the only one that acknowledges a write the database has not seen yet."
      controls={STRATEGIES.map((s) => (
        <AnimButton key={s} active={strategy === s} onClick={() => reset(s)}>
          {s}
        </AnimButton>
      ))}
    >
      <Predict
        question="A client writes x = 2 and gets OK. Then the cache node crashes immediately. Which strategy loses the write?"
        options={STRATEGIES.map((s) => ({ label: s, correct: s === "write-behind" }))}
        why="Write-behind acknowledges after updating only the cache, so a crash before the async flush loses the write. The other two reach the DB first."
      />
      <div className="font-mono text-xs">
        <div className="flex gap-3">
          <Box label="Cache" value={cache === null ? "empty" : `x = ${cache}`} />
          <Box label="Database" value={`x = ${db}`} warn={pending !== null} />
        </div>
        <p className="mt-2 h-4 text-paper-muted" aria-hidden>
          {pending !== null ? "flush pending…" : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AnimButton onClick={write}>Write x = 2</AnimButton>
          <AnimButton onClick={crash}>Crash cache node</AnimButton>
          <AnimButton onClick={() => reset()}>Reset</AnimButton>
        </div>
        <p className="mt-4 text-paper" aria-live="polite">
          {note}
        </p>
      </div>
    </AnimFrame>
  );
}
