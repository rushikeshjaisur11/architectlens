"use client";

import { useState } from "react";
import { AnimFrame } from "./AnimFrame";

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-paper-muted">
        {label}
        <span className="text-paper">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" className="mt-1 w-full accent-accent" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

const DB_CAPACITY = 2000;

export default function CacheHitRate() {
  const [hit, setHit] = useState(80);
  const [qps, setQps] = useState(5000);
  const [cacheMs, setCacheMs] = useState(1);
  const [dbMs, setDbMs] = useState(20);

  const h = hit / 100;
  const avg = h * cacheMs + (1 - h) * dbMs;
  const dbLoad = Math.round(qps * (1 - h));
  const overloaded = dbLoad > DB_CAPACITY;

  return (
    <AnimFrame
      title="Hit-rate playground"
      caption={`Average latency = hit × cache + (1 − hit) × DB. Database load = QPS × (1 − hit). The database here handles ${DB_CAPACITY} queries per second. Try 5000 QPS: at 50% hit the DB is swamped, at 80% it survives.`}
    >
      <div className="grid gap-4 font-mono text-xs sm:grid-cols-2">
        <Slider label="Hit rate" value={hit} min={0} max={99} unit="%" onChange={setHit} />
        <Slider label="Traffic" value={qps} min={500} max={20000} step={500} unit=" QPS" onChange={setQps} />
        <Slider label="Cache latency" value={cacheMs} min={1} max={10} unit=" ms" onChange={setCacheMs} />
        <Slider label="DB latency" value={dbMs} min={5} max={200} unit=" ms" onChange={setDbMs} />
      </div>
      <div className="mt-5 grid gap-3 font-mono text-xs sm:grid-cols-3" aria-live="polite">
        <div className="rounded border border-line-soft p-3">
          <div className="text-paper-muted">Avg latency</div>
          <div className="text-lg text-paper">{avg.toFixed(1)} ms</div>
          <div className="text-paper-muted">{(dbMs / avg).toFixed(1)}× faster than no cache</div>
        </div>
        <div className="rounded border border-line-soft p-3">
          <div className="text-paper-muted">DB load</div>
          <div className={`text-lg ${overloaded ? "text-[#ff6b6b]" : "text-paper"}`}>{dbLoad} /s</div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-line-soft">
            <div className={`h-full ${overloaded ? "bg-[#ff6b6b]" : "bg-accent"}`} style={{ width: `${Math.min(100, (dbLoad / DB_CAPACITY) * 100)}%` }} />
          </div>
        </div>
        <div className="rounded border border-line-soft p-3">
          <div className="text-paper-muted">Status</div>
          <div className={`text-lg ${overloaded ? "text-[#ff6b6b]" : "text-[#7bd88f]"}`}>{overloaded ? "DB overloaded" : "Healthy"}</div>
          <div className="text-paper-muted">{overloaded ? `needs ≥ ${Math.ceil((1 - DB_CAPACITY / qps) * 100)}% hit rate` : "within capacity"}</div>
        </div>
      </div>
    </AnimFrame>
  );
}
