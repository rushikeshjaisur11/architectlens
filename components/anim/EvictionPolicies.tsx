"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { CAPACITY, KEYS, PRESETS, access, initialCache, type Cache, type Outcome, type Policy } from "./evictionLogic";

const POLICIES: Policy[] = ["LRU", "LFU", "FIFO"];

export default function EvictionPolicies() {
  const [cache, setCache] = useState<Cache>(initialCache("LRU"));
  const [log, setLog] = useState<Outcome[]>([]);

  function touch(keys: string[], base: Cache, baseLog: Outcome[]) {
    let c = base;
    const out = [...baseLog];
    for (const k of keys) {
      const r = access(c, k);
      c = r.cache;
      out.push(r.outcome);
    }
    setCache(c);
    setLog(out);
  }
  const reset = (p: Policy) => {
    setCache(initialCache(p));
    setLog([]);
  };
  const preset = (keys: string[]) => touch(keys, initialCache(cache.policy), []);

  const last = log[log.length - 1];
  const total = cache.hits + cache.misses;
  const rate = total ? Math.round((cache.hits / total) * 100) : 0;

  return (
    <AnimFrame
      title="Eviction policies"
      caption={`A cache with ${CAPACITY} slots. Access keys and watch which one gets evicted. Try "hot key + scan" under LRU and then LFU: LRU lets a one-off scan push out the hot key, LFU protects it. Then try "loop of 5 keys": with 5 keys cycling over 4 slots, LRU and FIFO always evict the key needed next, so the hit rate is 0%.`}
      controls={
        <>
          {POLICIES.map((p) => (
            <AnimButton key={p} active={cache.policy === p} onClick={() => reset(p)}>
              {p}
            </AnimButton>
          ))}
        </>
      }
    >
      <div className="font-mono text-xs">
        <div className="grid grid-cols-4 gap-2" role="img" aria-label={`Cache holds ${cache.slots.map((s) => s.key).join(", ") || "nothing"}`}>
          {Array.from({ length: CAPACITY }, (_, i) => {
            const s = cache.slots[i];
            return (
              <div key={i} className={`rounded border p-2 text-center ${s ? "border-accent-dim text-paper" : "border-line text-paper-muted"}`}>
                <div className="text-base">{s ? s.key : "-"}</div>
                <div className="text-paper-muted">{s ? `t${s.last} · f${s.freq}` : "empty"}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {KEYS.map((k) => (
            <AnimButton key={k} onClick={() => touch([k], cache, log)}>
              {k}
            </AnimButton>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([name, keys]) => (
            <AnimButton key={name} onClick={() => preset(keys)}>
              {name}
            </AnimButton>
          ))}
          <AnimButton onClick={() => reset(cache.policy)}>Reset</AnimButton>
        </div>
        <p className="mt-4 min-h-[2.5rem] text-paper-muted" aria-live="polite">
          {last ? (
            <>
              <span className="text-paper">{last.key}</span>:{" "}
              <span style={{ color: last.hit ? "#7bd88f" : "#ff6b6b" }}>{last.hit ? "hit" : "miss"}</span>
              {last.evicted && (
                <>
                  {" "}
                  · evicted <span className="text-paper">{last.evicted}</span>, {last.reason}
                </>
              )}
            </>
          ) : (
            "Access a key to begin."
          )}
        </p>
        <p className="mt-2 text-paper-muted" aria-live="polite">
          Hits <span className="text-paper">{cache.hits}</span> · Misses <span className="text-paper">{cache.misses}</span> · Hit rate{" "}
          <span className="text-paper">{rate}%</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1" aria-hidden>
          {log.slice(-30).map((o, i) => (
            <span key={i} className={`h-3 w-3 rounded-sm ${o.hit ? "bg-[#7bd88f]" : "bg-[#ff6b6b]"}`} />
          ))}
        </div>
      </div>
    </AnimFrame>
  );
}
