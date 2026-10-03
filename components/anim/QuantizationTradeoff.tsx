"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { GPUS, OVERHEAD_GB, PRECISIONS, QUALITY, SIZES, evaluate, type Precision } from "./quantizationLogic";

function Row<T extends string | number>({ label, items, value, onPick, unit = "" }: { label: string; items: readonly T[]; value: T; onPick: (v: T) => void; unit?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="w-14 text-paper-muted">{label}</span>
      {items.map((v) => (
        <AnimButton key={v} active={v === value} aria-pressed={v === value} onClick={() => onPick(v)}>
          {v}
          {unit}
        </AnimButton>
      ))}
    </div>
  );
}

export default function QuantizationTradeoff() {
  const [size, setSize] = useState<number>(70);
  const [prec, setPrec] = useState<Precision>("FP16");
  const [gpu, setGpu] = useState<number>(80);
  const r = evaluate(size, prec, gpu);

  return (
    <AnimFrame
      title="Quantization vs GPU memory"
      caption={`Weights = parameters x bytes per weight (FP16 2, INT8 1, INT4 0.5). We add a flat ${OVERHEAD_GB} GB allowance for KV cache and activations; the real figure depends on batch size and context length.`}
    >
      <Predict
        question="A 70B model is quantized to 4-bit. Does it fit on a single 80 GB GPU?"
        options={[
          { label: "Yes, with room to spare", correct: true },
          { label: "No, it still needs two GPUs" },
        ]}
        why="70B x 0.5 bytes is about 35 GB of weights, so even with KV cache and activations it fits on one 80 GB GPU. FP16 needs 140 GB."
      />
      <div className="font-mono text-xs">
        <Row label="Model" items={SIZES} value={size} onPick={setSize} unit="B" />
        <Row label="Precision" items={PRECISIONS} value={prec} onPick={setPrec} />
        <Row label="GPU" items={GPUS} value={gpu} onPick={setGpu} unit=" GB" />
        <div className="mt-3 flex gap-3">
          <div className="flex-1 rounded border border-line-soft p-3 text-center">
            <div className="text-paper-muted">Weights</div>
            <div className="text-lg text-paper">{r.weights} GB</div>
          </div>
          <div className={`flex-1 rounded border p-3 text-center ${r.fits ? "border-[#7bd88f]" : "border-[#ff6b6b]"}`}>
            <div className="text-paper-muted">{r.total} GB total</div>
            <div className="text-lg text-paper">{r.fits ? "Fits on 1 GPU" : `Needs ${r.gpus} GPUs`}</div>
          </div>
        </div>
        <p className="mt-4 text-paper" aria-live="polite">
          {size}B at {prec}: {r.weights} GB weights, {r.total} GB with overhead, on {gpu} GB GPUs:{" "}
          <span className={r.fits ? "text-[#7bd88f]" : "text-[#ff6b6b]"}>{r.fits ? "fits on one GPU" : `needs ${r.gpus} GPUs`}</span>. {QUALITY[prec]}
        </p>
      </div>
    </AnimFrame>
  );
}
