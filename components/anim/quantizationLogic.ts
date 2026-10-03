export const SIZES = [7, 13, 70] as const;
export const GPUS = [24, 48, 80] as const;
export type Precision = "FP16" | "INT8" | "INT4";
export const PRECISIONS: Precision[] = ["FP16", "INT8", "INT4"];

export const BYTES: Record<Precision, number> = { FP16: 2, INT8: 1, INT4: 0.5 };
// ponytail: flat allowance for KV cache + activations; real value depends on batch and context length
export const OVERHEAD_GB = 8;

export const QUALITY: Record<Precision, string> = {
  FP16: "Baseline quality.",
  INT8: "Close to lossless for most models.",
  INT4: "Small but real cost (low single-digit % on benchmarks) if well calibrated; evaluate on your task.",
};

export function weightGB(paramsB: number, p: Precision) {
  return paramsB * BYTES[p];
}

export function evaluate(paramsB: number, p: Precision, gpuGB: number) {
  const weights = weightGB(paramsB, p);
  const total = weights + OVERHEAD_GB;
  return { weights, total, fits: total <= gpuGB, gpus: Math.ceil(total / gpuGB) };
}
