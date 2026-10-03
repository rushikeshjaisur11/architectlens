export const LEVELS = [0.99, 0.999, 0.9999, 0.99999];

export type Mode = "series" | "parallel";

// series: all must be up (product). parallel: fails only if all fail.
export function composite(mode: Mode, avails: number[]): number {
  if (mode === "series") return avails.reduce((p, a) => p * a, 1);
  return 1 - avails.reduce((p, a) => p * (1 - a), 1);
}

export function nines(a: number): number {
  return -Math.log10(1 - a);
}

const SECONDS = { year: 365 * 86400, month: (365 * 86400) / 12, week: 7 * 86400 };

export function downtimeSeconds(a: number) {
  const d = 1 - a;
  return { year: d * SECONDS.year, month: d * SECONDS.month, week: d * SECONDS.week };
}

export function fmtDuration(s: number): string {
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  if (s < 120) return `${s.toFixed(1)} s`;
  if (s < 7200) return `${(s / 60).toFixed(1)} min`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} days`;
}
